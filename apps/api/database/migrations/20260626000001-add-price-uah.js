'use strict';

const fetch = require('node-fetch');

/**
 * Adds a canonical UAH price alongside the per-ticket display currency.
 *
 * Tickets are stored in their display currency (UAH for UA-origin routes, EUR
 * for DE-origin routes), but LiqPay always charges UAH. To make the backend,
 * admin list, and reporting work in one comparable currency, we add:
 *   - tickets.exchangeRate : UAH per 1 unit of currencyAbbr at booking (1 for UAH)
 *   - tickets.priceUAH     : ticket total in UAH (= price × exchangeRate)
 *   - passengertickets.priceUAH : per-passenger UAH price (Σ == tickets.priceUAH)
 *
 * Backfill: UAH tickets → rate 1, priceUAH = price. EUR tickets → the HISTORICAL
 * EUR→UAH sale rate at the ticket's booking date (PrivatBank historical API,
 * cached per date; NBU rate then a constant as fallbacks), so old tickets get a
 * realistic UAH value rather than today's rate. The display price/currency is
 * left untouched — priceUAH is an added, normalized field.
 *
 * Idempotent: re-running recomputes the same values.
 */

// Safety net if the rate API is unreachable during the migration. Only used for
// non-UAH tickets when both the bank and NBU historical rates are unavailable.
const FALLBACK_RATE = { EUR: 45 };

function makeRateFetcher() {
  const cache = {};
  return async (currency, ymd) => {
    if (currency === 'UAH') return 1;
    const key = `${currency}@${ymd}`;
    if (cache[key] != null) return cache[key];

    // "2023-11-30" → "30.11.2023" (PrivatBank historical date format)
    const [y, m, d] = String(ymd).slice(0, 10).split('-');
    let rate = null;
    if (y && m && d) {
      try {
        const resp = await fetch(
          `https://api.privatbank.ua/p24api/exchange_rates?json&date=${d}.${m}.${y}`
        );
        const json = await resp.json();
        const row = (json.exchangeRate || []).find(
          (x) => x.currency === currency
        );
        // Prefer the bank sale rate; fall back to the NBU rate when the bank
        // rate is absent for that day/currency.
        rate = row
          ? Number(row.saleRate) || Number(row.saleRateNB) || null
          : null;
      } catch {
        rate = null;
      }
    }
    if (!rate) rate = FALLBACK_RATE[currency] || 1;
    cache[key] = rate;
    return rate;
  };
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;

    const tcols = await queryInterface.describeTable('tickets');
    if (!tcols.exchangeRate) {
      await queryInterface.addColumn('tickets', 'exchangeRate', {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
        defaultValue: null,
        comment: 'UAH per 1 unit of currencyAbbr at booking time; 1 for UAH.'
      });
    }
    if (!tcols.priceUAH) {
      await queryInterface.addColumn('tickets', 'priceUAH', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Ticket total normalized to UAH (price × exchangeRate), locked at booking.'
      });
    }
    const pcols = await queryInterface.describeTable('passengertickets');
    if (!pcols.priceUAH) {
      await queryInterface.addColumn('passengertickets', 'priceUAH', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        comment:
          'Per-passenger price normalized to UAH; SUM == tickets.priceUAH.'
      });
    }

    const getRate = makeRateFetcher();

    const [tickets] = await sequelize.query(
      'SELECT id, price, currencyAbbr, dateOfCreature, DATE(createdAt) AS createdDate FROM tickets'
    );

    for (const ticket of tickets) {
      const currency = String(ticket.currencyAbbr || 'UAH').toUpperCase();
      const ymd = (ticket.dateOfCreature || ticket.createdDate || '')
        .toString()
        .slice(0, 10);
      const rate = currency === 'UAH' ? 1 : await getRate(currency, ymd);
      const ticketUAH = Math.round((Number(ticket.price) || 0) * rate);

      const [rows] = await sequelize.query(
        `SELECT id, price FROM passengertickets WHERE ticketId = ${ticket.id} ORDER BY id ASC`
      );

      // Distribute the ticket UAH total across passengers (each pt.price × rate),
      // last row absorbs the rounding remainder so Σ == ticketUAH exactly.
      let assigned = 0;
      for (let i = 0; i < rows.length; i++) {
        const uah =
          i === rows.length - 1
            ? ticketUAH - assigned
            : Math.round((Number(rows[i].price) || 0) * rate);
        assigned += uah;
        await sequelize.query(
          `UPDATE passengertickets SET priceUAH = ${uah} WHERE id = ${rows[i].id}`
        );
      }

      await sequelize.query(
        `UPDATE tickets SET priceUAH = ${ticketUAH}, exchangeRate = ${rate} WHERE id = ${ticket.id}`
      );
    }
  },

  down: async (queryInterface) => {
    for (const [table, column] of [
      ['passengertickets', 'priceUAH'],
      ['tickets', 'priceUAH'],
      ['tickets', 'exchangeRate']
    ]) {
      const cols = await queryInterface.describeTable(table);
      if (cols[column]) await queryInterface.removeColumn(table, column);
    }
  }
};

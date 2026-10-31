/** @format */

const { HOME_CURRENCY } = require('@root/config/market');

const cityOf = (city) => ({
  id: city?.id ?? null,
  name: city?.cityattrs?.[0]?.name ?? null
});

/**
 * What the booking success page shows: a ticket loaded by
 * loadTicketWithRelations, reduced to plain JSON. Names are in the ticket's
 * booking language; `amountPaid` is what the payment provider charged, in the
 * home currency the ticket is stored in.
 */
function buildTicketSummary(ticket) {
  return {
    ticketNumber: ticket.ticketNumber,
    languageCode: ticket.language?.code ?? null,
    dateOfDeparture: ticket.dateOfDeparture,
    dateOfReturn: ticket.dateOfReturn ?? null,
    origin: cityOf(ticket.originCity),
    destination: cityOf(ticket.destinationCity),
    amountPaid: {
      amount: Number(ticket.priceUAH ?? ticket.price),
      currency: HOME_CURRENCY
    },
    passengers: (ticket.passengertickets ?? []).map((row) => ({
      name: row.passenger?.name ?? null,
      lastName: row.passenger?.lastName ?? null,
      type: row.passenger?.type ?? null
    }))
  };
}

module.exports = { buildTicketSummary };

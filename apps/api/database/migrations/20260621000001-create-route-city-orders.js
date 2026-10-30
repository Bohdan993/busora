'use strict';

/**
 * Creates and seeds `routecityorders` — the canonical ordering of cities along
 * each bus-line direction, used to sort the admin city list. Previously these
 * orders were hardcoded in the route handler; storing them in the DB lets the
 * order be maintained without code changes.
 *
 * Seeded by Ukrainian city name (resolved to ids from cityattributes at run
 * time) so it is correct regardless of per-environment auto-increment ids.
 */
const ORDERS = [
  {
    lineGroup: 1, // Запоріжжя ↔ Швайнфурт (Дюссельдорф)
    routeKey: 'ZD',
    names: ["Харків","Полтава","Київ","Житомир","Рівне","Львів","Дрезден","Лейпциг","Магдебург","Ганновер","Білефельд","Дортмунд","Ессен","Дюссельдорф"] // prettier-ignore
  },
  {
    lineGroup: 1,
    routeKey: 'DZ',
    names: ["Дюссельдорф","Ессен","Дортмунд","Білефельд","Ганновер","Магдебург","Лейпциг","Дрезден","Львів","Рівне","Житомир","Київ","Полтава","Харків"] // prettier-ignore
  },
  {
    lineGroup: 2, // Запоріжжя ↔ Карлсруе (Штутгарт)
    routeKey: 'ZK',
    names: ["Харків","Полтава","Київ","Житомир","Рівне","Львів","Дрезден","Хемніц","Хоф","Нюрнберг","Інгольштадт","Мюнхен","Ульм","Штутгарт"] // prettier-ignore
  },
  {
    lineGroup: 2,
    routeKey: 'KZ',
    names: ["Штутгарт","Ульм","Мюнхен","Інгольштадт","Нюрнберг","Хоф","Хемніц","Дрезден","Львів","Рівне","Житомир","Київ","Полтава","Харків"] // prettier-ignore
  }
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [tables] = await queryInterface.sequelize.query(
      "SHOW TABLES LIKE 'routecityorders'"
    );
    if (!tables.length) {
      await queryInterface.createTable('routecityorders', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        lineGroup: { type: Sequelize.INTEGER, allowNull: false },
        routeKey: { type: Sequelize.STRING(8), allowNull: false },
        cityId: { type: Sequelize.INTEGER, allowNull: false },
        position: { type: Sequelize.INTEGER, allowNull: false },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      });
    }

    // Seed once. Leave any manual edits intact on re-run.
    const [existing] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS c FROM routecityorders'
    );
    if (Number(existing[0].c) > 0) return;

    const [cityAttrs] = await queryInterface.sequelize.query(
      'SELECT cityId, name FROM cityattributes WHERE languageId = 1'
    );
    const idByName = {};
    for (const r of cityAttrs) idByName[r.name] = r.cityId;

    const now = new Date();
    const rows = [];
    const missing = new Set();
    for (const { lineGroup, routeKey, names } of ORDERS) {
      names.forEach((name, position) => {
        const cityId = idByName[name];
        if (cityId == null) {
          missing.add(name);
          return;
        }
        rows.push({
          lineGroup,
          routeKey,
          cityId,
          position,
          createdAt: now,
          updatedAt: now
        });
      });
    }

    if (missing.size) {
      console.warn(
        `[routecityorders] cities not found, skipped: ${[...missing].join(', ')}`
      );
    }
    if (rows.length) await queryInterface.bulkInsert('routecityorders', rows);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('routecityorders');
  }
};

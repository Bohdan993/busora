/** @format */

'use strict';

const constants = require('../../helpers/constants.js');

// Rows the application cannot run without. They live in a migration (not a
// seeder) so a fresh database is usable right after `npm run migrate`.
// uk_UA must keep id 1: the code falls back to languageId 1 in many places.
const LANGUAGES = [
  { id: 1, name: 'Українська', code: 'uk_UA' },
  { id: 2, name: 'Čeština', code: 'cs_CZ' },
  { id: 3, name: 'English', code: 'en_US' }
];

const TICKET_META = {
  ticket_status: [
    {
      metaKey: constants.TICKET_STATUS_NOT_PAYED,
      names: { uk_UA: 'Не оплачено', cs_CZ: 'Nezaplaceno', en_US: 'Not Paid' }
    },
    {
      metaKey: constants.TICKET_STATUS_PAYED,
      names: { uk_UA: 'Оплачено', cs_CZ: 'Zaplaceno', en_US: 'Paid' }
    },
    {
      metaKey: constants.TICKET_STATUS_HALF_USED,
      names: {
        uk_UA: 'Частково використано',
        cs_CZ: 'Částečně využito',
        en_US: 'Half Used'
      }
    },
    {
      metaKey: constants.TICKET_STATUS_USED,
      names: { uk_UA: 'Використано', cs_CZ: 'Využito', en_US: 'Used' }
    }
  ],
  ticket_type: [
    {
      metaKey: constants.ONE_WAY,
      names: { uk_UA: 'В одну сторону', cs_CZ: 'Jednosměrná', en_US: 'One Way' }
    },
    {
      metaKey: constants.ROUND,
      names: {
        uk_UA: 'В обидві сторони',
        cs_CZ: 'Zpáteční',
        en_US: 'Round Trip'
      }
    },
    {
      metaKey: constants.OPEN_DATE,
      names: {
        uk_UA: 'Відкрита дата',
        cs_CZ: 'Otevřené datum',
        en_US: 'Open Date'
      }
    }
  ],
  confirmation_type: [
    {
      metaKey: constants.CONFIRMATION,
      names: {
        uk_UA: 'Підтвердження',
        cs_CZ: 'Potvrzení',
        en_US: 'Confirmation'
      }
    },
    {
      metaKey: constants.DATE_TRANSFER,
      names: {
        uk_UA: 'Перенос дати',
        cs_CZ: 'Změna data',
        en_US: 'Date Transfer'
      }
    },
    {
      metaKey: constants.REFUSAL,
      names: { uk_UA: 'Відмова', cs_CZ: 'Odmítnutí', en_US: 'Refusal' }
    }
  ]
};

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const now = new Date();

      await queryInterface.bulkInsert(
        'languages',
        LANGUAGES.map((language) => ({
          ...language,
          createdAt: now,
          updatedAt: now
        })),
        { transaction }
      );

      for (const [metaType, items] of Object.entries(TICKET_META)) {
        for (const [index, item] of items.entries()) {
          const [metaId] = await queryInterface.sequelize.query(
            `INSERT INTO ticketmeta (meta_key, meta_type, is_active, sort_order, createdAt, updatedAt)
             VALUES (?, ?, true, ?, NOW(), NOW())`,
            {
              replacements: [item.metaKey, metaType, index + 1],
              transaction,
              type: queryInterface.sequelize.QueryTypes.INSERT
            }
          );

          await queryInterface.bulkInsert(
            'ticketmetaattributes',
            LANGUAGES.map((language) => ({
              metaId,
              languageId: language.id,
              name: item.names[language.code],
              createdAt: now,
              updatedAt: now
            })),
            { transaction }
          );
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('ticketmetaattributes', null, {
        transaction
      });
      await queryInterface.bulkDelete('ticketmeta', null, { transaction });
      await queryInterface.bulkDelete('languages', null, { transaction });
    });
  }
};

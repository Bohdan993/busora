/** @format */

'use strict';

const constants = require('../../helpers/constants.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // First, get all language IDs
      const languages = await queryInterface.sequelize.query(
        'SELECT id, code FROM languages ORDER BY id',
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      if (languages.length === 0) {
        throw new Error(
          'No languages found. Please ensure languages are seeded first.'
        );
      }

      // Define the meta data structure
      const metaData = {
        // Ticket Status Meta
        ticket_status: [
          {
            meta_key: constants.TICKET_STATUS_NOT_PAYED,
            translations: {
              uk_UA: 'Не оплачено',
              ru_RU: 'Не оплачено',
              de_DE: 'Nicht bezahlt',
              en_US: 'Not Paid'
            }
          },
          {
            meta_key: constants.TICKET_STATUS_PAYED,
            translations: {
              uk_UA: 'Оплачено',
              ru_RU: 'Оплачено',
              de_DE: 'Bezahlt',
              en_US: 'Paid'
            }
          },
          {
            meta_key: constants.TICKET_STATUS_HALF_USED,
            translations: {
              uk_UA: 'Частково використано',
              ru_RU: 'Частично использовано',
              de_DE: 'Teilweise genutzt',
              en_US: 'Half Used'
            }
          },
          {
            meta_key: constants.TICKET_STATUS_USED,
            translations: {
              uk_UA: 'Використано',
              ru_RU: 'Использовано',
              de_DE: 'Genutzt',
              en_US: 'Used'
            }
          }
        ],
        // Ticket Type Meta
        ticket_type: [
          {
            meta_key: constants.ONE_WAY,
            translations: {
              uk_UA: 'В одну сторону',
              ru_RU: 'В одну сторону',
              de_DE: 'Ein Weg',
              en_US: 'One Way'
            }
          },
          {
            meta_key: constants.ROUND,
            translations: {
              uk_UA: 'В обидві сторони',
              ru_RU: 'В обе стороны',
              de_DE: 'Rundfahrt',
              en_US: 'Round Trip'
            }
          },
          {
            meta_key: constants.OPEN_DATE,
            translations: {
              uk_UA: 'Відкрита дата',
              ru_RU: 'Открытая дата',
              de_DE: 'Offener Termin',
              en_US: 'Open Date'
            }
          }
        ],
        // Confirmation Type Meta (for passenger tickets)
        confirmation_type: [
          {
            meta_key: constants.CONFIRMATION,
            translations: {
              uk_UA: 'Підтвердження',
              ru_RU: 'Подтверждение',
              de_DE: 'Bestätigung',
              en_US: 'Confirmation'
            }
          },
          {
            meta_key: constants.DATE_TRANSFER,
            translations: {
              uk_UA: 'Перенос дати',
              ru_RU: 'Перенос даты',
              de_DE: 'Datumsübertragung',
              en_US: 'Date Transfer'
            }
          },
          {
            meta_key: constants.REFUSAL,
            translations: {
              uk_UA: 'Відмова',
              ru_RU: 'Отказ',
              de_DE: 'Ablehnung',
              en_US: 'Refusal'
            }
          }
        ]
      };

      // Insert ticketmeta records and their translations
      for (const [metaType, items] of Object.entries(metaData)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // Insert the meta record
          const [metaResults] = await queryInterface.sequelize.query(
            `INSERT INTO ticketmeta (meta_key, meta_type, is_active, sort_order, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, NOW(), NOW())`,
            {
              replacements: [item.meta_key, metaType, true, i + 1],
              transaction,
              type: Sequelize.QueryTypes.INSERT
            }
          );

          const metaId = metaResults; // Insert translations for each language
          for (const language of languages) {
            const translationText =
              item.translations[language.code] ||
              item.translations['en_US'] ||
              item.meta_key;

            await queryInterface.sequelize.query(
              `INSERT INTO ticketmetaattributes (metaId, languageId, name, createdAt, updatedAt) 
               VALUES (?, ?, ?, NOW(), NOW())`,
              {
                replacements: [metaId, language.id, translationText],
                transaction,
                type: Sequelize.QueryTypes.INSERT
              }
            );
          }
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Delete all ticketmetaattributes (will cascade from ticketmeta)
      await queryInterface.sequelize.query('DELETE FROM ticketmetaattributes', {
        transaction
      });

      // Delete all ticketmeta records
      await queryInterface.sequelize.query('DELETE FROM ticketmeta', {
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};

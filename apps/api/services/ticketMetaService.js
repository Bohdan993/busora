/** @format */

const { Op } = require('sequelize');
const {
  ticketmeta: TicketMeta,
  ticketmetaattributes: TicketMetaAttributes,
  language: Language
} = require('@database/models/index');

/**
 * Get all ticket metadata by type with localized attributes
 */
async function getMetaByType(metaType, languageCode = 'uk_UA') {
  const language = await Language.findOne({
    where: { code: languageCode }
  });

  const languageId = language?.id || 1; // Default to Ukrainian

  const metaItems = await TicketMeta.findAll({
    where: {
      meta_type: metaType,
      is_active: true
    },
    include: [
      {
        model: TicketMetaAttributes,
        as: 'ticketmetaattrs',
        where: {
          languageId: {
            [Op.in]: [1, languageId] // Fallback to Ukrainian if translation missing
          }
        },
        required: false
      }
    ],
    order: [['sort_order', 'ASC']]
  });

  return metaItems.map((item) => {
    const preferredTranslation = item.ticketmetaattrs?.find(
      (attr) => attr.languageId === languageId
    );
    const fallbackTranslation = item.ticketmetaattrs?.find(
      (attr) => attr.languageId === 1
    );

    return {
      id: item.id,
      meta_key: item.meta_key,
      meta_type: item.meta_type,
      sort_order: item.sort_order,
      name:
        preferredTranslation?.name ||
        fallbackTranslation?.name ||
        item.meta_key,
      description:
        preferredTranslation?.description ||
        fallbackTranslation?.description ||
        null
    };
  });
}

/**
 * Get metadata by key
 */
async function getMetaByKey(metaKey, languageCode = 'uk_UA') {
  const language = await Language.findOne({
    where: { code: languageCode }
  });

  const languageId = language?.id || 1;

  const metaItem = await TicketMeta.findOne({
    where: {
      meta_key: metaKey,
      is_active: true
    },
    include: [
      {
        model: TicketMetaAttributes,
        as: 'ticketmetaattrs',
        where: {
          languageId: {
            [Op.in]: [1, languageId]
          }
        },
        required: false
      }
    ]
  });

  if (!metaItem) return null;

  const preferredTranslation = metaItem.ticketmetaattrs?.find(
    (attr) => attr.languageId === languageId
  );
  const fallbackTranslation = metaItem.ticketmetaattrs?.find(
    (attr) => attr.languageId === 1
  );

  return {
    id: metaItem.id,
    meta_key: metaItem.meta_key,
    meta_type: metaItem.meta_type,
    name:
      preferredTranslation?.name ||
      fallbackTranslation?.name ||
      metaItem.meta_key,
    description:
      preferredTranslation?.description ||
      fallbackTranslation?.description ||
      null
  };
}

/**
 * Get metadata ID by key (for creating/updating records)
 */
async function getMetaIdByKey(metaKey) {
  const metaItem = await TicketMeta.findOne({
    where: {
      meta_key: metaKey,
      is_active: true
    },
    attributes: ['id']
  });

  return metaItem?.id || null;
}

/**
 * Get all ticket statuses
 */
async function getTicketStatuses(languageCode = 'uk_UA') {
  return getMetaByType('ticket_status', languageCode);
}

/**
 * Get all ticket types
 */
async function getTicketTypes(languageCode = 'uk_UA') {
  return getMetaByType('ticket_type', languageCode);
}

/**
 * Get all confirmation types
 */
async function getConfirmationTypes(languageCode = 'uk_UA') {
  return getMetaByType('confirmation_type', languageCode);
}

/**
 * Get a meta ID by its localized attribute name within a meta type.
 * The admin UI sends localized names (e.g. "Оплачено"), not meta_keys.
 */
async function getMetaIdByName(name, metaType, languageCode = 'uk_UA') {
  if (!name) return null;

  const language = await Language.findOne({
    where: { code: languageCode }
  });
  const languageId = language?.id || 1;

  const metaItem = await TicketMeta.findOne({
    where: { meta_type: metaType, is_active: true },
    include: [
      {
        model: TicketMetaAttributes,
        as: 'ticketmetaattrs',
        where: { name, languageId },
        required: true
      }
    ]
  });

  return metaItem?.id || null;
}

/**
 * Resolve a meta ID from whatever the client sent for a meta-backed field.
 * Tries the localized name first (what the admin UI sends), then falls back
 * to the legacy meta_key lookup (which also applies the per-type default).
 */
async function resolveMetaId(value, metaType, languageCode = 'uk_UA') {
  const byName = await getMetaIdByName(value, metaType, languageCode);
  if (byName) return byName;
  return convertEnumToMetaId(value, metaType);
}

/**
 * Convert legacy ENUM value to meta ID
 */
async function convertEnumToMetaId(enumValue, metaType) {
  const metaId = await getMetaIdByKey(enumValue);

  if (!metaId) {
    console.warn(
      `No meta ID found for enum value: ${enumValue} of type: ${metaType}`
    );

    // Return default values based on type
    switch (metaType) {
      case 'ticket_status':
        return await getMetaIdByKey('not-payed');
      case 'ticket_type':
        return await getMetaIdByKey('one-way');
      case 'confirmation_type':
        return await getMetaIdByKey('confirmation');
      default:
        return null;
    }
  }

  return metaId;
}

/**
 * Get localized meta name by ID
 */
async function getMetaNameById(metaId, languageCode = 'uk_UA') {
  const language = await Language.findOne({
    where: { code: languageCode }
  });

  const languageId = language?.id || 1;

  const metaItem = await TicketMeta.findOne({
    where: { id: metaId },
    include: [
      {
        model: TicketMetaAttributes,
        as: 'ticketmetaattrs',
        where: {
          languageId: {
            [Op.in]: [1, languageId]
          }
        },
        required: false
      }
    ]
  });

  if (!metaItem) return null;

  const preferredTranslation = metaItem.ticketmetaattrs?.find(
    (attr) => attr.languageId === languageId
  );
  const fallbackTranslation = metaItem.ticketmetaattrs?.find(
    (attr) => attr.languageId === 1
  );

  return (
    preferredTranslation?.name || fallbackTranslation?.name || metaItem.meta_key
  );
}

module.exports = {
  getMetaByType,
  getMetaByKey,
  getMetaIdByKey,
  getMetaIdByName,
  resolveMetaId,
  getTicketStatuses,
  getTicketTypes,
  getConfirmationTypes,
  convertEnumToMetaId,
  getMetaNameById
};

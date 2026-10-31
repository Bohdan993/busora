/** @format */

const { Op } = require('sequelize');
const {
  discount: Discount,
  discountattributes: DiscountAttributes
} = require('@database/models/index');
const { transformDateToShortString } = require('@helpers');
const constants = require('@helpers/constants.js');

/**
 * Personal discounts (every group except the per-flight promo) with names in
 * one language, in display order, grouped as [group, discounts] pairs.
 */
async function findPersonalDiscounts(languageId) {
  const discounts = await Discount.findAll({
    attributes: ['id', 'coef', 'inactivePeriod', 'group', 'maxAge', 'minAge'],
    where: { group: { [Op.not]: constants.BUS_FLIGHT } },
    include: [
      {
        model: DiscountAttributes,
        as: 'discountattrs',
        attributes: ['name', 'languageId'],
        where: { languageId: { [Op.eq]: languageId } }
      }
    ],
    order: [['order', 'ASC']]
  });
  return mapDiscounts(discounts.map((discount) => discount.toJSON()));
}

function mapDiscounts(discounts) {
  const uniq = {};
  discounts.forEach((discount) => {
    // const key = discount?.DiscountAttributes?.[0]?.group;
    const key = discount?.group;
    if (key && uniq[key]) {
      uniq[key].push(discount);
    } else {
      uniq[key] = [];
      uniq[key].push(discount);
    }
  });
  const resultArr = Object.entries(uniq);
  return resultArr;
}

function filterByDateDiscounts(discounts) {
  const filteredDiscounts = [];
  discounts.forEach((discountsArr, ind) => {
    const discountArr = discountsArr?.[1];
    discountArr.forEach((discountItem) => {
      if (!discountItem?.['inactivePeriod']) {
        pushFilteredItem({
          filteredDiscounts,
          ind,
          discountItem,
          discountsArr
        });
      } else {
        // The `else` of `if (!discountItem?.['inactivePeriod'])` guarantees the
        // value is a truthy string here, so the optional chain is redundant.
        const [startDate, endDate] = discountItem['inactivePeriod'].split('|');
        const currentDate = transformDateToShortString(new Date());
        if (
          !(
            currentDate.localeCompare(startDate) >= 0 &&
            currentDate.localeCompare(endDate) <= 0
          )
        ) {
          pushFilteredItem({
            filteredDiscounts,
            ind,
            discountItem,
            discountsArr
          });
        }
      }
    });
  });

  function pushFilteredItem({
    filteredDiscounts,
    ind,
    discountItem,
    discountsArr
  }) {
    if (!filteredDiscounts[ind]) {
      filteredDiscounts[ind] = [];
      filteredDiscounts[ind].push(discountsArr?.[0]);
      filteredDiscounts[ind].push([]);
      filteredDiscounts[ind][1].push(discountItem);
    } else {
      filteredDiscounts[ind][1].push(discountItem);
    }
  }

  return filteredDiscounts;
}

/**
 * Shapes grouped discounts ([group, discounts] pairs from mapDiscounts) for
 * API clients: one object per group, each discount flattened to the fields a
 * passenger form needs. `name` is in the language the discounts were loaded in.
 */
function toPassengerFormDiscounts(groupedDiscounts) {
  return groupedDiscounts.map(([group, discounts]) => ({
    group,
    items: discounts.map((discount) => ({
      id: discount.id,
      name: discount.discountattrs?.[0]?.name ?? null,
      coef: Number(discount.coef),
      minAge: discount.minAge ?? null,
      maxAge: discount.maxAge ?? null
    }))
  }));
}

module.exports = {
  findPersonalDiscounts,
  mapDiscounts,
  filterByDateDiscounts,
  toPassengerFormDiscounts
};

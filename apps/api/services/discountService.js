/** @format */

const { transformDateToShortString } = require('@helpers');

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

module.exports = {
  mapDiscounts,
  filterByDateDiscounts
};

function calculatePrice({ data } = {}) {
  const passengersData = Object.entries(data || []);
  const calculatedPrice = passengersData.reduce(priceReducer, 0);

  function priceReducer(acc, curr) {
    let currPassengerCount = curr?.[0].replace(/\D+/, '');
    const calcPrice =
      parseInt(curr?.[1]?.[`discount-ticket-price-${currPassengerCount}`]) || 0;
    return (acc += calcPrice);
  }

  return calculatedPrice;
}

/**
 * Prepares passenger data for email sending
 * @param {Object} passengersInfo - Passengers information object
 * @returns {Array} Formatted passenger data array
 */
function preparePassengerDataForEmail(passengersInfo) {
  const passengersInfoData = Object.entries(passengersInfo);
  return passengersInfoData.map((passengerArr, ind) => ({
    [`passanger-${ind + 1}-phone`]:
      passengerArr[1]?.[`phone-${ind + 1}`] || null,
    [`passanger-${ind + 1}-additionalPhone`]:
      passengerArr[1]?.[`phone-additional-${ind + 1}`] || null
  }));
}

module.exports = {
  calculatePrice,
  preparePassengerDataForEmail
};

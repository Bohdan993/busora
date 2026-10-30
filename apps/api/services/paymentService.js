const crypto = require('crypto');
const fetch = require('node-fetch');

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

async function getCurrencyExchangeRate(currency = {}) {
  const currenciesExchangeUrl =
    'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11';
  if (String(currency?.abbr) !== 'UAH') {
    const currenciesExchangeResponse = await fetch(currenciesExchangeUrl);
    const currenciesExchangeData = await currenciesExchangeResponse.json();
    const currencyExchangeObj = currenciesExchangeData?.find(
      (el) => String(el?.ccy) === String(currency?.abbr)
    );
    return (currencyExchangeObj?.sale && Number(currencyExchangeObj.sale)) || 1;
  }

  return 1;
}

function strToSign(str) {
  const sha1 = crypto.createHash('sha1');
  sha1.update(str);
  return sha1.digest('base64');
}

// async function getOrderStatus(order_id){
//     const orderStatusUrl = "https://www.liqpay.ua/api/request";
//     let orderStatusRequestBody = [];
//     const orderStatusParams = Buffer
//             .from(JSON.stringify({
//                 "action" : "status",
//                 "version" : 3,
//                 "public_key" : process.env.LIQPAY_PUBLIC_KEY,
//                 "order_id" : order_id,
//             }))
//             .toString("base64");
//     const orderStatusSignature = strToSign(process.env.LIQPAY_PRIVATE_KEY + orderStatusParams + process.env.LIQPAY_PRIVATE_KEY);
//     const orderStatusRequestObj = {
//         data: orderStatusParams,
//         signature: orderStatusSignature
//     };
//     for (const property in orderStatusRequestObj) {
//         const encodedKey = encodeURIComponent(property);
//         const encodedValue = encodeURIComponent(orderStatusRequestObj[property]);
//         orderStatusRequestBody.push(encodedKey + "=" + encodedValue);
//     }
//     orderStatusRequestBody = orderStatusRequestBody.join("&");
//     const orderStatusResponse = await fetch(orderStatusUrl, {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
//           },
//         body: orderStatusRequestBody

//     });
//     const orderStatusData = await orderStatusResponse.json();

//     return orderStatusData;
// }

/**
 * Parses payment callback data and extracts relevant information
 * @param {Object} params - The request body parameters
 * @returns {Object} Parsed payment data
 */
function parsePaymentCallbackData({ data, signature }) {
  const decodedData = Buffer.from(data, 'base64').toString('utf-8');
  const parsedData = JSON.parse(decodedData);
  const { amount: price, info } = parsedData;
  const { originalCurrency, originalPrice } = JSON.parse(info);

  return {
    decodedData,
    parsedData,
    price,
    originalCurrency,
    originalPrice,
    signature
  };
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
  getCurrencyExchangeRate,
  strToSign,
  parsePaymentCallbackData,
  preparePassengerDataForEmail
};

/** @format */

const path = require('path');
const fs = require('fs');
const constants = require('@helpers/constants.js');

function isOneWay(date) {
  return String(date) === constants.ONE_WAY;
}

function isRound(date) {
  return String(date) === constants.ROUND;
}

function isOpenDate(date) {
  return String(date) === constants.OPEN_DATE;
}

function isSpecialDate(date) {
  return (
    String(date) === constants.ONE_WAY || String(date) === constants.OPEN_DATE
  );
}

function loadLanguageFile(fileName, languageCode) {
  return require(path.resolve('languages', languageCode, fileName));
}

function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

function transformDate(dateStr, languageCode = 'uk_UA') {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isValidDate(d)) return null;
  const translations = loadLanguageFile('ticket-list.js', languageCode)?.months;
  const month = translations?.[d.getUTCMonth()];
  const day = d.getUTCDate() < 10 ? '0' + d.getUTCDate() : d.getUTCDate();
  const year = d.getUTCFullYear();

  return `${day} ${month} ${year}`;
}

function transformTimestampToDate(timestamp, sep = '.', format = 'dd mm yy') {
  const d = new Date(timestamp);
  if (isValidDate(d)) {
    const month =
      d.getUTCMonth() + 1 < 10
        ? '0' + (d.getUTCMonth() + 1)
        : d.getUTCMonth() + 1;
    const day = d.getUTCDate() < 10 ? '0' + d.getUTCDate() : d.getUTCDate();
    const year = d.getUTCFullYear();

    const dateMap = {
      dd: day,
      mm: month,
      yy: year
    };
    const formatArr = format.split(' ');

    return `${dateMap[formatArr[0]]}${sep}${dateMap[formatArr[1]]}${sep}${dateMap[formatArr[2]]}`;
  }

  return null;
}

function transformDateToShortString(date) {
  if (date instanceof Date) {
    const month =
      date.getMonth() + 1 < 10
        ? '0' + (date.getMonth() + 1)
        : date.getMonth() + 1;
    const day = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    return `${month}-${day}`;
  }

  return null;
}

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0;
}

function encodeHTMLEntities(rawStr) {
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, (i) => `&#${i.charCodeAt(0)};`);
}

function decodeHTMLEntities(rawStr) {
  return rawStr.replace(
    /&#(\d+);/g,
    (match, dec) => `${String.fromCharCode(dec)}`
  );
}

function base64Encode(file) {
  var bitmap = fs.readFileSync(file);
  return Buffer.from(bitmap).toString('base64');
}

function includeFunc(pug, pathToPug, options = {}) {
  return pug.renderFile(pathToPug, options); //render the pug file
}

function subtractYears(date, years) {
  date.setFullYear(date.getFullYear() - years);
  return date;
}

function sleep(ms) {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res();
    }, ms);
  });
}

function fromKebabToCamelCase(inputString) {
  return inputString.replace(/-([a-zA-Z0-9])/g, (_, match) =>
    match.toUpperCase()
  );
}

function getConstantTranslation(key, languageCode = 'uk_UA') {
  const translations = loadLanguageFile('_constants.js', languageCode);
  return translations[key] || null;
}

function transformTicketBusFlightToString({
  name,
  dateOfDeparture,
  freeSeats,
  discount
}) {
  return `${name} (${transformTimestampToDate(dateOfDeparture, '-')}) (${freeSeats + ' вільних місць'}) (${discount ? 'Акційна знижка ' + discount + '%' : 'Без знижки'})`;
}

function transformDateString(s) {
  const regex = /\b(?:\d{2}[./-]\d{2}[./-]\d{4}|\d{4}[./-]\d{2}[./-]\d{2})\b/g;
  const matches = s.match(regex);
  let output = matches ? matches.join('') : '';
  let date = output.split(/\/|\.|-/).join('-');
  let [day, month, year] = date.split('-').map(Number);
  let searchDate = new Date(year, month - 1, day);

  if (!isValidDate(new Date(date))) {
    date = date.split('-').reverse().join('-');
    let [year, month, day] = date.split('-').map(Number);
    searchDate = new Date(year, month - 1, day);
  }

  return searchDate;
}

function mapStringsToConstants(obj) {
  const constantsTraslations = loadLanguageFile('_constants.js', 'uk_UA');
  let result = { ...obj };
  for (const key in obj) {
    for (const translationKey in constantsTraslations) {
      if (
        String(obj[key]).toLowerCase() ===
        constantsTraslations[translationKey]?.toLowerCase()
      ) {
        result[key] = translationKey;
      }
    }
  }

  return result;
}

function transformStringToConstant(str) {
  const constantsTraslations = loadLanguageFile('_constants.js', 'uk_UA');
  const result = [];
  for (const translationKey in constantsTraslations) {
    if (
      constantsTraslations[translationKey]
        ?.toLowerCase()
        .includes(String(str).toLowerCase())
    ) {
      result.push(translationKey);
    }
  }

  return result.length ? result : [str];
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Ensures a value is a valid number, otherwise returns 0.
 * @param {any} v
 * @returns {number}
 */
function toSafeNumber(v) {
  return typeof v === 'number' && !isNaN(v) ? v : 0;
}

/**
 * Helper to get all dates for the next 2 months for given weekdays (0=Sun, 1=Mon, ..., 6=Sat)
 */
function getDatesForWeekdays(weekdays, months = 2) {
  const dates = [];
  const today = new Date();
  const end = new Date(today);
  end.setMonth(end.getMonth() + months);

  for (
    let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d < end;
    d.setDate(d.getDate() + 1)
  ) {
    if (weekdays.includes(d.getDay())) {
      // Clone date to avoid mutation
      dates.push(new Date(d));
    }
  }
  return dates;
}

module.exports = {
  isSpecialDate,
  isOneWay,
  isRound,
  isOpenDate,
  transformDate,
  loadLanguageFile,
  isValidDate,
  transformDateToShortString,
  isEmptyObject,
  transformTimestampToDate,
  encodeHTMLEntities,
  decodeHTMLEntities,
  base64Encode,
  includeFunc,
  subtractYears,
  sleep,
  fromKebabToCamelCase,
  getConstantTranslation,
  transformTicketBusFlightToString,
  mapStringsToConstants,
  hashCode,
  transformStringToConstant,
  transformDateString,
  toSafeNumber,
  getDatesForWeekdays
};

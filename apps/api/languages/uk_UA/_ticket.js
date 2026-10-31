/** @format */

const { OPEN_DATE, ONE_WAY, ROUND } = require("@helpers/constants.js");

const translations = {
  saveAsPDFText: "Зберегти як PDF",
  adultText: "Дорослий",
  childText: "Дитина",
  nameText: "Ім'я",
  lastNameText: "Прізвище",
  dateOfBirthText: "Дата народження",
  passengerText: "Пасажир",
  passengersText: "Пасажири",
  destinationText: "Туди",
  departureText: "Від'їзд",
  returnText: "Назад",
  onboardingText: "Місце посадки",
  outboardingText: "Місце висадки",
  departureTimeText: "Час відправлення",
  arrivalTimeText: "Час прибуття",
  additionalText: "час прибуття на наступну добу",
  additionalText2: "час прибуття залежить від проходу кордону",
  inGeneralText: "Загалом",
  discountText: "Знижка",
  priceText: "Ціна",
  discountCardNumberText: "Номер карти",
  ticketNumberText: "Номер квитка:",
  ticketTypeText: "Тип квитка:",
  dateOfBuingText: "Дата покупки:",
  carrierText: "Перевізник:",
  carrierInfoText: "ТОВ «Бусора» (навчальний демо-проєкт, не реальний перевізник)",
  edrpouText: "КОД ЄДРПОУ:",
  licenseText: "Ліцензія:",
  licenseInfoText: "серія ДЕМО № 000000 (вигадана)",
  legalAddressText: "Юридична адреса:",
  legalAddressInfoText:
    "вул. Навчальна, 1,\nм. Київ 01001, Україна.",
  actualAddressText: "Фактична адреса:",
  actualAddressInfoText:
    "вул. Навчальна, 1, оф. 1,\nм. Київ 01001, Україна.",
  routeText: "Рейс:",
  contactsText: "Контактні телефони:",
  ticketSeatText: "Місце:",
  ticketSeatInfoText: "Визначає Перевізник",
  phoneNums: ["+380 00 000 00 00"],
  ticketTypes: {
    [ONE_WAY]: "В одну сторону",
    [OPEN_DATE]: "Відкрита дата",
    [ROUND]: "В обидві сторони",
  },
  ticketCategories: {
    full: "Повний",
    discount: "Пільговий",
    promotional: "Акційний",
    full_discount: "Повний і пільговий",
  },
  saleText: "Акційна знижка",
  demoNoticeText:
    "Навчальний демо-проєкт: Busora не є реальним перевізником, квиток недійсний для поїздки.",
};

module.exports = translations;

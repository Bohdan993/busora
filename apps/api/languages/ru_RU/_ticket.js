/** @format */

const { OPEN_DATE, ONE_WAY, ROUND } = require("@helpers/constants.js");

const translations = {
  saveAsPDFText: "Сохранить как PDF",
  adultText: "Взрослый",
  childText: "Ребенок",
  nameText: "Имя",
  lastNameText: "Фамилия",
  dateOfBirthText: "Дата рождения",
  passengerText: "Пассажир",
  passengersText: "Пассажиры",
  destinationText: "Туда",
  departureText: "Отъезд",
  returnText: "Обратно",
  onboardingText: "Место посадки",
  outboardingText: "Место высадки",
  departureTimeText: "Время отправления",
  arrivalTimeText: "Время прибытия",
  additionalText: "время прибытия на следующие сутки",
  additionalText2: "время прибытия зависит от прохода границы",
  inGeneralText: "В общем",
  discountText: "Скидка",
  priceText: "Цена",
  discountCardNumberText: "Номер карты",
  ticketNumberText: "Номер билета:",
  ticketTypeText: "Тип билета:",
  dateOfBuingText: "Дата покупки:",
  carrierText: "Перевозчик:",
  carrierInfoText: "ООО «Бусора» (учебный демо-проект, не реальный перевозчик)",
  edrpouText: "КОД ЄДРПОУ:",
  licenseText: "Лицензия:",
  licenseInfoText: "серия ДЕМО № 000000 (вымышленная)",
  legalAddressText: "Юридический адрес:",
  legalAddressInfoText:
    "ул. Учебная, 1,\nг. Киев 01001, Украина.",
  actualAddressText: "Фактический адрес:",
  actualAddressInfoText:
    "ул. Учебная, 1, оф. 1,\nг. Киев 01001, Украина.",
  routeText: "Рейс:",
  contactsText: "Контактные телефоны:",
  ticketSeatText: "Место:",
  ticketSeatInfoText: "Определяется Перевозчиком",
  phoneNums: ["+380 00 000 00 00"],
  ticketTypes: {
    [ONE_WAY]: "В одну сторону",
    [OPEN_DATE]: "Открытая дата",
    [ROUND]: "В обе стороны",
  },
  ticketCategories: {
    full: "Полный",
    discount: "Льготный",
    promotional: "Акционный",
    full_discount: "Полный и льготный",
  },
  saleText: "Акционная скидка",
};

module.exports = translations;

/** @format */

const { OPEN_DATE, ONE_WAY, ROUND } = require("@helpers/constants.js");

const translations = {
  saveAsPDFText: "Uložit jako PDF",
  adultText: "Dospělý",
  childText: "Dítě",
  nameText: "Jméno",
  lastNameText: "Příjmení",
  dateOfBirthText: "Datum narození",
  passengerText: "Cestující",
  passengersText: "Cestující",
  destinationText: "Tam",
  departureText: "Odjezd",
  returnText: "Zpět",
  onboardingText: "Místo nástupu",
  outboardingText: "Místo výstupu",
  departureTimeText: "Čas odjezdu",
  arrivalTimeText: "Čas příjezdu",
  additionalText: "příjezd následující den",
  additionalText2: "čas příjezdu závisí na průjezdu hranicí",
  inGeneralText: "Celkem",
  discountText: "Sleva",
  priceText: "Cena",
  discountCardNumberText: "Číslo karty",
  ticketNumberText: "Číslo jízdenky:",
  ticketTypeText: "Typ jízdenky:",
  dateOfBuingText: "Datum nákupu:",
  carrierText: "Dopravce:",
  carrierInfoText:
    "Busora s.r.o. (vzdělávací demo projekt, nejedná se o skutečného dopravce)",
  edrpouText: "Kód EDRPOU:",
  licenseText: "Licence:",
  licenseInfoText: "série DEMO č. 000000 (smyšlená)",
  legalAddressText: "Sídlo:",
  legalAddressInfoText: "ul. Navčalna 1,\n01001 Kyjev, Ukrajina.",
  actualAddressText: "Provozovna:",
  actualAddressInfoText: "ul. Navčalna 1, kancelář 1,\n01001 Kyjev, Ukrajina.",
  routeText: "Spoj:",
  contactsText: "Kontaktní telefony:",
  ticketSeatText: "Místo:",
  ticketSeatInfoText: "Určuje dopravce",
  phoneNums: ["+380 00 000 00 00"],
  ticketTypes: {
    [ONE_WAY]: "Jednosměrná",
    [OPEN_DATE]: "Otevřené datum",
    [ROUND]: "Zpáteční",
  },
  ticketCategories: {
    full: "Plná",
    discount: "Zlevněná",
    promotional: "Akční",
    full_discount: "Plná a zlevněná",
  },
  saleText: "Akční sleva",
};

module.exports = translations;

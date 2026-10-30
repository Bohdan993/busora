/** @format */

const { OPEN_DATE, ONE_WAY, ROUND } = require("@helpers/constants.js");

const translations = {
  saveAsPDFText: "Als PDF speichern",
  adultText: "Erwachsener",
  childText: "Kind",
  nameText: "Name",
  lastNameText: "Nachname",
  dateOfBirthText: "Geburtsdatum",
  passengerText: "Passagier",
  passengersText: "Passagiere",
  destinationText: "An",
  departureText: "Abfahrt",
  returnText: "Zurück",
  onboardingText: "Einstiegsort",
  outboardingText: "Ausschiffungsort",
  departureTimeText: "Abfahrtszeit",
  arrivalTimeText: "Ankunftszeit",
  additionalText: "Ankunftszeit für den nächsten Tag",
  additionalText2: "Ankunftszeit hängt vom Grenzübergang ab",
  inGeneralText: "Allgemein",
  discountText: "Rabatt",
  priceText: "Preis",
  discountCardNumberText: "Kartennummer",
  ticketNumberText: "Ticketnummer:",
  ticketTypeText: "Tickettyp:",
  dateOfBuingText: "Kaufdatum:",
  carrierText: "Träger:",
  carrierInfoText: "Busora GmbH (Lern-Demoprojekt, kein echtes Busunternehmen)",
  edrpouText: "ЄДРПОУ-CODE:",
  licenseText: "Lizenz:",
  licenseInfoText: "Serie DEMO № 000000 (fiktiv)",
  legalAddressText: "Juristische Adresse:",
  legalAddressInfoText:
    "Lernstraße 1,\n01001 Kyjiw, Ukraine.",
  actualAddressText: "Tatsächliche Adresse:",
  actualAddressInfoText:
    "Lernstraße 1, Büro 1,\n01001 Kyjiw, Ukraine.",
  routeText: "Flug:",
  contactsText: "Kontaktnummern:",
  ticketSeatText: "Sitzplatz:",
  ticketSeatInfoText: "Wird vom Beförderer bestimmt",
  phoneNums: ["+380 00 000 00 00"],
  ticketTypes: {
    [ONE_WAY]: "Ein Weg",
    [OPEN_DATE]: "Offener Termin",
    [ROUND]: "Rundfahrt",
  },
  ticketCategories: {
    full: "Voll",
    discount: "Ermäßigt",
    promotional: "Aktion",
    full_discount: "Voll und ermäßigt",
  },
  saleText: "Aktionsrabatt",
};

module.exports = translations;

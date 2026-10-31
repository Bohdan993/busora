/** @format */

const { OPEN_DATE, ONE_WAY, ROUND } = require("@helpers/constants.js");

const translations = {
  saveAsPDFText: "Save as PDF",
  adultText: "Adult",
  childText: "Child",
  nameText: "First name",
  lastNameText: "Last name",
  dateOfBirthText: "Date of birth",
  passengerText: "Passenger",
  passengersText: "Passengers",
  destinationText: "Outbound",
  departureText: "Departure",
  returnText: "Return",
  onboardingText: "Boarding point",
  outboardingText: "Drop-off point",
  departureTimeText: "Departure time",
  arrivalTimeText: "Arrival time",
  additionalText: "arrival on the next day",
  additionalText2: "arrival time depends on the border crossing",
  inGeneralText: "Total",
  discountText: "Discount",
  priceText: "Price",
  discountCardNumberText: "Card number",
  ticketNumberText: "Ticket number:",
  ticketTypeText: "Ticket type:",
  dateOfBuingText: "Purchase date:",
  carrierText: "Carrier:",
  carrierInfoText:
    "Busora LLC (educational demo project, not a real carrier)",
  edrpouText: "EDRPOU code:",
  licenseText: "Licence:",
  licenseInfoText: "series DEMO No. 000000 (fictional)",
  legalAddressText: "Registered address:",
  legalAddressInfoText: "1 Navchalna St.,\nKyiv 01001, Ukraine.",
  actualAddressText: "Office address:",
  actualAddressInfoText: "1 Navchalna St., office 1,\nKyiv 01001, Ukraine.",
  routeText: "Trip:",
  contactsText: "Contact phones:",
  ticketSeatText: "Seat:",
  ticketSeatInfoText: "Assigned by the carrier",
  phoneNums: ["+380 00 000 00 00"],
  ticketTypes: {
    [ONE_WAY]: "One way",
    [OPEN_DATE]: "Open date",
    [ROUND]: "Round trip",
  },
  ticketCategories: {
    full: "Full",
    discount: "Reduced",
    promotional: "Promotional",
    full_discount: "Full and reduced",
  },
  saleText: "Promotional discount",
  demoNoticeText:
    "Educational demo: Busora is not a real carrier and this ticket is not valid for travel.",
};

module.exports = translations;

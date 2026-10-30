const translations = {
  subjectText: "Your ticket from Busora",
  text: (count) => {
    return `<p>Hello!</p>
            <br>
            <p>Thank you for your order!</p>
            <p>${count > 1 ? "Your tickets are in the attached PDF files" : "Your ticket is in the attached PDF file"}.</p>
            <br>
            <p style="font-style: italic;">Kind regards,</p>
            <p style="font-style: italic;">Busora</p>`;
  },
  ticketText: "Ticket",
  passengerPhoneText: "Passenger phone",
  passengerAdditionalPhoneText: "Passenger additional phone",
  passengerEmailText: "Passenger email",
  transactionIdText: "Transaction ID",
  ordreIdText: "Order ID",
  openDateText: "Open date",
  paymentDescriptionText: "Payment for",
};

module.exports = translations;

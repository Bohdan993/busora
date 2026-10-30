const translations = {
  subjectText: "Ihr Ticket von Benz Express",
  text: (count) => {
    return `<p>Hallo!</p>
            <br>
            <p>Vielen Dank für Ihre Bestellung!</p>
            <p>${count > 1 ? "Ihre Tickets befinden sich in den beigefügten PDF-Dateien" : "Ihr Ticket befindet sich in der beigefügten PDF-Datei"}.</p>
            <br>
            <p style="font-style: italic;">Mit freundlichen Grüßen</p>
            <p style="font-style: italic;">Benz Express</p>`;
  },
  ticketText: "Ticket",
  passengerPhoneText: "Telefon des Passagiers",
  transactionIdText: "Transaktions-ID",
  ordreIdText: "Bestell-ID",
  openDateText: "Offenes Datum",
};

module.exports = translations;

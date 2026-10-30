const translations = {
  subjectText: "Vaše jízdenka od Busora",
  text: (count) => {
    return `<p>Dobrý den!</p>
            <br>
            <p>Děkujeme za objednávku!</p>
            <p>${count > 1 ? "Vaše jízdenky naleznete v přiložených souborech PDF" : "Vaši jízdenku naleznete v přiloženém souboru PDF"}.</p>
            <br>
            <p style="font-style: italic;">S pozdravem</p>
            <p style="font-style: italic;">Busora</p>`;
  },
  ticketText: "Jízdenka",
  passengerPhoneText: "Telefon cestujícího",
  passengerAdditionalPhoneText: "Další telefon cestujícího",
  passengerEmailText: "E-mail cestujícího",
  transactionIdText: "ID transakce",
  ordreIdText: "ID objednávky",
  openDateText: "Otevřené datum",
  paymentDescriptionText: "Platba za",
};

module.exports = translations;

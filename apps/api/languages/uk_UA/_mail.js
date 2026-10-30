const translations = {
  subjectText: "Ваш квиток від Benz Express",
  text: (count) => {
    return `<p>Вітаємо!</p>
            <br>
            <p>Дякуємо за замовлення!</p>
            <p>${count > 1 ? "Ваші квитки знаходяться у вкладених PDF-файлах" : "Ваш квиток знаходиться у вкладеному PDF-файлі"}.</p>
            <br>
            <p style="font-style: italic;">З повагою</p>
            <p style="font-style: italic;">Бенс Експрес</p>`;
  },
  ticketText: "Квиток",
  passengerPhoneText: "Телефон пасажира",
  passengerAdditionalPhoneText: "Додатковий телефон пассажира",
  passengerEmailText: "Email пасажира",
  transactionIdText: "ID транзакції",
  ordreIdText: "ID замовлення",
  openDateText: "Відкрита дата",
};

module.exports = translations;

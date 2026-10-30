const translations = {
  subjectText: "Ваш билет от Benz Express",
  text: (count) => {
    return `<p>Здравствуйте!</p>
            <br>
            <p>Спасибо за заказ!</p>
            <p>${count > 1 ? "Ваши билеты находятся во вложенных PDF-файлах" : "Ваш билет находится во вложенном PDF-файле"}.</p>
            <br>
            <p style="font-style: italic;">С уважением</p>
            <p style="font-style: italic;">Бенс Экспресс</p>`;
  },
  ticketText: "Билет",
  passengerPhoneText: "Телефон пассажира",
  passengerAdditionalPhoneText: "Дополнительный телефон пассажира",
  passengerEmailText: "Email пассажира",
  transactionIdText: "ID транзакции",
  ordreIdText: "ID заказа",
  openDateText: "Открытая дата",
};

module.exports = translations;

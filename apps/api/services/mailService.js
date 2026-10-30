/** @format */
// const fs = require("fs");
// const path = require("path");
const nodemailer = require('nodemailer');
const { loadLanguageFile } = require('@helpers');
const constants = require('@helpers/constants.js');

function createMailer() {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT, //587
    secure: process.env.MAIL_SECURE, //false
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  return transporter;
}

function createAdminTicketLetter({
  subject: title,
  passangersData,
  email,
  translations,
  orderId,
  transactionId
}) {
  let output = `
    <html> 
        <head> 
            <title>${title}</title> 
        </head> 
        <body>
        <table>`;

  for (let i = 0; i < passangersData.length; i++) {
    if (i === 0) {
      output += passangersData[i][`passanger-${i + 1}-phone`]
        ? `<tr><td><b>${translations?.passengerPhoneText + ' №' + (i + 1)}:</b></td><td>${passangersData[i][`passanger-${i + 1}-phone`]}</td></tr>`
        : '';
      output += passangersData[i][`passanger-${i + 1}-additionalPhone`]
        ? `<tr><td><b>${translations?.passengerAdditionalPhoneText + ' №' + (i + 1)}:</b></td><td>${passangersData[i][`passanger-${i + 1}-additionalPhone`]}</td></tr>`
        : '';
      output += `<tr><td><b>${translations?.passengerEmailText + ' №' + (i + 1)}:</b></td><td>${email}</td></tr>`;
    } else {
      output += passangersData[i][`passanger-${i + 1}-phone`]
        ? `<tr><td><b>${translations?.passengerPhoneText + ' №' + (i + 1)}:</b></td><td>${passangersData[i][`passanger-${i + 1}-phone`]}</td></tr>`
        : '';
      output += passangersData[i][`passanger-${i + 1}-additionalPhone`]
        ? `<tr><td><b>${translations?.passengerAdditionalPhoneText + ' №' + (i + 1)}:</b></td><td>${passangersData[i][`passanger-${i + 1}-additionalPhone`]}</td></tr>`
        : '';
    }
  }

  // output += `<tr><td><b>${translations?.transactionIdText}:</b></td><td>${transactionId}</td></tr>`;
  output += `<tr><td><b>${translations?.ordreIdText}:</b></td><td>${orderId}</td></tr>`;
  output += `</table>
            </body> 
        </html>`;

  return output;
}

function createPassengerTicketLetter({
  subject: title,
  translations,
  count = 1
}) {
  let output = `<html>
                    <head>
                        <title>${title}</title> 
                    </head>
                    <body>
                        ${translations?.text ? translations.text(count) : ''}
                    </body>
                </html>`;

  return output;
}

async function sendFileMail({
  email,
  pdfPath, // backward-compatible: single PDF path (string)
  pdfPaths, // new: multiple PDFs, array of { path, filename }
  subject,
  languageCode = 'uk_UA',
  passangersData = null,
  transactionId = null,
  orderId = null,
  sendAdminEmail = true
}) {
  const translations = loadLanguageFile('_mail.js', languageCode);
  let adminText = null;
  const passengerText = createPassengerTicketLetter({
    subject,
    translations,
    count: pdfPaths ? pdfPaths.length : 1
  });
  const emailAdresses = [email];
  const result = [];

  // Build the attachments array once. When pdfPaths (array) is provided each
  // element must be { path, filename }. Fall back to the legacy single pdfPath.
  const attachments = pdfPaths
    ? pdfPaths.map(({ path: filePath, filename }) => ({
        filename,
        path: filePath,
        contentType: 'application/pdf'
      }))
    : [
        {
          filename: 'ticket.pdf',
          path: pdfPath,
          contentType: 'application/pdf'
        }
      ];

  if (sendAdminEmail) {
    emailAdresses.push(process.env.ADMIN_EMAIL);
    adminText = createAdminTicketLetter({
      subject,
      passangersData,
      email,
      translations,
      transactionId,
      orderId
    });
  }

  for (let i = 0; i < emailAdresses.length; i++) {
    const mailOptions = {
      from: process.env.MAIL_USER,
      to: emailAdresses[i],
      subject:
        emailAdresses[i] === process.env.ADMIN_EMAIL
          ? subject + ` | (${translations?.transactionIdText}:${transactionId})`
          : subject,
      attachments
    };

    mailOptions[
      /*emailAdresses[i] === process.env.ADMIN_EMAIL ? */ 'html' /*: "text"*/
    ] =
      emailAdresses[i] === process.env.ADMIN_EMAIL ? adminText : passengerText;

    const transporter = createMailer();

    result.push(
      new Promise((res, rej) => {
        transporter.sendMail(mailOptions, function (err, info) {
          if (err) {
            console.error(err);
            return rej(err);
          } else {
            console.log('Email sent: ' + info.response);
            console.log('Send to Email: ' + emailAdresses[i]);
            return res('Success');
          }
        });
      })
    );
  }

  return await Promise.all(result);
}

async function sendActivationMail(to, link) {
  const transporter = createMailer();
  const mailOptions = {
    from: process.env.MAIL_USER,
    to,
    subject: 'Активація акаунту на ' + process.env.API_URL,
    text: '',
    html: `
            <div>
                <h1>Для активації перейдіть за посиланням</h1>
                <a href="${link}">${link}</a>
            </div>
        `
  };

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.error(err);
    } else {
      console.log('Activation email sent: ' + info.response);
    }
  });
}

/**
 * Sends a plain-text alert to the admin inbox. Used when post-payment ticket
 * delivery fails (PDF render or email send) so a paid-but-unticketed order is
 * noticed immediately instead of surfacing days later from a customer complaint.
 * Awaitable, but callers should treat it as best-effort (catch its rejection)
 * so an alert-send failure never masks the original error.
 */
async function sendAdminAlertMail({ subject, text }) {
  const transporter = createMailer();
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject,
    text
  });
}

function getTicketSubject(selectedBusFlight, languageCode = 'uk_UA') {
  // console.log("selectedBusFlight in getTicketSubject:", selectedBusFlight);
  // fs.writeFileSync(
  //   path.resolve(__dirname, "debug_selectedBusFlight2.json"),
  //   JSON.stringify(selectedBusFlight, null, 2)
  // );
  const cities = selectedBusFlight.cities;
  const dates = selectedBusFlight.dates;
  const ticketType = selectedBusFlight.type;
  const startDate = dates?.departure;
  const endDate = dates?.return;
  const origin = cities?.from?.name;
  const destination = cities?.to?.name;
  const mailTranslations = loadLanguageFile('_mail.js', languageCode);

  let dateRange;
  if (ticketType === constants.OPEN_DATE) {
    dateRange = `${startDate} - ${mailTranslations?.openDateText || 'Відкрита дата'}`;
  } else {
    dateRange = `${startDate}${endDate ? ' - ' + endDate : ''}`;
  }

  const subject = `${mailTranslations?.ticketText} ${origin}-${destination} (${dateRange})`;

  return subject;
}

module.exports = {
  sendActivationMail,
  sendFileMail,
  sendAdminAlertMail,
  getTicketSubject
};

/**
 * Renders full-ticket.pug with mock data (matching the sample screenshot)
 * and writes the result to assets/ticket-sample.html.
 *
 * Usage: node generate-html-ticket.js
 */

'use strict';

require('module-alias/register');

const path = require('path');
const fs = require('fs');
const pug = require('pug');
const QRCode = require('qrcode');

const constants = require('@helpers/constants.js');
const {
  includeFunc,
  transformTimestampToDate,
  transformDate,
  loadLanguageFile,
  base64Encode
} = require('@helpers');

// ── Translations ──────────────────────────────────────────────────────────────
const translations = loadLanguageFile('_ticket.js', 'uk_UA');

// ── Mock data (mirrors the screenshot) ───────────────────────────────────────

// Dates
// transformDate("2026-02-24") → "24 Лют. 2026"
// transformDate("2026-02-26") → "26 Лют. 2026"
const startDate = transformDate('2026-02-24'); // "24 Лют. 2026"
const endDate = transformDate('2026-02-26'); // "26 Лют. 2026"

// Passengers
// transformTimestampToDate("1966-10-10T12:00:00.000Z") → "10.10.1966"
const passengersInfo = [
  [
    'adult-passenger-1',
    {
      name: 'Bohdan',
      'last-name': 'Bohdaniv',
      'date-of-birth': '1966-10-10T12:00:00.000Z',
      'discount-name': null,
      'card-discount': null,
      'discount-ticket-price': 6000
    }
  ]
];

// Ticket object
const ticket = {
  // type must equal one of translations.ticketTypes values so the category
  // logic inside the pug template resolves to "Акційний"
  type: translations.ticketTypes[constants.ROUND], // "В обидві сторони"
  ticketNumber: '003971',
  createdAt: '2026-02-23T00:00:00.000Z', // .split("T")[0] → "2026-02-23"
  hasDiscount: true,
  discountPercentage: 20
};

// Places
const places = {
  from: {
    routeName: 'Запоріжжя - Швайнфурт',
    onBoardingPlaceUkr: 'а/с «Житомир» (вул. Київська, 93, 1-2 пл.)',
    outBoardingPlaceUkr: 'Riegeplatz',
    onBoardingTime: '08:00',
    outBoardingTime: '04:30'
  },
  to: {
    routeName: 'Швайнфурт - Запоріжжя',
    onBoardingPlaceUkr: 'Riegeplatz',
    outBoardingPlaceUkr: 'а/с «Житомир» (вул. Київська, 93, 1-2 пл.)',
    onBoardingTime: '15:00',
    outBoardingTime: '11:00'
  }
};

// ── Pug include helper + terms of use path ────────────────────────────────────
const termsOfUsePath = path.resolve(
  'views',
  'ticket-terms-of-use',
  'uk_UA.pug'
);
const boundInclude = includeFunc.bind(null, pug);

// ── Logo ──────────────────────────────────────────────────────────────────────
const logoPath = path.resolve('assets', 'images', 'logo_benz_express.png');
const logoBase64 = fs.existsSync(logoPath)
  ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
  : '';

// ── Generate QR then render ───────────────────────────────────────────────────
QRCode.toDataURL(
  JSON.stringify({ signature: 'mock-signature', timestamp: ticket.createdAt }),
  { color: { dark: '#1B3B7F', light: '#FFFFFF' } },
  (err, qrUrl) => {
    if (err) {
      console.error('QR error:', err);
      process.exit(1);
    }

    const ticketData = {
      qr: qrUrl,
      logo: logoBase64,
      translations,
      constants,
      transformTimestampToDate,
      include: boundInclude,
      termsOfUsePath,

      data: {
        price: 6000,
        convertedPrice: 0, // 0 → template shows only `data.price`
        currencyAbbr: 'UAH',

        passengersInfo,

        startDate, // "24 Лют. 2026"
        endDate, // "26 Лют. 2026"  – truthy → return section rendered

        origin: 'Житомир',
        destination: 'Дрезден',

        ticket,
        places
      }
    };

    // ── Render pug → HTML ──────────────────────────────────────────────────────
    let html;
    try {
      html = pug.renderFile(
        path.resolve('views', 'full-ticket.pug'),
        ticketData
      );
    } catch (e) {
      console.error('Pug render error:', e.message);
      process.exit(1);
    }

    // Wrap in a full HTML document so the browser renders it correctly
    const fullHtml = `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Квиток ${ticket.ticketNumber}</title>
</head>
<body style="margin:0;padding:16px;background:#f5f5f5;">
  ${html}
</body>
</html>`;

    const outPath = path.resolve('assets', 'ticket-sample.html');
    fs.writeFileSync(outPath, fullHtml, 'utf8');
    console.log('✅  HTML written to:', outPath);
  }
);

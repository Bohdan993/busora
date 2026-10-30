/**
 * Renders full-ticket.pug with mock data (a Kyiv ⇄ Praha round trip) and
 * writes the result to assets/ticket-sample-<languageCode>.html.
 *
 * Usage: node generate-html-ticket.js [uk_UA|cs_CZ|en_US]
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
const languageCode = process.argv[2] || 'uk_UA';
const translations = loadLanguageFile('_ticket.js', languageCode);

// ── Mock data ─────────────────────────────────────────────────────────────────

// Localized names, as the DB attribute tables would return them
const MOCK_NAMES = {
  uk_UA: {
    origin: 'Київ',
    destination: 'Прага',
    routeTo: 'Київ - Прага',
    routeBack: 'Прага - Київ',
    kyivStop: 'АС «Видубичі» (Наддніпрянське шосе, 1)',
    prahaStop: 'ÚAN Florenc (Křižíkova 2110/2b)'
  },
  cs_CZ: {
    origin: 'Kyjev',
    destination: 'Praha',
    routeTo: 'Kyjev - Praha',
    routeBack: 'Praha - Kyjev',
    kyivStop: 'AN Vydubyči (Naddnipranska 1)',
    prahaStop: 'ÚAN Florenc (Křižíkova 2110/2b)'
  },
  en_US: {
    origin: 'Kyiv',
    destination: 'Prague',
    routeTo: 'Kyiv - Prague',
    routeBack: 'Prague - Kyiv',
    kyivStop: 'Vydubychi bus station (1 Naddnipryanske Hwy)',
    prahaStop: 'Florenc bus station (Křižíkova 2110/2b)'
  }
};
const names = MOCK_NAMES[languageCode];

// Dates
const startDate = transformDate('2026-12-18', languageCode);
const endDate = transformDate('2026-12-27', languageCode);

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
  // logic inside the pug template resolves to the promotional category
  type: translations.ticketTypes[constants.ROUND],
  ticketNumber: '003971',
  createdAt: '2026-11-02T00:00:00.000Z', // .split("T")[0] → "2026-11-02"
  hasDiscount: true,
  discountPercentage: 20
};

// Places
const places = {
  from: {
    routeName: names.routeTo,
    onBoardingPlaceUkr: names.kyivStop,
    outBoardingPlaceUkr: names.prahaStop,
    onBoardingTime: '07:00',
    outBoardingTime: '06:30'
  },
  to: {
    routeName: names.routeBack,
    onBoardingPlaceUkr: names.prahaStop,
    outBoardingPlaceUkr: names.kyivStop,
    onBoardingTime: '18:00',
    outBoardingTime: '17:30'
  }
};

// ── Pug include helper + terms of use path ────────────────────────────────────
const termsOfUsePath = path.resolve(
  'views',
  'ticket-terms-of-use',
  `${languageCode}.pug`
);
const boundInclude = includeFunc.bind(null, pug);

// ── Logo ──────────────────────────────────────────────────────────────────────
const logoPath = path.resolve('assets', 'images', 'logo_busora.png');
const logoBase64 = fs.existsSync(logoPath)
  ? 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
  : '';

// ── Generate QR then render ───────────────────────────────────────────────────
QRCode.toDataURL(
  JSON.stringify({ signature: 'mock-signature', timestamp: ticket.createdAt }),
  { color: { dark: '#005A87', light: '#FFFFFF' } },
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

        startDate,
        endDate, // truthy → return section rendered

        origin: names.origin,
        destination: names.destination,

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
<html lang="${languageCode.split('_')[0]}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${translations.ticketNumberText} ${ticket.ticketNumber}</title>
</head>
<body style="margin:0;padding:16px;background:#f5f5f5;">
  ${html}
</body>
</html>`;

    const outPath = path.resolve(
      'assets',
      `ticket-sample-${languageCode}.html`
    );
    fs.writeFileSync(outPath, fullHtml, 'utf8');
    console.log('✅  HTML written to:', outPath);
  }
);

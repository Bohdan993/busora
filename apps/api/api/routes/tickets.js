/** @format */

const { Router } = require('express');
const path = require('path');
const archiver = require('archiver');
const { Op } = require('sequelize');
const {
  ticket: Ticket,
  passengerticket: PassengerTicket
} = require('@database/models/index');
// const { transformTimestampToDate } = require("@helpers");
const { checkCallbackSignature } = require('@middlewares/paymentMiddlewares');
const { generateHTMLTicket, createTicket } = require('@services/ticketService');
const {
  loadTicketWithRelations,
  buildHTMLTicketOptions,
  generatePerPassengerPDFs,
  persistPerPassengerPDFs
} = require('@services/admin/ticketPdfService');
const { getSessionData } = require('@services/sessionService');
const constants = require('@helpers/constants.js');
const APIError = require('@exeptions/api-error');
const router = Router();

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Create ticket after successful LiqPay payment
 *     description: >
 *       Called by the frontend after LiqPay confirms payment. Verifies the HMAC
 *       signature, looks up session data, creates the ticket record and generates
 *       per-passenger PDFs. Idempotent — duplicate calls return the existing ticket.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data, signature]
 *             properties:
 *               data:
 *                 type: string
 *                 description: Base64-encoded LiqPay callback data
 *               signature:
 *                 type: string
 *                 description: HMAC-SHA1 signature from LiqPay
 *     responses:
 *       200:
 *         description: Ticket created (or already existed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 sessionExpiresTime:
 *                   type: integer
 *       403:
 *         description: Invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', [checkCallbackSignature], async (req, res, next) => {
  try {
    const { signature, data } = req?.body ?? {};

    const decodedData = Buffer.from(data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(decodedData);
    // console.log("MY LOG TICKETS PARSEDDATA", parsedData);
    const { sessionInfoData } = await getSessionData(parsedData);
    // const { amount: price, info } = parsedData;
    // const { originalCurrency, originalPrice } = JSON.parse(info);
    const {
      passengersInfo,
      selectedBusFlight,
      children: numOfChildren,
      adults: numOfAdults,
      originId,
      destinationId,
      startDate,
      endDate
    } = sessionInfoData;

    // console.log("MY LOG TICKETS SESSIONINFODATA", sessionInfoData);

    // const passengersInfoData = Object.entries(passengersInfo);
    const ticketCandidate = await Ticket.findOne({
      attributes: [
        'id',
        'dateOfDeparture',
        'dateOfReturn',
        'dateOfCreature',
        'busFlightFromId',
        'busFlightToId',
        'price',
        'currencyAbbr',
        'typeId',
        'statusId',
        'signature',
        'dateOfFirstUsage',
        'hasDiscount',
        'discountPercentage',
        'originId',
        'destinationId',
        'PDFFileName',
        'prevPDFFileName',
        'createdAt',
        'updatedAt',
        'ticketNumber',
        'transactionId'
      ],
      where: {
        transactionId: parsedData?.transaction_id
      }
    });

    let ticket;

    if (!ticketCandidate) {
      ticket = await createTicket({
        transactionId: parsedData?.transaction_id,
        signature,
        selectedBusFlight,
        children: numOfChildren || 0,
        adults: numOfAdults || 0,
        originId,
        destinationId,
        startDate,
        endDate,
        passengersInfo,
        data: decodedData
      });

      // await ticket?.reload();
    } else {
      ticket = ticketCandidate;
    }

    // Generate per-passenger PDFs only when none have been produced yet.
    // Tickets created before this change have a combined ticket.PDFFileName —
    // leave those untouched (they will be served as before by the download route).
    const existingPassengerPdf = await PassengerTicket.findOne({
      attributes: ['PDFFileName'],
      where: { ticketId: ticket.id, PDFFileName: { [Op.ne]: null } }
    });

    if (!existingPassengerPdf && !ticket.PDFFileName) {
      // Reload with all relations needed by the PDF builder
      const ticketWithRelations = await loadTicketWithRelations(ticket.id);
      const results = await generatePerPassengerPDFs(ticketWithRelations);
      await persistPerPassengerPDFs(ticketWithRelations, results);
    }

    return req.session.save(function (err) {
      if (err) return next(err);
      return res.json({
        status: 'ok',
        sessionExpiresTime: constants.SESSION_TIME
      });
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/tickets/generate:
 *   post:
 *     summary: Generate ticket confirmation HTML page
 *     description: >
 *       Renders the full-ticket HTML page for display after payment. Destroys the
 *       booking session on success. Requires a valid HMAC signature.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: string
 *                 description: Base64-encoded LiqPay callback data containing `transaction_id`
 *     responses:
 *       200:
 *         description: HTML page (text/html)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       403:
 *         description: Invalid signature
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/generate', [checkCallbackSignature], async (req, res, next) => {
  try {
    const { data } = req?.body ?? {};
    const decodedData = Buffer.from(data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(decodedData);
    // const { sessionInfoData } = await getSessionData(parsedData);
    // const { amount: price, info } = parsedData;
    // const { originalCurrency, languageCode } = JSON.parse(info);
    // const { passengersInfo, selectedBusFlight } = sessionInfoData;
    // const passengersInfoData = Object.entries(passengersInfo);
    const ticket = await Ticket.findOne({
      attributes: [
        'id'
        // "dateOfDeparture",
        // "dateOfReturn",
        // "dateOfCreature",
        // "busFlightFromId",
        // "busFlightToId",
        // "price",
        // "currencyAbbr",
        // "typeId",
        // "statusId",
        // "signature",
        // "dateOfFirstUsage",
        // "hasDiscount",
        // "discountPercentage",
        // "originId",
        // "destinationId",
        // "children",
        // "PDFFileName",
        // "prevPDFFileName",
        // "createdAt",
        // "updatedAt",
        // "ticketNumber",
        // "transactionId",
      ],
      where: {
        transactionId: parsedData?.transaction_id
      }
    });

    if (!ticket) {
      throw APIError.NotFoundError('ticket not found');
    }

    // Reload ticket with all necessary relations for HTML generation
    const ticketWithRelations = await loadTicketWithRelations(ticket.id);

    const htmlTicketOptions = await buildHTMLTicketOptions(
      ticketWithRelations,
      'ticket.pug'
    );
    const html = await generateHTMLTicket(htmlTicketOptions);

    return req.session.destroy(function (err) {
      if (err) return next(err);
      return res.send(html);
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/tickets/download-pdf:
 *   post:
 *     summary: Download ticket PDF(s)
 *     description: >
 *       Returns a single PDF or a ZIP archive containing one PDF per passenger.
 *       Requires a valid HMAC signature in the request body.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: string
 *                 description: Base64-encoded data containing `transaction_id`
 *     responses:
 *       200:
 *         description: PDF file or ZIP archive
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *           application/zip:
 *             schema: { type: string, format: binary }
 *       403:
 *         description: Invalid signature
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/download-pdf', checkCallbackSignature, async (req, res, next) => {
  try {
    const { data } = req?.body ?? {};

    const decodedData = Buffer.from(data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(decodedData);

    const ticket = await Ticket.findOne({
      attributes: ['id', 'signature', 'PDFFileName'],
      where: { transactionId: parsedData?.transaction_id }
    });

    if (!ticket) {
      throw APIError.NotFoundError('ticket not found');
    }

    // All passengers (adults + children) now have rows in passengertickets
    const passengerTickets = await PassengerTicket.findAll({
      attributes: ['PDFFileName'],
      where: { ticketId: ticket.id, PDFFileName: { [Op.ne]: null } },
      order: [['id', 'ASC']]
    });

    const pdfFileNames = passengerTickets.map((pt) => pt.PDFFileName);

    // ── Single PDF (or legacy combined ticket) ─────────────────────────────
    if (pdfFileNames.length <= 1) {
      const singleName =
        pdfFileNames.length === 1
          ? pdfFileNames[0] + '.pdf'
          : ticket?.PDFFileName + '.pdf';
      const singlePath = path.resolve('assets', 'tickets', singleName);
      return res.download(singlePath, 'Benz_Express_Ticket.pdf', (err) => {
        if (err) return next(err);
      });
    }

    // ── Multiple PDFs → stream as ZIP ──────────────────────────────────────
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Benz_Express_Tickets.zip"'
    );

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => next(err));
    archive.pipe(res);

    pdfFileNames.forEach((name, i) => {
      const filePath = path.resolve('assets', 'tickets', name + '.pdf');
      archive.file(filePath, { name: `Benz_Express_Ticket_${i + 1}.pdf` });
    });

    await archive.finalize();
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/tickets/payment-fail:
 *   post:
 *     summary: Handle failed payment notification
 *     description: Destroys the booking session when LiqPay reports a payment failure.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 properties:
 *                   data:
 *                     type: string
 *                     description: Base64-encoded callback payload
 *               errMsg:
 *                 type: string
 *               error:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session destroyed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post(
  '/payment-fail',
  [checkCallbackSignature],
  async (req, res, next) => {
    try {
      const { data, errMsg, error } = req?.body ?? {};

      const decodedData = Buffer.from(data?.data, 'base64').toString('utf-8');

      console.log('Fail. Passangers data: ', JSON.parse(decodedData));
      console.log('Fail. Payment data: ', data);
      console.log('Error msg:', errMsg);
      console.log('ERROR:', error);
      console.log('(Date: ' + new Date().toUTCString() + ')');

      return req.session.destroy(function (err) {
        if (err) return next(err);
        return res.json({
          status: 'ok'
        });
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;

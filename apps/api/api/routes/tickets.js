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
const { createTicket } = require('@services/ticketService');
const {
  loadTicketWithRelations,
  generatePerPassengerPDFs,
  persistPerPassengerPDFs
} = require('@services/admin/ticketPdfService');
const { getSessionData } = require('@services/sessionService');
const { buildTicketSummary } = require('@services/ticketSummaryService');
const constants = require('@helpers/constants.js');
const APIError = require('@exeptions/api-error');
const logger = require('@services/loggerService');
const { decodePayload } = require('@services/payments/signedPayload');
const router = Router();

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Create the ticket after a LiqPay widget payment
 *     description: >
 *       Called by the browser after the LiqPay widget reports success, racing
 *       the server callback. Creates the ticket and its per-passenger PDFs if
 *       the callback has not yet; idempotent per transaction.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignedPayload'
 *     responses:
 *       200:
 *         description: Ticket created or already existed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionOkResponse'
 *       400:
 *         description: BAD_REQUEST — invalid signature or unsuccessful payment
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
 * /api/tickets/summary:
 *   post:
 *     summary: Summary of a paid booking for the success page
 *     description: >
 *       Takes the signed payment result returned by the payment step and answers
 *       with the ticket in plain JSON. Ends the booking session.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignedPayload'
 *     responses:
 *       200:
 *         description: Ticket summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, data]
 *               properties:
 *                 status:
 *                   $ref: '#/components/schemas/OkStatus'
 *                 data:
 *                   $ref: '#/components/schemas/TicketSummary'
 *       400:
 *         description: Invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No ticket for this payment (yet)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/summary', [checkCallbackSignature], async (req, res, next) => {
  try {
    const { transaction_id: transactionId } = decodePayload(req.body.data);

    const ticket = await Ticket.findOne({
      attributes: ['id'],
      where: { transactionId }
    });

    if (!ticket) {
      throw APIError.NotFoundError('ticket not found');
    }

    const summary = buildTicketSummary(
      await loadTicketWithRelations(ticket.id)
    );

    return req.session.destroy(function (err) {
      if (err) return next(err);
      return res.json({ status: 'ok', data: summary });
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/tickets/download-pdf:
 *   post:
 *     summary: Download the ticket PDFs
 *     description: One PDF for a single passenger, otherwise a ZIP with one PDF per passenger.
 *     tags: [Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignedPayload'
 *     responses:
 *       200:
 *         description: PDF file or ZIP archive
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *           application/zip:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: BAD_REQUEST — invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: NOT_FOUND — no ticket for this payment
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
      return res.download(singlePath, 'Busora_Ticket.pdf', (err) => {
        if (err) return next(err);
      });
    }

    // ── Multiple PDFs → stream as ZIP ──────────────────────────────────────
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Busora_Tickets.zip"'
    );

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => next(err));
    archive.pipe(res);

    pdfFileNames.forEach((name, i) => {
      const filePath = path.resolve('assets', 'tickets', name + '.pdf');
      archive.file(filePath, { name: `Busora_Ticket_${i + 1}.pdf` });
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
 *     summary: Report a failed LiqPay widget payment
 *     description: Logs the failure and ends the booking session.
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
 *                 $ref: '#/components/schemas/SignedPayload'
 *               errMsg:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session ended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: BAD_REQUEST — invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/payment-fail',
  [checkCallbackSignature],
  async (req, res, next) => {
    try {
      const { data, errMsg } = req?.body ?? {};

      // Identifiers only: the payload also holds the payer's name and phone
      const payment = decodePayload(data.data);
      logger.logPayment('payment failed (reported by client)', {
        orderId: payment?.order_id,
        transactionId: payment?.transaction_id,
        status: payment?.status,
        errMsg
      });

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

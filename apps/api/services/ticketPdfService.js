/** @format */

const path = require('path');
const { Op } = require('sequelize');
const {
  ticket: Ticket,
  passengerticket: PassengerTicket
} = require('@database/models/index');
const {
  generateHTMLTicket,
  generatePDFTicket,
  prepareTicketPDFUpdate
} = require('./ticketService');
const {
  loadTicketWithRelations,
  buildHTMLTicketOptions,
  generatePerPassengerPDFs,
  persistPerPassengerPDFs
} = require('./admin/ticketPdfService');
const { sendFileMail } = require('./mailService');
const { getLanguageCodeById } = require('./languageService');

/**
 * Retrieves an existing ticket or creates a new one
 * @param {Object} params - Parameters for ticket retrieval/creation
 * @returns {Promise<Object>} The ticket object
 */
async function getOrCreateTicket({
  transactionId,
  signature,
  selectedBusFlight,
  numOfChildren,
  numOfAdults,
  originId,
  destinationId,
  startDate,
  endDate,
  passengersInfo,
  decodedData,
  createTicketFn
}) {
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
      'transactionId',
      'languageId'
    ],
    where: { transactionId }
  });

  if (ticketCandidate) {
    return ticketCandidate;
  }

  return await createTicketFn({
    transactionId,
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
}

/**
 * Generates PDF for a ticket if it doesn't exist
 * @param {Object} ticket - The ticket object
 * @param {string} signature - The payment signature
 * @returns {Promise<Object>} Object containing pdfPath and pdfName
 */
async function generateTicketPDF(ticket, signature) {
  const ticketWithRelations = await loadTicketWithRelations(ticket.id);

  const htmlTicketOptions = await buildHTMLTicketOptions(ticketWithRelations);
  const html = await generateHTMLTicket(htmlTicketOptions);
  const { pdfPath, pdfName } = await generatePDFTicket({
    html,
    signature,
    ticketUpdateTimestamp: ticket.updatedAt
  });

  // Update ticket with new PDF filename
  const pdfUpdates = await prepareTicketPDFUpdate(ticket);
  const queryObj = { ...pdfUpdates, PDFFileName: pdfName.slice(0, 64) };
  const queryOpts = { where: { id: ticket.id } };
  await Ticket.update(queryObj, queryOpts);

  return { pdfPath, pdfName };
}

/**
 * Ensures ticket has a PDF and sends it via email.
 * Prefers per-passenger PDFs (one attachment per passenger).
 * Falls back to the legacy combined PDF for older tickets.
 * @param {Object} params - Parameters for PDF handling
 * @returns {Promise<void>}
 */
async function ensureTicketPDFAndSendEmail({
  ticket,
  signature,
  email,
  passangersData,
  selectedBusFlight,
  transactionId,
  orderId,
  getTicketSubjectFn
}) {
  // All passengers (adults + children) now have rows in passengertickets.
  const ptRows = await PassengerTicket.findAll({
    attributes: ['PDFFileName'],
    where: { ticketId: ticket.id, PDFFileName: { [Op.ne]: null } },
    order: [['id', 'ASC']]
  });

  const pdfFileNames = ptRows.map((pt) => pt.PDFFileName);

  // If no per-passenger PDFs and no legacy combined PDF exist, generate them now.
  if (pdfFileNames.length === 0 && !ticket.PDFFileName) {
    const ticketWithRelations = await loadTicketWithRelations(ticket.id);
    const results = await generatePerPassengerPDFs(ticketWithRelations);
    await persistPerPassengerPDFs(ticketWithRelations, results);
    // results is [{ key, pdfName }, ...] — use it directly without an extra DB round-trip
    results.forEach(({ pdfName }) => pdfFileNames.push(pdfName));
  }

  // Guard: if generation produced no per-passenger PDFs AND there is no legacy
  // combined PDF, there is nothing to send. Never fall through to the legacy
  // branch with a null filename — that builds the path assets/tickets/null.pdf
  // and throws ENOENT (the 2026-08-18 incident). Fail loudly instead so the
  // caller's alert names the real problem: a ticket with no renderable PDF
  // (almost always a paid orphan ticket that has no passenger rows).
  if (pdfFileNames.length === 0 && !ticket.PDFFileName) {
    throw new Error(
      `Ticket ${ticket.id} has no renderable PDF (0 passenger PDFs and no legacy PDF) — likely a paid ticket with no passenger rows.`
    );
  }

  // The customer's email is in their booking language, like the PDFs
  const languageCode = await getLanguageCodeById(ticket.languageId);
  const subject = getTicketSubjectFn(selectedBusFlight, languageCode);

  if (pdfFileNames.length > 0) {
    // Send one email with every passenger's PDF as a separate attachment
    const pdfPaths = pdfFileNames.map((name, i) => ({
      path: path.resolve('assets', 'tickets', name + '.pdf'),
      filename:
        pdfFileNames.length > 1
          ? `Benz_Express_Ticket_${i + 1}.pdf`
          : 'Benz_Express_Ticket.pdf'
    }));

    await sendFileMail({
      email,
      passangersData,
      pdfPaths,
      subject,
      languageCode,
      transactionId,
      orderId
    });
  } else {
    // Legacy fallback: ticket has a combined PDF from before the per-passenger migration
    const pdfPath = path.resolve(
      'assets',
      'tickets',
      ticket.PDFFileName + '.pdf'
    );

    await sendFileMail({
      email,
      passangersData,
      pdfPath,
      subject,
      languageCode,
      transactionId,
      orderId
    });
  }
}

module.exports = {
  getOrCreateTicket,
  generateTicketPDF,
  ensureTicketPDFAndSendEmail
};

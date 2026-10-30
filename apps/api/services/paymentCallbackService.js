/** @format */

const { decodePayload } = require('@services/payments/signedPayload');
const { preparePassengerDataForEmail } = require('@services/paymentService');
const { createTicket } = require('@services/ticketService');
const {
  getOrCreateTicket,
  ensureTicketPDFAndSendEmail
} = require('@services/ticketPdfService');
const {
  getTicketSubject,
  sendAdminAlertMail
} = require('@services/mailService');
const {
  getSessionData,
  deleteExpiredSessions
} = require('@services/sessionService');
const logger = require('@services/loggerService');

// A provider may deliver the same callback many times (LiqPay retries ~15+
// times over a couple of hours). Each genuine "paid but ticket not delivered"
// failure would send a fresh admin alert, flooding the inbox (the 2026-08-18
// incident: one ticket, 15+ identical alerts). Remember which transactions
// we've already emailed about and alert at most once each — every failure is
// still logged. Best-effort and in-memory; the real prevention is atomic
// ticket creation. Bounded so a long-running process can't grow the set
// without limit.
const alertedTransactionIds = new Set();
const ALERTED_TX_CAP = 1000;

function markAndCheckAlerted(transactionId) {
  // An unknown id can't be de-duplicated — let it through so we never swallow
  // a real alert.
  if (transactionId == null) return false;
  if (alertedTransactionIds.has(transactionId)) return true;
  if (alertedTransactionIds.size >= ALERTED_TX_CAP) {
    // Evict the oldest entry (insertion order) to bound memory.
    const oldest = alertedTransactionIds.values().next().value;
    alertedTransactionIds.delete(oldest);
  }
  alertedTransactionIds.add(transactionId);
  return false;
}

/**
 * Handles a verified payment callback ({ data, signature } in LiqPay's payload
 * shape): for a successful payment it creates the ticket (idempotent per
 * transaction), renders the per-passenger PDFs and emails them. Throws for a
 * failed/declined payment (no ticket is owed) or when delivery fails — in the
 * latter case the admin is alerted once per transaction.
 *
 * The caller must verify the signature first.
 */
async function processPaymentCallback({ data, signature }) {
  // Captured as we go so the failure alert/log below can identify the paid
  // order even when the error is thrown mid-way through processing.
  const alertCtx = { transactionId: null, orderId: null, email: null };
  // Only true once the payment is confirmed successful (past getSessionData).
  // Providers also call back for FAILED/expired payments; getSessionData
  // rejects those, and we must NOT alert the admin about them — no ticket is
  // owed. The alert is strictly for "paid but ticket delivery failed".
  let paymentSucceeded = false;
  // Set once the PDF + email have actually been sent. Lets the catch alert
  // ONLY on a genuine delivery failure — a later step throwing (e.g.
  // deleteExpiredSessions) can't produce a false "not sent" alert.
  let ticketDelivered = false;
  try {
    const decodedData = Buffer.from(data, 'base64').toString('utf-8');
    const parsedData = decodePayload(data);
    alertCtx.transactionId = parsedData?.transaction_id ?? null;

    // Get session data (throws for non-success payment status)
    const { sessionInfoData, order_id } = await getSessionData(parsedData);
    alertCtx.orderId = order_id ?? null;
    const {
      email,
      passengersInfo,
      selectedBusFlight,
      children: numOfChildren,
      adults: numOfAdults,
      originId,
      destinationId,
      startDate,
      endDate
    } = sessionInfoData;
    alertCtx.email = email ?? null;
    // Payment is confirmed successful from here on.
    paymentSucceeded = true;

    // Prepare passenger data for email
    const passangersData = preparePassengerDataForEmail(passengersInfo);

    // Get or create ticket
    const ticket = await getOrCreateTicket({
      transactionId: parsedData?.transaction_id,
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
      createTicketFn: createTicket
    });

    // Ensure PDF exists and send email
    await ensureTicketPDFAndSendEmail({
      ticket,
      signature,
      email,
      passangersData,
      selectedBusFlight,
      transactionId: ticket?.transactionId,
      orderId: order_id,
      getTicketSubjectFn: getTicketSubject
    });
    // PDF + email confirmed sent — anything failing after this is not a
    // delivery failure and must not alert.
    ticketDelivered = true;

    // Cleanup expired sessions
    await deleteExpiredSessions();

    return { ticket };
  } catch (err) {
    if (paymentSucceeded && !ticketDelivered) {
      // Payment was captured but ticket delivery (ticket creation, PDF render,
      // or email) never completed — the case worth alerting on. Every failure
      // is logged; the admin is emailed only once per transaction so repeated
      // callbacks for the same order can't flood the inbox.
      const alreadyAlerted = markAndCheckAlerted(alertCtx.transactionId);
      logger.logError(err, {
        scope: 'payment-callback',
        ...alertCtx,
        alreadyAlerted
      });
      if (!alreadyAlerted) {
        // Best-effort: never let alerting mask the original error.
        sendAdminAlertMail({
          subject: `⚠️ Квиток не надіслано — платіж ${alertCtx.transactionId}`,
          text:
            `Платіж пройшов, але доставка квитка не вдалася.\n\n` +
            `transaction_id: ${alertCtx.transactionId}\n` +
            `order_id: ${alertCtx.orderId ?? '—'}\n` +
            `email: ${alertCtx.email ?? '—'}\n\n` +
            `Помилка: ${err?.message ?? err}\n\n` +
            `Перегенеруйте PDF і надішліть квиток вручну через адмін-панель.`
        }).catch((alertErr) =>
          logger.error(
            `[ALERT] failed to send failure alert: ${alertErr.message}`
          )
        );
      }
    } else {
      // Not an undelivered-ticket failure: either a failed/expired payment
      // callback (status !== 'success', payment not confirmed) or a post-
      // delivery step throwing after the ticket was already sent. Neither
      // warrants an admin alert — just record it.
      logger.logPayment('payment callback error (no alert)', {
        transactionId: alertCtx.transactionId,
        paymentSucceeded,
        ticketDelivered,
        reason: err?.message
      });
    }
    throw err;
  }
}

module.exports = { processPaymentCallback };

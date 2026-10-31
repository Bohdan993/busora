import { PHONE_PATTERN } from 'src/helpers/phone';
import { isOneWayTicket } from 'src/helpers';
import { type TicketPassenger, type Ticket } from 'src/types/tickets';
import { type Passenger, type Child } from 'src/types/passengers';
import dayjs from 'dayjs';

function validateRequired(value: string) {
  return !!value.length;
}

function validateEmail(email: string) {
  return (
    !!email.length &&
    email
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      )
  );
}

function validatePhone(phone: string) {
  return !!phone.length && PHONE_PATTERN.test(phone);
}

const REQUIRED_MSG = "Поле обов'язкове";

// Fallback loyalty-card discount ids used only when the caller doesn't pass the
// dynamic set. Callers should pass the ids of the `discount-card` discount group
// (from GET /discounts) so the requirement matches the column's editability.
const DISCOUNT_CARD_IDS = ['10', '11'];

const isFilled = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== '-';
  }
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return !!value;
};

// A real payment is a positive amount; 0 / empty / "-" count as "not paid".
const isPaid = (value: any): boolean =>
  value !== null &&
  value !== undefined &&
  String(value).trim() !== '' &&
  Number(value) > 0;

const isValidDate = (value: any): boolean =>
  isFilled(value) && dayjs(value).isValid();

// Single source of truth for per-field ticket validation. Returns an error
// message ('' = valid). Cross-field rules (payments) and conditional rules
// (discount card, return leg) read sibling values from the passed ticket.
function getTicketFieldError(
  field: string,
  ticket: Partial<Ticket>,
  discountCardIds: string[] = DISCOUNT_CARD_IDS
): string {
  const value = (ticket as Record<string, any>)[field];
  switch (field) {
    // Always required
    case 'ticketNumber':
    case 'lastName':
    case 'name':
    case 'type':
    case 'currency':
    case 'status':
    case 'passengerType':
    case 'origin':
    case 'destination':
    case 'busFlightFrom':
      return isFilled(value) ? '' : REQUIRED_MSG;

    // Required dates
    case 'dateOfCreature':
    case 'dateOfDeparture':
    case 'dateOfBirth':
      return isValidDate(value) ? '' : REQUIRED_MSG;

    // Payments: each required only if the other is empty
    case 'paymentOnBus':
      return !isPaid(ticket.paymentOnBus) && !isPaid(ticket.paymentAtOffice)
        ? REQUIRED_MSG
        : '';
    case 'paymentAtOffice':
      return !isPaid(ticket.paymentAtOffice) && !isPaid(ticket.paymentOnBus)
        ? REQUIRED_MSG
        : '';

    // Discount-card number required only for loyalty-card (discount-card group)
    // discounts — same id set the column uses to enable the field.
    case 'discountCardNumber':
      return discountCardIds.includes(
        String((ticket.passengerDiscount as any)?.id)
      ) && !isFilled(ticket.discountCardNumber)
        ? REQUIRED_MSG
        : '';

    // Return leg: required unless the ticket type has no return
    case 'dateOfReturn':
      return !isOneWayTicket(ticket.type || '') && !isValidDate(value)
        ? REQUIRED_MSG
        : '';
    case 'busFlightTo':
      return !isOneWayTicket(ticket.type || '') && !isFilled(value)
        ? REQUIRED_MSG
        : '';

    // Not required: passengerDiscount, discount, phone, additionalPhone,
    // email, price (calculated), agent, busSeat, note
    default:
      return '';
  }
}

// Create-form validator. Enforces the user-provided required fields.
// ticketNumber / dateOfCreature are backend-generated and passengerType is
// derived, so they are not enforced at create time.
function validateTicket(
  ticket: Ticket,
  discountCardIds: string[] = DISCOUNT_CARD_IDS
) {
  const fields = [
    'type',
    'dateOfDeparture',
    'origin',
    'destination',
    'busFlightFrom',
    'currency',
    'status',
    'lastName',
    'name',
    'dateOfBirth',
    'paymentOnBus',
    'paymentAtOffice',
    'discountCardNumber',
    'dateOfReturn',
    'busFlightTo'
  ];
  const validator: Record<string, string> = {};
  fields.forEach((field) => {
    validator['mrt-row-create_' + field] = getTicketFieldError(
      field,
      ticket,
      discountCardIds
    );
  });

  // Adult passengers must have a phone — the backend rejects them otherwise
  // ("phone is required for adult passengers"). Children skip it.
  const isChild = String(ticket.passengerType) === 'child';
  if (!isChild) {
    const phone = String(ticket.phone ?? '');
    validator['mrt-row-create_phone'] = !validateRequired(phone)
      ? 'Поле "Телефон" обов\'язкове'
      : !validatePhone(phone)
      ? 'Введіть коректний номер телефону'
      : '';
  }

  // Email is optional (backend allows null) — only validate the format when one
  // is provided.
  const email = String(ticket.email ?? '');
  validator['mrt-row-create_email'] =
    email && !validateEmail(email) ? 'Введіть коректну Email адресу' : '';

  return validator;
}

function validatePassenger(passenger: Passenger) {
  const validator = {
    'mrt-row-create_name': !validateRequired(passenger.name)
      ? 'Поле "Ім\'я" обов\'язкове'
      : '',
    'mrt-row-create_lastName': !validateRequired(passenger.lastName)
      ? 'Поле "Прізвище" обов\'язкове'
      : '',
    'mrt-row-create_dateOfBirth': !validateRequired(
      dayjs(passenger.dateOfBirth).isValid()
        ? passenger.dateOfBirth.toString()
        : ''
    )
      ? 'Поле "Дата народження" обов\'язкове'
      : '',
    'mrt-row-create_phone': !validateRequired(passenger.phone)
      ? 'Поле "Телефон" обов\'язкове'
      : !validatePhone(passenger.phone)
      ? 'Введіть коректний номер телефону'
      : '',
    'mrt-row-create_additionalPhone':
      passenger.additionalPhone?.length &&
      !validatePhone(passenger.additionalPhone)
        ? 'Введіть коректний номер телефону'
        : '',
    'mrt-row-create_email': !validateRequired(passenger.email)
      ? 'Поле "Email" обов\'язкове'
      : !validateEmail(passenger.email)
      ? 'Введіть коректну Email адресу'
      : ''
  };
  return validator;
}

function validateTicketInPassenger(
  ticket: TicketPassenger | Ticket,
  passengerId: string
) {
  const validator = {
    [passengerId + '_' + 'mrt-row-create_type']: !validateRequired(ticket.type)
      ? 'Поле "Тип квитка" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_dateOfDeparture']: !validateRequired(
      dayjs(ticket.dateOfDeparture).isValid()
        ? ticket.dateOfDeparture.toString()
        : ''
    )
      ? 'Поле "Дата відправлення" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_origin']: !validateRequired(
      String(ticket.origin)
    )
      ? 'Поле "Пункт відправлення" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_destination']: !validateRequired(
      String(ticket.destination)
    )
      ? 'Поле "Пункт прибуття" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_busFlightFrom']: !validateRequired(
      String(ticket.busFlightFrom)
    )
      ? 'Поле "Рейс відправлення" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_price']: !validateRequired(
      String(ticket.price)
    )
      ? 'Поле "Ціна" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_currency']: !validateRequired(
      ticket.currency
    )
      ? 'Поле "Валюта" обов\'язкове'
      : '',
    [passengerId + '_' + 'mrt-row-create_status']: !validateRequired(
      ticket.status
    )
      ? 'Поле "Cтатус" обов\'язкове'
      : ''
  };
  if (!isOneWayTicket(ticket.type)) {
    //@ts-ignore
    validator[passengerId + '_' + 'mrt-row-create_dateOfReturn'] =
      ticket.dateOfReturn !== null &&
      !validateRequired(
        dayjs(ticket.dateOfReturn).isValid()
          ? ticket.dateOfReturn.toString()
          : ''
      )
        ? 'Поле "Дата повернення" обов\'язкове'
        : '';
    //@ts-ignore
    validator[passengerId + '_' + 'mrt-row-create_busFlightTo'] =
      ticket.busFlightTo !== null &&
      !validateRequired(String(ticket.busFlightTo))
        ? 'Поле "Рейс повернення" обов\'язкове'
        : '';
  }
  return validator;
}

function validatePassengerInTicket(
  passenger: Child | Passenger,
  ticketId: string
) {
  const validator = {
    [ticketId + '_' + 'mrt-row-create_name']: !validateRequired(passenger.name)
      ? 'Поле "Ім\'я" обов\'язкове'
      : '',
    [ticketId + '_' + 'mrt-row-create_lastName']: !validateRequired(
      passenger.lastName
    )
      ? 'Поле "Прізвище" обов\'язкове'
      : '',
    [ticketId + '_' + 'mrt-row-create_dateOfBirth']: !validateRequired(
      dayjs(passenger.dateOfBirth).isValid()
        ? passenger.dateOfBirth.toString()
        : ''
    )
      ? 'Поле "Дата народження" обов\'язкове'
      : ''
  };

  if (passenger.passengerType === 'adult') {
    //@ts-ignore
    validator[ticketId + '_' + 'mrt-row-create_phone'] = !validateRequired(
      passenger.phone
    )
      ? 'Поле "Телефон" обов\'язкове'
      : !validatePhone(passenger.phone)
      ? 'Введіть коректний номер телефону'
      : '';
    //@ts-ignore
    validator[ticketId + '_' + 'mrt-row-create_additionalPhone'] =
      passenger.additionalPhone?.length &&
      !validatePhone(passenger.additionalPhone)
        ? 'Введіть коректний номер телефону'
        : '';
    //@ts-ignore
    validator[ticketId + '_' + 'mrt-row-create_email'] = !validateRequired(
      passenger.email
    )
      ? 'Поле "Email" обов\'язкове'
      : !validateEmail(passenger.email)
      ? 'Введіть коректну Email адресу'
      : '';
  }
  return validator;
}

function validatePassengerSearchSelect(passenger: Passenger, ticketId: string) {
  const validator = {
    [ticketId]:
      !Object.keys(passenger).length ||
      !validateRequired(passenger?.passengerId || '')
        ? "Поле обов'язкове"
        : ''
  };

  return validator;
}

function validateTicketSearchSelect(
  ticket: TicketPassenger,
  passengerId: string
) {
  const validator = {
    [passengerId]:
      !Object.keys(ticket).length || !validateRequired(ticket?.ticketId || '')
        ? "Поле обов'язкове"
        : ''
  };

  return validator;
}

export {
  validateRequired,
  validateEmail,
  validatePhone,
  validateTicket,
  getTicketFieldError,
  validatePassenger,
  validatePassengerInTicket,
  validateTicketInPassenger,
  validatePassengerSearchSelect,
  validateTicketSearchSelect
};

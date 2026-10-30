import { z, ZodTypeAny } from 'zod';
import { type MRT_RowData } from 'material-react-table';
import dayjs from 'dayjs';

const zodInputStringPipe = (zodPipe: ZodTypeAny) => {
  return (
    z
      .string({ required_error: "Поле обов'язкове" })
      .transform((value) => {
        return value === '' ? -1 : Number(value);
      })
      // .nullable()
      // .refine((value) => { return value === null || isNaN(Number(value))}, {
      //   message: 'Поле має бути числом',
      // })
      // .transform((value) => {return (value === null ? -1 : Number(value))})
      .pipe(zodPipe)
  );
};

const hashCode = (str: string) => {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

// const orderObjectKeys = (unordered: Record<string, any>): Record<string, any> => {
//   return Object.keys(unordered)
//     .sort()
//     .reduce((obj: Record<string, any>, key: string) => {
//       if(typeof unordered[key] === 'object' && !Array.isArray(unordered[key]) && unordered[key] !== null) {
//         obj[key] = orderObjectKeys(unordered[key]);
//       } else {
//         obj[key] = unordered[key];
//       }
//       return obj;
//     }, {});
// };

function orderArrays(unordered: any[]): any[] {
  const ordered: any[] = [];

  unordered.forEach((el, ind) => {
    if (typeof el === 'object' && el !== null && !Array.isArray(el)) {
      ordered[ind] = orderObjectKeys(el);
    } else if (Array.isArray(el)) {
      ordered[ind] = orderArrays(el);
    } else {
      ordered[ind] = el;
    }
  });

  return ordered.sort((a, b) => (a - b ? a - b : 0));
}

function orderObjectKeys(unordered: Record<string, any>): Record<string, any> {
  const ordered: Record<string, any> = {};

  Object.keys(unordered)
    .sort()
    .forEach((key) => {
      if (Array.isArray(unordered[key])) {
        ordered[key] = orderArrays(unordered[key]);
      } else if (
        typeof unordered[key] === 'object' &&
        unordered[key] !== null
      ) {
        ordered[key] = orderObjectKeys(unordered[key]);
      } else {
        ordered[key] = unordered[key];
      }
    });

  return ordered;
}

const isOneWayTicket = (type: string) => {
  if (
    ['відкритадата', 'воднусторону'].includes(
      type.replace(/\s/g, '').toLowerCase()
    )
  )
    return true;
  return false;
};

function debounce<T extends (...args: any[]) => void>(
  func: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), ms);
  };
}

function makeErrorResultMessage({
  addIsError,
  createIsError,
  deleteIsError,
  updateIsError,
  generateIsError,
  sendIsError,
  downloadIsError,
  passengerId,
  ticketId: ticketIdParam,
  ticketNumber,
  type
}: {
  addIsError?: boolean;
  createIsError?: boolean;
  deleteIsError?: boolean;
  updateIsError?: boolean;
  generateIsError?: boolean;
  downloadIsError?: boolean;
  sendIsError?: boolean;
  passengerId?: string;
  ticketId?: string;
  ticketNumber?: string;
  type: string;
}) {
  // Prefer the human-facing ticket number; fall back to the booking id.
  const ticketId = ticketNumber || ticketIdParam;
  if (type === 'ticket') {
    return `Виникла помилка при ${
      deleteIsError
        ? 'видаленні'
        : updateIsError
        ? 'редагуванні'
        : createIsError
        ? 'створенні'
        : generateIsError
        ? 'генерації'
        : sendIsError
        ? 'надсиланні'
        : downloadIsError
        ? 'завантаженні'
        : ''
    } квитка${
      deleteIsError ||
      updateIsError ||
      generateIsError ||
      sendIsError ||
      downloadIsError
        ? ' з номером ' + ticketId + ''
        : ''
    }!`;
  }

  if (type === 'passenger') {
    return `Виникла помилка при ${
      deleteIsError
        ? 'видаленні'
        : updateIsError
        ? 'редагуванні'
        : createIsError
        ? 'створенні'
        : ''
    } пасажира${
      deleteIsError || updateIsError ? ' з id ' + passengerId + '' : ''
    }!`;
  }

  if (type === 'passengerticket') {
    return `Виникла помилка при ${
      deleteIsError
        ? 'видаленні пасажира з id ' +
          passengerId +
          ' із квитка з номером ' +
          ticketId +
          ''
        : addIsError
        ? 'додаванні пасажира з id ' +
          passengerId +
          ' до квитка з номером ' +
          ticketId +
          ''
        : generateIsError
        ? 'генерації квитка з номером ' + ticketId
        : ''
    }!`;
  }

  if (type === 'ticketpassenger') {
    return `Виникла помилка при ${
      deleteIsError
        ? 'видаленні пасажира з id ' +
          passengerId +
          ' із квитка з номером ' +
          ticketId +
          ''
        : addIsError
        ? 'додаванні пасажира з id ' +
          passengerId +
          ' до квитка з номером ' +
          ticketId +
          ''
        : ''
    }!`;
  }

  return '';
}

function makeSuccessResultMessage({
  addIsSuccess,
  createIsSuccess,
  deleteIsSuccess,
  updateIsSuccess,
  generateIsSuccess,
  downloadIsSuccess,
  sendIsSuccess,
  passengerId,
  ticketId: ticketIdParam,
  ticketNumber,
  type
}: {
  addIsSuccess?: boolean;
  createIsSuccess?: boolean;
  deleteIsSuccess?: boolean;
  updateIsSuccess?: boolean;
  generateIsSuccess?: boolean;
  sendIsSuccess?: boolean;
  downloadIsSuccess?: boolean;
  passengerId?: string;
  ticketId?: string;
  ticketNumber?: string;
  type: string;
}) {
  // Prefer the human-facing ticket number; fall back to the booking id.
  const ticketId = ticketNumber || ticketIdParam;
  if (type === 'ticket') {
    return `Квиток ${
      deleteIsSuccess || updateIsSuccess || generateIsSuccess || sendIsSuccess
        ? ' з номером ' + ticketId + ''
        : ''
    } успішно ${
      deleteIsSuccess
        ? 'видалений'
        : updateIsSuccess
        ? 'відредагований'
        : createIsSuccess
        ? 'створений'
        : generateIsSuccess
        ? 'згенерований'
        : sendIsSuccess
        ? 'надісланий'
        : downloadIsSuccess
        ? 'завантажений'
        : ''
    }!`;
  }

  if (type === 'passenger') {
    return `Пасажир ${
      deleteIsSuccess || updateIsSuccess ? ' з id ' + passengerId + '' : ''
    } успішно ${
      deleteIsSuccess
        ? 'видалений'
        : updateIsSuccess
        ? 'відредагований'
        : createIsSuccess
        ? 'створений'
        : ''
    }!`;
  }

  if (type === 'passengerticket') {
    return `${generateIsSuccess ? 'Квиток' : 'Пасажир'} з id ${
      generateIsSuccess ? ticketId : passengerId
    } успішно ${
      deleteIsSuccess
        ? 'видалений із квитка з номером ' + ticketId
        : addIsSuccess
        ? 'доданий до квитка з номером ' + ticketId
        : generateIsSuccess
        ? 'згенерований'
        : ''
    }!`;
  }

  if (type === 'ticketpassenger') {
    return `Пасажир ${passengerId ? 'з id ' + passengerId : ''} успішно ${
      deleteIsSuccess
        ? 'видалений із квитка з номером ' + ticketId
        : addIsSuccess
        ? 'доданий до квитка з номером ' + ticketId
        : ''
    }!`;
  }

  return '';
}

const transformTicketBusFlightToString = <TData extends MRT_RowData>(
  originalRow: TData,
  key: 'busFlightFrom' | 'busFlightTo' | string
) => {
  return originalRow[key] && dayjs(originalRow[key]?.dateOfDeparture).isValid()
    ? `${originalRow[key]?.name} (${dayjs(
        originalRow[key]?.dateOfDeparture
      ).format('DD-MM-YYYY')}) (${
        originalRow[key]?.freeSeats + ' вільних місць'
      }) (${
        originalRow[key]?.discount
          ? 'Акційна знижка ' + originalRow[key]?.discount + '%'
          : 'Без знижки'
      })`
    : '';
};

z.setErrorMap((issue, ctx) => {
  if (
    issue.code === 'invalid_type' &&
    issue.expected === 'object' &&
    (issue.received === 'null' || issue.received === 'undefined')
  )
    return { message: "Поле обов'язкове" };
  return { message: ctx.defaultError };
});

export {
  zodInputStringPipe,
  hashCode,
  isOneWayTicket,
  orderObjectKeys,
  debounce,
  makeSuccessResultMessage,
  makeErrorResultMessage,
  transformTicketBusFlightToString
};

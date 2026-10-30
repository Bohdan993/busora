import type { MRT_Row } from 'material-react-table';
import type { Ticket } from 'src/types/tickets';

export interface ColumnHelpers {
  validationErrors: Record<string, string | undefined>;
  validationErrorsExist: Record<string, boolean>;
  setCurrId: (id: string) => void;
  setEditedTicket: (ticket: Record<string, Ticket>) => void;
  updateValidationError: (key: string, error: string | undefined) => void;
}

export const checkIfCellIsDisabled = ({
  row,
  validationErrorsExist,
  validationErrors,
  columnName
}: {
  row: MRT_Row<Ticket>;
  validationErrorsExist: Record<string, boolean>;
  validationErrors: Record<string, string | undefined>;
  columnName: string;
}): boolean => {
  const ticketId = row.original.ticketId;
  const isError = validationErrorsExist[ticketId || ''];
  return (
    isError && !validationErrors?.[ticketId + '_' + row.id + '_' + columnName]
  );
};

export const getCellBackgroundColor = (
  row: MRT_Row<Ticket>,
  columnName: string,
  validationErrorsExist: Record<string, boolean>,
  validationErrors: Record<string, string | undefined>,
  theme: any,
  alwaysDisabled = false
) => {
  const isError = validationErrorsExist[row?.id];
  const shouldBeDisabled =
    (isError && !validationErrors?.[row.id + '_' + columnName]) ||
    alwaysDisabled;

  return shouldBeDisabled ? theme.colors.alpha.black[30] : 'inherit';
};

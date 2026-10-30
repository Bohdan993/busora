import {
  useState,
  useMemo,
  useEffect,
  Dispatch,
  SetStateAction,
  // type ChangeEvent,
  type FocusEvent
} from 'react';
import {
  useMaterialReactTable,
  MaterialReactTable,
  MRT_EditActionButtons,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_TableInstance,
  type MRT_TableOptions,
  createRow
} from 'material-react-table';
import { MRT_Localization_UK } from 'material-react-table/locales/uk';
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
  Stack
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs, { type Dayjs } from 'dayjs';
import { EditDatepicker } from 'src/components/EditDatepicker';
import { type Discount } from 'src/types/discounts';
import {
  type ChildTicket,
  type PassengerTicket,
  type PassengerDiscount,
  type PassengerOption
} from 'src/types/passengers';
import { type Ticket } from 'src/types/tickets';
import {
  useAddTicketPassengerMutation,
  useDeleteTicketPassengerMutation,
  type AddTicketPassenger
} from 'src/services/ticket';
import {
  validatePassengerInTicket,
  validateRequired,
  validateEmail,
  validatePhone
} from 'src/helpers/validators';
import { PassengersSearchAutocomplete } from 'src/components/PassengersSearchAutocomplete';
// import { EditTextFieldDebounced } from 'src/components/EditTextFieldDebounced';
import {
  PositionedSnackbar,
  type SnackbarState
} from 'src/components/PositionedSnackbar';
import { makeErrorResultMessage, makeSuccessResultMessage } from 'src/helpers';
import { MaskedPhoneInput } from 'src/components/MaskedPhoneInput';
interface CreateEditedTicketArgs {
  row: MRT_Row<PassengerTicket | ChildTicket>;
  table: MRT_TableInstance<PassengerTicket | ChildTicket>;
  ticket: Ticket;
  passengers: PassengerTicket[];
  passengersChildren: ChildTicket[] | [];
  columnName: string;
  value: any;
}

interface PassengersSubTableProps {
  data: {
    ticket: Ticket;
    passengers: PassengerTicket[];
    passengersChildren: ChildTicket[] | [];
    discounts: Discount[];
    ticketId: string | undefined;
  };
  error: boolean;
  action: 'edit' | 'delete' | 'create' | null;
  validationErrors: Record<string, string | undefined>;
  validationErrorsExist: Record<string, boolean>;
  setAction: Dispatch<SetStateAction<'edit' | 'delete' | 'create' | null>>;
  // setAdultsPassengersValues: Dispatch<
  //   SetStateAction<Record<string, PassengerTicket[] | null>>
  // >;
  // setChildrenPassengersValues: Dispatch<
  //   SetStateAction<Record<string, ChildTicket[] | null>>
  // >;
  setCurrTicketId: Dispatch<SetStateAction<string>>;
  setEdit: Dispatch<
    SetStateAction<Record<string, PassengerTicket | ChildTicket>>
  >;
  setValidationErrors: Dispatch<
    SetStateAction<Record<string, string | undefined>>
  >;
}

function createEditedTicket({
  row,
  table,
  ticket,
  passengers,
  passengersChildren,
  columnName,
  value
}: CreateEditedTicketArgs) {
  const rows = table.getRowModel().rows;
  const passenger = rows.find(
    (el) => el._valuesCache.passengerId === row._valuesCache.passengerId
  )?._valuesCache;

  const passengerIndex =
    row.original.passengerType === 'adult'
      ? passengers.findIndex(
          (el) => el.passengerId === row._valuesCache.passengerId
        )
      : passengersChildren.findIndex(
          (el) => el.passengerId === row._valuesCache.passengerId
        );

  const children = passengersChildren.map((el) => {
    return rows.find(
      (elem) => String(elem._valuesCache.passengerId) === String(el.passengerId)
    )?._valuesCache;
  });
  const adults = passengers.map((el) => {
    return rows.find(
      (elem) => String(elem._valuesCache.passengerId) === String(el.passengerId)
    )?._valuesCache;
  });

  const editedTicket =
    row.original.passengerType === 'adult'
      ? {
          ...ticket,
          passengers: ~passengerIndex
            ? [
                ...adults.slice(0, passengerIndex),
                { ...passenger, [columnName]: value },
                ...adults.slice(passengerIndex + 1)
              ]
            : [...adults],
          children
        }
      : {
          ...ticket,
          passengers: adults,
          children: ~passengerIndex
            ? [
                ...children.slice(0, passengerIndex),
                { ...passenger, [columnName]: value },
                ...children.slice(passengerIndex + 1)
              ]
            : [...children]
        };

  return editedTicket;
}

function checkIfMaskedPhoneInputIsDisabled({
  row,
  addNewPassenger,
  validationErrorsExist,
  validationErrors,
  ticketId,
  columnName
}: {
  row: MRT_Row<PassengerTicket | ChildTicket>;
  addNewPassenger: 'adult' | 'child' | 'adult-new' | null;
  validationErrorsExist: Record<string, boolean>;
  validationErrors: Record<string, string | undefined>;
  ticketId: string | undefined;
  columnName: string;
}) {
  if (addNewPassenger && addNewPassenger !== 'adult-new') return true;
  if (row.original.passengerType === 'adult' && !addNewPassenger) {
    const isError = validationErrorsExist[ticketId || ''];
    return (
      isError && !validationErrors?.[ticketId + '_' + row.id + '_' + columnName]
    );
  }

  return false;
}

const PassengersSubTable = ({
  data: { ticket, passengers, passengersChildren, discounts, ticketId },
  error,
  action,
  validationErrors,
  validationErrorsExist,
  // setAdultsPassengersValues,
  // setChildrenPassengersValues,
  setEdit,
  setValidationErrors,
  setCurrTicketId,
  setAction
}: PassengersSubTableProps) => {
  const [open, setOpen] = useState(false);
  const [passengersDiscountValues, setPassengersDiscountValues] = useState<
    Record<string, PassengerDiscount | null>
  >(
    Object.fromEntries([
      ...passengers.map((el) => [el.passengerId, el.passengerDiscount]),
      ...passengersChildren.map((el) => [el.passengerId, el.passengerDiscount])
    ])
  );
  const [editedTicket, setEditedTicket] = useState<Ticket>({} as Ticket);

  const [snackBarState, setSnackBarState] = useState<SnackbarState>({
    open: false,
    vertical: 'bottom',
    horizontal: 'right',
    message: '',
    severity: 'info'
  });
  const [addNewPassenger, setAddNewPassenger] = useState<
    'adult' | 'child' | 'adult-new' | null
  >(null);
  const [currId, setCurrId] = useState('0');
  // const [currPassengerType, setCurrPassengerType] = useState<'adult' | 'child'>(
  //   'adult'
  // );
  const [addFn, addResult] = useAddTicketPassengerMutation();
  const [deleteFn, deleteResult] = useDeleteTicketPassengerMutation();

  const {
    isError: addIsError,
    isSuccess: addIsSuccess,
    isLoading: addIsLoading,
    error: addError,
    data: addData,
    reset: addReset
  } = addResult;

  const {
    isError: deleteIsError,
    isSuccess: deleteIsSuccess,
    isLoading: deleteIsLoading,
    error: deleteError,
    data: deleteData,
    reset: deleteReset
  } = deleteResult;

  const initialData = useMemo(
    () => [...passengers, ...passengersChildren],
    [passengers, passengersChildren, addIsError, deleteIsError, error]
  );

  const columns = useMemo<MRT_ColumnDef<PassengerTicket | ChildTicket>[]>(
    () => [
      {
        accessorKey: 'passengerId',
        header: 'ID',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        // enableColumnPinning: false,
        // enableRowPinning: false,
        enableEditing: false,
        minSize: 40,
        maxSize: 140,
        size: 80,
        muiTableBodyCellProps: () => {
          return {
            sx: (theme) => ({
              backgroundColor: theme.colors.alpha.black[30]
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.passengerType;
        },
        id: 'passengerType',
        header: 'Тип пасажира',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableColumnPinning: false,
        // enableRowPinning: false,
        enableEditing: false,
        minSize: 60,
        maxSize: 240,
        size: 120,
        Cell: ({ cell }) => {
          return cell.getValue<string>() === 'adult'
            ? // <Box>
              //   <FaceIcon fontSize='large' />
              // </Box>
              'Дорослий'
            : // <Box>
              //   <ChildCareIcon fontSize='large' />
              // </Box>
              'Дитина';
        },
        muiTableBodyCellProps: () => {
          return {
            sx: (theme) => ({
              backgroundColor: theme.colors.alpha.black[30]
            })
          };
        }
      },
      {
        accessorKey: 'name',
        header: "Ім'я",
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          if (addNewPassenger === 'child' || addNewPassenger === 'adult-new')
            return true;
          if (!addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[ticketId + '_' + row.id + '_name'])
            );
          }
          return false;
        },
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       debounceMs={850}
        //       cell={cell}
        //       table={table}
        //       textFieldProps={{
        //         type: 'text',
        //         required: true,
        //         error: !!validationErrors?.[ticketId + '_' + cell.id],
        //         helperText: validationErrors?.[ticketId + '_' + cell.id],
        //         onChange: (event: ChangeEvent<HTMLInputElement>) => {
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : undefined;
        //           setValidationErrors(prev => ({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));

        //           const editedTicket = createEditedTicket({
        //             row,
        //             table,
        //             ticket,
        //             passengers,
        //             passengersChildren,
        //             columnName: 'name',
        //             value: event.target.value});

        //             setEditedTicket(editedTicket as Ticket);
        //             setCurrTicketId(ticketId || '0');

        //         },
        //       }}
        //     />
        //   )
        // },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: true,
          error: !!validationErrors?.[ticketId + '_' + cell.id],
          helperText: validationErrors?.[ticketId + '_' + cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : undefined;
            setValidationErrors((prev) => ({
              ...prev,
              [ticketId + '_' + cell.id]: validationError
            }));

            // const editedTicket = createEditedTicket({
            //   row,
            //   table,
            //   ticket,
            //   passengers,
            //   passengersChildren,
            //   columnName: 'name',
            //   value: event.target.value,
            // });

            // setEditedTicket(editedTicket as Ticket);

            setEdit({
              [ticketId + '_' + row.id]: {
                ...row._valuesCache,
                name: event.target.value
              }
            });
            setCurrTicketId(ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                /*row.original.passengerType === 'adult' || */ isError &&
                !validationErrors?.[ticketId + '_' + row.id + '_name']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'lastName',
        header: 'Прізвище',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          if (addNewPassenger === 'child' || addNewPassenger === 'adult-new')
            return true;
          if (!addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[ticketId + '_' + row.id + '_lastName'])
            );
          }
          return false;
        },
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       debounceMs={850}
        //       cell={cell}
        //       table={table}
        //       textFieldProps={{
        //         type: 'text',
        //         required: true,
        //         error: !!validationErrors?.[ticketId + '_' + cell.id],
        //         helperText: validationErrors?.[ticketId + '_' + cell.id],
        //         onChange: (event: ChangeEvent<HTMLInputElement>) => {
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : undefined;
        //           setValidationErrors(prev => ({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));
        //           const editedTicket = createEditedTicket({
        //             row,
        //             table,
        //             ticket,
        //             passengers,
        //             passengersChildren,
        //             columnName: 'lastName',
        //             value: event.target.value});

        //             setEditedTicket(editedTicket as Ticket);
        //             setCurrTicketId(ticketId || '0');

        //         },
        //       }}

        //     />
        //   )
        // },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: true,
          error: !!validationErrors?.[ticketId + '_' + cell.id],
          helperText: validationErrors?.[ticketId + '_' + cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : undefined;
            setValidationErrors((prev) => ({
              ...prev,
              [ticketId + '_' + cell.id]: validationError
            }));

            const editedTicket = createEditedTicket({
              row,
              table,
              ticket,
              passengers,
              passengersChildren,
              columnName: 'lastName',
              value: event.target.value
            });

            setEditedTicket(editedTicket as Ticket);
            setCurrTicketId(ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                /*row.original.passengerType === 'adult' || */ isError &&
                !validationErrors?.[ticketId + '_' + row.id + '_lastName']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return dayjs(originalRow.dateOfBirth).startOf('day').utc(true);
        },
        id: 'dateOfBirth',
        columnFilterModeOptions: [
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        // filterVariant: 'date',
        enableEditing: (row) => {
          if (addNewPassenger === 'child' || addNewPassenger === 'adult-new')
            return true;
          if (!addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[ticketId + '_' + row.id + '_dateOfBirth'])
            );
          }
          return false;
        },
        // columnFilterModeOptions: [
        //   'equals',
        //   'between',
        //   'greaterThan',
        //   'lessThan',
        //   'greaterThanOrEqualTo',
        //   'lessThanOrEqualTo',
        // ], //only allow these filter modes
        header: 'Дата народження',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            dayjs(cell.getValue<Dayjs>()).format('DD-MM-YYYY') || ''
          );
        },
        Edit({ cell, table, row }) {
          return (
            <EditDatepicker
              cell={cell}
              table={table}
              disabled={false}
              textFieldProps={{
                onChange: (value: string) => {
                  const validationError = !validateRequired(value)
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors({
                    ...validationErrors,
                    [ticketId + '_' + cell.id]: validationError
                  });
                  const editedTicket = createEditedTicket({
                    row,
                    table,
                    ticket,
                    passengers,
                    passengersChildren,
                    columnName: 'dateOfBirth',
                    value
                  });

                  setEditedTicket(editedTicket as Ticket);
                  setCurrTicketId(ticketId || '0');
                },
                required: true,
                error: !!validationErrors?.[ticketId + '_' + cell.id],
                helperText: validationErrors?.[ticketId + '_' + cell.id]
              }}
            />
          );
        },
        muiFilterDatePickerProps: {
          slotProps: {
            textField: {
              placeholder: 'ДД-ММ-РРРР'
            }
          }
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                /*row.original.passengerType === 'adult' || */ isError &&
                !validationErrors?.[ticketId + '_' + row.id + '_dateOfBirth']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'phone',
        header: 'Телефон',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        // enableEditing: false,
        enableEditing: (row) => {
          if (addNewPassenger === 'adult-new') return true;
          if (row.original.passengerType === 'adult' && !addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[ticketId + '_' + row.id + '_phone'])
            );
          }

          return false;
        },
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        Edit({ cell, table, row }) {
          return (
            <MaskedPhoneInput
              cell={cell}
              table={table}
              textFieldProps={{
                type: 'text',
                required: true,
                error: !!validationErrors?.[ticketId + '_' + cell.id],
                helperText: validationErrors?.[ticketId + '_' + cell.id],
                // error: validationErrors?.[ticketId + '_' + cell.id] || undefined,
                disabled: checkIfMaskedPhoneInputIsDisabled({
                  row,
                  validationErrors,
                  validationErrorsExist,
                  addNewPassenger,
                  ticketId,
                  columnName: 'phone'
                }),
                onBlur: (value: string) => {
                  const cleanedValue = value?.replace(/\s/g, '');
                  const validationError = !validateRequired(cleanedValue)
                    ? "Поле обов'язкове"
                    : !validatePhone(cleanedValue)
                    ? 'Введіть коректний номер телефону'
                    : undefined;

                  setValidationErrors((prev) => ({
                    ...prev,
                    [ticketId + '_' + cell.id]: validationError
                  }));

                  const editedTicket = createEditedTicket({
                    row,
                    table,
                    ticket,
                    passengers,
                    passengersChildren,
                    columnName: 'phone',
                    value: cleanedValue
                  });

                  setEditedTicket(editedTicket as Ticket);
                  setCurrTicketId(ticketId || '0');
                }
              }}
            />
          );
        },
        // muiEditTextFieldProps: ({ cell, table, row }) => ({
        //   type: 'text',
        //   required: true,
        //   error: !!validationErrors?.[ticketId + '_' + cell.id],
        //   helperText: validationErrors?.[ticketId + '_' + cell.id],
        //   onBlur: (event: FocusEvent<HTMLInputElement>) => {
        //     const validationError = !validateRequired(event.target.value)
        //       ? 'Поле обов\'язкове'
        //       : undefined;
        //     setValidationErrors(prev => ({
        //       ...prev,
        //       [ticketId + '_' + cell.id]: validationError,
        //     }));

        //     const editedTicket = createEditedTicket({
        //       row,
        //       table,
        //       ticket,
        //       passengers,
        //       passengersChildren,
        //       columnName: 'phone',
        //       value: event.target.value});

        //       setEditedTicket(editedTicket as Ticket);
        //       setCurrTicketId(ticketId || '0');

        //   },
        // }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                row.original.passengerType === 'child' ||
                (isError &&
                  !validationErrors?.[ticketId + '_' + row.id + '_phone'])
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'additionalPhone',
        header: 'Дод. телефон',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        // enableEditing: false,
        enableEditing: (row) => {
          if (addNewPassenger === 'adult-new') return true;
          if (row.original.passengerType === 'adult' && !addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[
                  ticketId + '_' + row.id + '_additionalPhone'
                ])
            );
          }

          return false;
        },
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       enabled={() => {
        //         if(addNewPassenger === 'adult-new') return true;
        //         if(row.original.passengerType === 'adult' && !addNewPassenger) {
        //           const isError = validationErrorsExist[ticketId || ''];
        //           return !isError || (isError && !!validationErrors?.[ticketId + '_' + row.id + '_additionalPhone']);
        //         }

        //         return false;
        //       }}
        //       debounceMs={850}
        //       cell={cell}
        //       table={table}
        //       textFieldProps={{
        //         type: 'text',
        //         required: false,
        //         // error: !!validationErrors?.[ticketId + '_' + cell.id],
        //         // helperText: validationErrors?.[ticketId + '_' + cell.id],
        //         onChange: (event: ChangeEvent<HTMLInputElement>) => {
        //           // const validationError = !validateRequired(event.target.value)
        //           //   ? 'Поле обов\'язкове'
        //           //   : undefined;
        //           // setValidationErrors({
        //           //   ...validationErrors,
        //           //   [ticketId + '_' + cell.id]: validationError,
        //           // });

        //           const editedTicket = createEditedTicket({
        //             row,
        //             table,
        //             ticket,
        //             passengers,
        //             passengersChildren,
        //             columnName: 'additionalPhone',
        //             value: event.target.value});

        //             setEditedTicket(editedTicket as Ticket);
        //             setCurrTicketId(ticketId || '0');

        //         },
        //       }}
        //     />
        //   )
        // },
        Edit({ cell, table, row }) {
          return (
            <MaskedPhoneInput
              cell={cell}
              table={table}
              textFieldProps={{
                type: 'text',
                required: false,
                error: !!validationErrors?.[ticketId + '_' + cell.id],
                helperText: validationErrors?.[ticketId + '_' + cell.id],
                // error: validationErrors?.[ticketId + '_' + cell.id] || undefined,

                disabled: checkIfMaskedPhoneInputIsDisabled({
                  row,
                  validationErrors,
                  validationErrorsExist,
                  addNewPassenger,
                  ticketId,
                  columnName: 'additionalPhone'
                }),
                onBlur: (value: string) => {
                  const cleanedValue = value?.replace(/\s/g, '');
                  const validationError =
                    cleanedValue?.length && !validatePhone(cleanedValue)
                      ? 'Введіть коректний номер телефону'
                      : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [ticketId + '_' + cell.id]: validationError
                  }));

                  const editedTicket = createEditedTicket({
                    row,
                    table,
                    ticket,
                    passengers,
                    passengersChildren,
                    columnName: 'additionalPhone',
                    value: cleanedValue
                  });

                  setEditedTicket(editedTicket as Ticket);
                  setCurrTicketId(ticketId || '0');
                }
              }}
            />
          );
        },
        // muiEditTextFieldProps: ({ cell, table, row }) => ({
        //   type: 'text',
        //   required: false,
        //   error: !!validationErrors?.[ticketId + '_' + cell.id],
        //   helperText: validationErrors?.[ticketId + '_' + cell.id],
        //   onBlur: (event: FocusEvent<HTMLInputElement>) => {
        //     // const validationError = !validateRequired(event.target.value)
        //     //   ? 'Поле обов\'язкове'
        //     //   : undefined;
        //     // setValidationErrors(prev => ({
        //     //   ...prev,
        //     //   [ticketId + '_' + cell.id]: validationError,
        //     // }));

        //     const editedTicket = createEditedTicket({
        //       row,
        //       table,
        //       ticket,
        //       passengers,
        //       passengersChildren,
        //       columnName: 'additionalPhone',
        //       value: event.target.value});

        //       setEditedTicket(editedTicket as Ticket);
        //       setCurrTicketId(ticketId || '0');

        //   },
        // }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                row.original.passengerType === 'child' ||
                (isError &&
                  !validationErrors?.[
                    ticketId + '_' + row.id + '_additionalPhone'
                  ])
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'email',
        header: 'Email',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        minSize: 80,
        maxSize: 300,
        size: 160,
        // enableEditing: false,
        enableEditing: (row) => {
          if (addNewPassenger === 'adult-new') return true;
          if (row.original.passengerType === 'adult' && !addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[ticketId + '_' + row.id + '_email'])
            );
          }

          return false;
        },
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       enabled={() => {
        //         if(addNewPassenger === 'adult-new') return true;
        //         if(row.original.passengerType === 'adult' && !addNewPassenger) {
        //           const isError = validationErrorsExist[ticketId || ''];
        //           return !isError || (isError && !!validationErrors?.[ticketId + '_' + row.id + '_email']);
        //         }
        //         return false;
        //       }}
        //       debounceMs={850}
        //       cell={cell}
        //       table={table}
        //       textFieldProps={{
        //         type: 'text',
        //         required: true,
        //         error: !!validationErrors?.[ticketId + '_' + cell.id],
        //         helperText: validationErrors?.[ticketId + '_' + cell.id],
        //         onChange: (event: ChangeEvent<HTMLInputElement>) => {
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : !validateEmail(event.target.value) ? 'Введіть коректну Email адресу' : undefined;
        //           setValidationErrors(prev =>({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));

        //           const editedTicket = createEditedTicket({
        //             row,
        //             table,
        //             ticket,
        //             passengers,
        //             passengersChildren,
        //             columnName: 'email',
        //             value: event.target.value});

        //             setEditedTicket(editedTicket as Ticket);
        //             setCurrTicketId(ticketId || '0');

        //         },
        //       }}
        //     />
        //   )
        // },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: true,
          error: !!validationErrors?.[ticketId + '_' + cell.id],
          helperText: validationErrors?.[ticketId + '_' + cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : !validateEmail(event.target.value)
              ? 'Введіть коректну Email адресу'
              : undefined;
            setValidationErrors((prev) => ({
              ...prev,
              [ticketId + '_' + cell.id]: validationError
            }));

            const editedTicket = createEditedTicket({
              row,
              table,
              ticket,
              passengers,
              passengersChildren,
              columnName: 'email',
              value: event.target.value
            });

            setEditedTicket(editedTicket as Ticket);
            setCurrTicketId(ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                row.original.passengerType === 'child' ||
                (isError &&
                  !validationErrors?.[ticketId + '_' + row.id + '_email'])
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.passengerDiscount;
        },
        id: 'passengerDiscount',
        header: 'Знижка пасажира',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 100,
        maxSize: 400,
        size: 200,
        enableEditing: (row) => {
          if (addNewPassenger === 'child' || addNewPassenger === 'adult-new')
            return true;
          if (!addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[
                  ticketId + '_' + row.id + '_passengerDiscount'
                ])
            );
          }
          return false;
        },
        editVariant: 'select',
        Cell: ({ cell, row }) => {
          return (
            cell.getValue<PassengerDiscount>()?.name ||
            passengersDiscountValues[row.id]?.name ||
            ''
          );
        },
        editSelectOptions: ({ row }) => {
          return row.original.passengerType === 'adult'
            ? discounts.filter((discount) =>
                ['both', 'adults', 'discount-card'].includes(discount.group)
              )
            : discounts.filter((discount) =>
                ['both', 'children'].includes(discount.group)
              );
        },
        muiEditTextFieldProps: ({ table, row, cell }) => {
          const { setEditingCell } = table;
          return {
            select: true,
            onChange: (event) => {
              const selectedDiscount = discounts.find(
                (el) =>
                  el.value.toLowerCase() === event.target.value.toLowerCase()
              );
              const discountValue = selectedDiscount
                ? {
                    name: selectedDiscount?.value,
                    percentage:
                      Math.round(Number(selectedDiscount?.coef) * 100) || 0,
                    id: selectedDiscount?.id
                  }
                : null;
              setPassengersDiscountValues((prev) => ({
                ...prev,
                [row.id]: discountValue
              }));
              const editedTicket = createEditedTicket({
                row,
                table,
                ticket,
                passengers,
                passengersChildren,
                columnName: 'passengerDiscount',
                value: discountValue
              });

              setEditedTicket(editedTicket as Ticket);
              setCurrTicketId(ticketId || '0');
              setEditingCell(null);
            },
            value:
              cell.getValue<PassengerDiscount>()?.name ||
              passengersDiscountValues[row.id]?.name ||
              ''
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError &&
                !validationErrors?.[
                  ticketId + '_' + row.id + '_passengerDiscount'
                ]
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'discountCardNumber',
        id: 'discountCardNumber',
        header: 'Дисконтна карта',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          if (
            !discounts
              .filter((discount) => ['discount-card'].includes(discount.group))
              .map((discount) => discount.id)
              .includes(
                addNewPassenger
                  ? passengersDiscountValues[row.id]?.id || ''
                  : row.original.passengerDiscount?.id || ''
              )
          )
            return false;
          if (addNewPassenger === 'adult-new') return true;
          if (row.original.passengerType === 'adult' && !addNewPassenger) {
            const isError = validationErrorsExist[ticketId || ''];
            return (
              !isError ||
              (isError &&
                !!validationErrors?.[
                  ticketId + '_' + row.id + '_discountCardNumber'
                ])
            );
          }

          return false;
        },
        Cell: ({ cell }) => {
          return validationErrors?.[ticketId + '_' + cell.id] ? (
            <Box sx={{ color: 'red' }}>
              {validationErrors?.[ticketId + '_' + cell.id]}
            </Box>
          ) : (
            cell.getValue<string>()
          );
        },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: false,
          error: !!validationErrors?.[ticketId + '_' + cell.id],
          helperText: validationErrors?.[ticketId + '_' + cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // const validationError = !validateRequired(event.target.value)
            // ? 'Поле обов\'язкове'
            // : undefined;
            // setValidationErrors({
            //   ...validationErrors,
            //   [ticketId + '_' + cell.id]: validationError,
            // });
            const editedTicket = createEditedTicket({
              row,
              table,
              ticket,
              passengers,
              passengersChildren,
              columnName: 'discountCardNumber',
              value: event.target.value
            });

            setEditedTicket(editedTicket as Ticket);
            setCurrTicketId(ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[ticketId || ''];
          return {
            sx: (theme) => ({
              backgroundColor:
                row.original.passengerType === 'child' ||
                (isError &&
                  !validationErrors?.[
                    ticketId + '_' + row.id + '_discountCardNumber'
                  ]) ||
                !discounts
                  .filter((discount) =>
                    ['discount-card'].includes(discount.group)
                  )
                  .map((discount) => discount.id)
                  .includes(
                    addNewPassenger
                      ? passengersDiscountValues[row.id]?.id || ''
                      : row.original.passengerDiscount?.id || ''
                  )
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      }
    ],
    [
      discounts,
      validationErrors,
      validationErrorsExist,
      passengersDiscountValues,
      action,
      passengers,
      passengersChildren,
      addNewPassenger
    ]
  );

  const [columnFilterFns, _] = useState(
    Object.fromEntries(
      columns.map(({ accessorKey, id }) => {
        if (id === 'dateOfBirth') {
          return [id, 'equals'];
        }

        return [accessorKey, 'contains'];
      })
    )
  );

  //DELETE action
  // const openDeleteConfirmModal = (row: MRT_Row<PassengerTicket | ChildTicket>) => {
  //   setCurrId(row.original.passengerId || '0');
  //   setCurrPassengerType(row.original.passengerType || '');
  // };

  const openDeleteConfirmModal = (
    row: MRT_Row<PassengerTicket | ChildTicket>
  ) => {
    // if(!actionState) setActionState('delete');
    setCurrId(row.original?.passengerId || '0');

    // if(Number(currId) && actionState === 'delete') {
    async function deletePassenger() {
      if (
        window.confirm(
          `Ви впевнені, що хочете видалити пасажира з id ${
            row.original?.passengerId || '0'
          } із квитка з id ${ticketId}?`
        )
      ) {
        await deleteFn({
          id: row?.original?.passengerId || '0',
          ticketId: ticketId || '',
          type: row.original?.passengerType || ''
        });
      }
    }
    deletePassenger();
    return;
    // }
  };

  const handleDialogOpen = () => {
    setOpen(true);
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  const handleSnackBarOpen = (newState: SnackbarState) => {
    setSnackBarState({ ...newState });
  };

  const handleSnackBarClose = () => {
    setSnackBarState({
      ...snackBarState,
      open: false
    });
  };

  const handleCreatePassenger: MRT_TableOptions<
    ChildTicket | PassengerTicket
  >['onCreatingRowSave'] = async ({ values, row, table }) => {
    if (addNewPassenger !== 'adult') {
      const newValidationErrors = validatePassengerInTicket(
        values,
        ticketId || ''
      );

      if (Object.values(newValidationErrors).some((error) => error)) {
        setValidationErrors((prev) => {
          return { ...prev, ...newValidationErrors };
        });
        return;
      }

      setValidationErrors((prev) => {
        const entries = Object.entries(prev);
        const filteredEntries = entries.filter(
          (el) => !String(el[0]).includes('create')
        );
        return Object.fromEntries(filteredEntries);
      });
    }

    const selectedDiscount = discounts?.find(
      (el) =>
        String(el?.value).replace(/\s/g, '').toLowerCase() ===
        String(values?.passengerDiscount).replace(/\s/g, '').toLowerCase()
    );

    const body: AddTicketPassenger = {
      ticketId: ticketId || '',
      id: values?.passengerId || null,
      type: values.passengerType !== 'adult' ? 'child' : 'adult',
      data:
        addNewPassenger !== 'adult'
          ? {
              ...values,
              passengerDiscount: {
                id: selectedDiscount?.id || '',
                percentage:
                  Math.round(Number(selectedDiscount?.coef) * 100) || 0,
                name: selectedDiscount?.name || ''
              },
              discountCardNumber:
                !values?.discountCardNumber ||
                values?.discountCardNumber === '-'
                  ? null
                  : values?.discountCardNumber,
              passengerType:
                values.passengerType !== 'adult' ? 'child' : 'adult',
              dateOfBirth: dayjs(values?.dateOfBirth).format('YYYY-MM-DD')
            }
          : null
    };

    await addFn(body);
    setPassengersDiscountValues((prev) => {
      const target = {};
      for (let key in prev) {
        if (prev.hasOwnProperty(key)) {
          if (key === 'mrt-row-create') continue;
          //@ts-ignore
          target[key] = prev[key];
        }
      }
      return target;
    });
    setAddNewPassenger(null);
    table.setCreatingRow(null);
  };

  const handleAddNewAdultPassenger = (
    table: MRT_TableInstance<PassengerTicket | ChildTicket>
  ) => {
    table.setCreatingRow(null);
    if (!action) setAction('create');
    setAddNewPassenger('adult-new');
  };

  useEffect(() => {
    if (addNewPassenger) {
      switch (addNewPassenger) {
        case 'adult':
        case 'adult-new': {
          table.setCreatingRow(
            createRow(table, {
              passengerId: '',
              passengerType: 'adult',
              name: '',
              lastName: '',
              phone: '',
              additionalPhone: '',
              dateOfBirth: '',
              email: '',
              passengerDiscount: { id: '', percentage: 0, name: '' },
              discountCardNumber: null
            })
          );
          break;
        }
        case 'child': {
          table.setCreatingRow(
            createRow(table, {
              passengerId: '',
              //@ts-ignore
              passengerType: 'child',
              name: '',
              lastName: '',
              // phone: '',
              // additionalPhone: '',
              dateOfBirth: '',
              // email: '',
              passengerDiscount: { id: '', percentage: 0, name: '' }
              // discountCardNumber: null
            })
          );
          break;
        }
        default: {
          break;
        }
      }
    }
  }, [addNewPassenger]);

  useEffect(() => {
    if (addIsSuccess || deleteIsSuccess) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: makeSuccessResultMessage({
          addIsSuccess,
          deleteIsSuccess,
          passengerId: currId,
          ticketId,
          type: 'ticketpassenger'
        }),
        open: true,
        severity: 'success'
      });
      {
        addReset();
        deleteReset();
      }
      setCurrId('0');
      setEditedTicket({} as Ticket);
      setEdit({});
      if (action) setAction(null);
    }
  }, [addIsSuccess, deleteIsSuccess]);

  useEffect(() => {
    if (deleteIsError || addIsError) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `${makeErrorResultMessage({
          addIsError,
          deleteIsError,
          passengerId: currId,
          ticketId,
          type: 'ticketpassenger'
        })} ${JSON.stringify(addError || deleteError, null, 2)}`,
        open: true,
        severity: 'error'
      });
      {
        addReset();
        deleteReset();
      }
      setCurrId('0');
      setEditedTicket({} as Ticket);
      setEdit({});
      if (action) setAction(null);
    }
  }, [deleteIsError, addIsError]);

  // useEffect(() => {

  //   if (editedTicket && !Object.keys(editedTicket).length) return;
  //   setAdultsPassengersValues({ [ticketId || '0']: editedTicket?.passengers || [] });
  //   setChildrenPassengersValues({ [ticketId || '0']: editedTicket?.children || [] });
  //   setEdit({ [ticketId || '0']: editedTicket as Ticket });

  // }, [editedTicket]);

  const table = useMaterialReactTable({
    // autoResetPageIndex: false,
    columns: columns,
    // defaultDisplayColumn: {columnDefType: 'display'},
    createDisplayMode: 'modal', // ('modal', and 'custom' are also available)
    data: initialData ?? [],
    defaultColumn: {
      minSize: 20,
      maxSize: 180,
      size: 100
    },
    enableBottomToolbar: false,
    editDisplayMode: 'cell', // ('modal', 'row', 'cell', and 'custom', 'table' are also
    enableColumnFilterModes: true,
    enableColumnPinning: false,
    enableRowPinning: false,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd', //instead of the default "onChange" mode
    enableEditing: true,
    enableExpanding: false,
    enableExpandAll: false,
    enableFullScreenToggle: false,
    enableGlobalFilter: false,
    enableMultiSort: false,
    enablePagination: false,
    enableRowActions: true,
    enableStickyFooter: true,
    enableStickyHeader: true,
    getRowId: (row) => {
      return row.passengerId || '';
    },
    initialState: {
      columnVisibility: {
        passengerId: false
        // isPDFExists: false
      },
      showColumnFilters: false,
      density: 'compact',
      columnPinning: { left: ['mrt-row-actions'] }
    },
    isMultiSortEvent: () => false,
    localization: {
      ...MRT_Localization_UK
      // filterCustomFilterFn: 'Custom Filter Fn'
    },
    manualPagination: false,
    // muiCreateRowModalProps:{
    //   sx: {
    //     maxWidth: '600px'
    //   }
    // },
    muiBottomToolbarProps: {
      sx: {
        minHeight: '3.5rem!important'
      }
    },
    muiTableHeadRowProps: {
      sx: (theme) => ({
        backgroundColor:
          theme.palette.mode === 'dark'
            ? 'rgba(255,210,244,0.1)'
            : theme.palette.secondary.light
      })
    },
    muiFilterDatePickerProps: {
      format: 'DD-MM-YYYY',
      timezone: 'UTC'
    },
    muiTableBodyRowProps: {
      sx: (theme) => ({
        backgroundColor:
          theme.palette.mode === 'dark'
            ? 'rgba(255,210,244,0.1)'
            : theme.palette.primary.light
      })
    },
    muiTableBodyCellProps: {
      sx: (theme) => ({
        backgroundColor:
          theme.palette.mode === 'dark'
            ? 'rgba(255,210,244,0.1)'
            : theme.palette.primary.light
        // paddingTop: 0,
        // paddingBottom: 0
      })
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: 'clamp(350px, calc(100vh - 375px), 9999px)'
      }
    },
    // muiPaginationProps: {
    //   rowsPerPageOptions: validPageSizes,
    //   showFirstButton: true,
    //   showLastButton: true,
    // },
    muiTopToolbarProps: {
      sx: {
        minHeight: '3.5rem!important'
      }
    },
    onCreatingRowCancel: () => {
      setValidationErrors((prev) => {
        const entries = Object.entries(prev);
        const filteredEntries = entries.filter(
          (el) => !String(el[0]).includes('create')
        );
        return Object.fromEntries(filteredEntries);
      });
      setPassengersDiscountValues((prev) => {
        const target = {};
        for (let key in prev) {
          if (prev.hasOwnProperty(key)) {
            if (key === 'mrt-row-create') continue;
            //@ts-ignore
            target[key] = prev[key];
          }
        }
        return target;
      });
      setAddNewPassenger(null);
      setEditedTicket({} as Ticket);
      setEdit({});
      if (action) setAction(null);
    },
    onCreatingRowSave: handleCreatePassenger,
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => {
      if (
        row.original.passengerType === 'adult' &&
        addNewPassenger !== 'adult-new'
      ) {
        return (
          <>
            <DialogTitle variant="h3">Додати пасажира (дорослого)</DialogTitle>
            <DialogContent
              sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <Stack
                sx={{
                  gap: '18px',
                  paddingTop: '16px',
                  width: '100%'
                }}
              >
                <PassengersSearchAutocomplete
                  ticketId={ticketId || ''}
                  // passengersIds={[...passengers].map((el) => el?.passengerId || '')}
                  table={table}
                  row={row}
                  textFieldProps={{
                    onChange: (value: PassengerOption) => {
                      setCurrId(value?.passengerId || '0');
                    }
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    component="span"
                    sx={(theme) => ({
                      fontWeight: 600,
                      color: theme.colors.alpha.black[100]
                    })}
                  >
                    Або
                  </Typography>
                </Box>
                <Box>
                  <Button
                    onClick={() => handleAddNewAdultPassenger(table)}
                    variant="text"
                    disableRipple={true}
                    sx={(theme) => ({
                      color: theme.palette.secondary.dark,
                      textAlign: 'left',
                      justifyContent: 'start',
                      p: 0,
                      '&:hover': {
                        backgroundColor: 'transparent',
                        color: theme.palette.secondary.light
                      }
                    })}
                  >
                    Створити нового пасажира
                  </Button>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <MRT_EditActionButtons variant="text" table={table} row={row} />
            </DialogActions>
          </>
        );
      } else {
        return (
          <>
            <DialogTitle variant="h3">
              {addNewPassenger === 'adult-new'
                ? 'Додати пасажира (дорослого)'
                : 'Додати пасажира (дитину)'}
            </DialogTitle>
            <DialogContent
              sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              {internalEditComponents}
            </DialogContent>
            <DialogActions>
              <MRT_EditActionButtons variant="text" table={table} row={row} />
            </DialogActions>
          </>
        );
      }
    },
    renderRowActions: ({ row, table }) => (
      <Box
        sx={(theme) => ({
          display: 'flex',
          flexWrap: 'nowrap',
          gap: '8px',
          padding: 0
        })}
      >
        <Tooltip title="Видалити">
          <IconButton
            color="error"
            disabled={Object.values(validationErrorsExist).some(
              (error) => !!error
            )}
            onClick={() => openDeleteConfirmModal(row)}
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    renderTopToolbarCustomActions: ({ table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', p: '4px' }}>
          <Button
            sx={(theme) => ({
              mt: { xs: 2, md: 0 },
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255,210,244,0.1)'
                  : theme.palette.secondary.dark,
              '&:hover': {
                backgroundColor: theme.palette.secondary.light
              }
            })}
            variant="contained"
            // disabled={validationErrorsExist[ticketId || '']}
            disabled={Object.values(validationErrorsExist).some(
              (error) => !!error
            )}
            startIcon={<AddTwoToneIcon fontSize="small" />}
            onClick={() => {
              handleDialogOpen();
            }}
          >
            Додати пасажира
          </Button>
        </Box>
      );
    },
    positionActionsColumn: 'first',
    state: {
      isSaving: addIsLoading,
      //   isLoading,
      //   pagination,
      //   showAlertBanner: isError,
      //   showProgressBars: isFetching,
      //   columnFilters,
      columnFilterFns
      //   sorting
    }
  });

  return (
    <Card sx={{ width: '100%', borderRadius: 0 }}>
      <MaterialReactTable table={table} />
      <Dialog open={open} onClose={handleDialogClose}>
        <DialogTitle variant="h4">{'Оберіть тип пасажира'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={() => {
              handleDialogClose();
              if (!action) setAction('create');
              setAddNewPassenger('adult');
            }}
          >
            Дорослий
          </Button>
          <Button
            onClick={() => {
              handleDialogClose();
              if (!action) setAction('create');
              setAddNewPassenger('child');
            }}
          >
            Дитина
          </Button>
        </DialogContent>
      </Dialog>
      <PositionedSnackbar
        state={snackBarState}
        handleClose={handleSnackBarClose}
      />
    </Card>
  );
};

export default PassengersSubTable;

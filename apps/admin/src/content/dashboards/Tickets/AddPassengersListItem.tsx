import {
  useState,
  useMemo,
  useEffect,
  Dispatch,
  SetStateAction,
  type FocusEvent
} from 'react';
import {
  createRow,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row
} from 'material-react-table';
import { Card } from '@mui/material';
import { EditDatepicker } from 'src/components/EditDatepicker';
import { type Discount } from 'src/types/discounts';
import {
  type PassengerTicket,
  type ChildTicket,
  type PassengerDiscount
} from 'src/types/passengers';
import {
  validateRequired,
  validateEmail,
  validatePhone
} from 'src/helpers/validators';
import { AddPassengersForm } from './AddPassengersForm';
import { MaskedPhoneInput } from 'src/components/MaskedPhoneInput';
import dayjs from 'dayjs';

interface AddPassengersListItemProps {
  data: {
    passengersIds: string[];
    passenger: PassengerTicket | ChildTicket;
    discounts: Discount[];
    ticketId: string;
  };
  addNewPassenger: 'adult' | 'child' | null;
  // action: 'edit' | 'delete' | 'create' | null;
  orderNumber: number;
  currPassengerId: string;
  validationErrors: Record<string, string | undefined>;
  setAddNewPassenger: Dispatch<SetStateAction<'adult' | 'child' | null>>;
  // setAction: Dispatch<SetStateAction<'edit' | 'delete' | 'create' | null>>;
  setPassengers: Dispatch<SetStateAction<(PassengerTicket | ChildTicket)[]>>;
  setPassengersRows: Dispatch<
    SetStateAction<MRT_Row<PassengerTicket | ChildTicket>[]>
  >;
  setValidationErrors: Dispatch<
    SetStateAction<Record<string, string | undefined>>
  >;
}

export const AddPassengersListItem = ({
  data: { passengersIds, passenger, discounts, ticketId },
  addNewPassenger,
  // action,
  orderNumber,
  currPassengerId,
  validationErrors,
  setAddNewPassenger,
  setValidationErrors,
  setPassengers,
  setPassengersRows
}: // setAction
AddPassengersListItemProps) => {
  const [open, setOpen] = useState(false);
  const [passengersDiscountValues, setPassengersDiscountValues] = useState<
    Record<string, PassengerDiscount | null>
  >(Object.fromEntries([[ticketId, passenger.passengerDiscount]]));

  const columns = useMemo<MRT_ColumnDef<PassengerTicket | ChildTicket>[]>(
    () => [
      {
        accessorKey: 'passengerId',
        header: 'ID',
        enableEditing: false
      },
      {
        accessorKey: 'passengerType',
        header: 'Тип пасажира',
        enableEditing: false
      },
      {
        accessorKey: 'name',
        header: "Ім'я",
        enableEditing: (row) => {
          return (
            row.original?.passengerId?.startsWith('a_') ||
            row.original?.passengerId?.startsWith('c_') ||
            false
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       enabled={() => {
        //         return row.original.passengerId.startsWith('a_') || row.original.passengerId.startsWith('c_');
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
        //           if(!action) setAction('edit');
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : undefined;
        //           setValidationErrors(prev => ({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));
        //         },
        //       }}
        //     />
        //   )
        // },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: true,
          variant: 'standard',
          error: !!validationErrors?.[ticketId + '_' + cell.id],
          helperText: validationErrors?.[ticketId + '_' + cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // if(!action) setAction('edit');
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : undefined;
            setValidationErrors((prev) => ({
              ...prev,
              [ticketId + '_' + cell.id]: validationError
            }));
          }
        })
      },
      {
        accessorKey: 'lastName',
        header: 'Прізвище',
        enableEditing: (row) => {
          return (
            row.original?.passengerId?.startsWith('a_') ||
            row.original?.passengerId?.startsWith('c_') ||
            false
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       enabled={() => {
        //         return row.original.passengerId.startsWith('a_') || row.original.passengerId.startsWith('c_');
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
        //           if(!action) setAction('edit');
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : undefined;
        //           setValidationErrors(prev => ({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));
        //         },
        //       }}

        //     />
        //   )
        // },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: true,
          variant: 'standard',
          error: !!validationErrors?.[ticketId + '_' + cell.id],
          helperText: validationErrors?.[ticketId + '_' + cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // if(!action) setAction('edit');
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : undefined;
            setValidationErrors((prev) => ({
              ...prev,
              [ticketId + '_' + cell.id]: validationError
            }));
          }
        })
      },
      {
        accessorFn: (originalRow) => {
          return dayjs(originalRow.dateOfBirth).startOf('day').utc(true);
        },
        id: 'dateOfBirth',
        header: 'Дата народження',
        enableEditing: (row) => {
          return (
            row.original?.passengerId?.startsWith('a_') ||
            row.original?.passengerId?.startsWith('c_') ||
            false
          );
        },
        Edit({ cell, table, row }) {
          return (
            <EditDatepicker
              cell={cell}
              table={table}
              disabled={
                !(
                  row.original?.passengerId?.startsWith('a_') ||
                  row.original?.passengerId?.startsWith('c_')
                ) || false
              }
              textFieldProps={{
                onChange: (value: string) => {
                  // if(!action) setAction('edit');
                  const validationError = !validateRequired(value)
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [ticketId + '_' + cell.id]: validationError
                  }));
                },
                required: true,
                error: !!validationErrors?.[ticketId + '_' + cell.id],
                helperText: validationErrors?.[ticketId + '_' + cell.id]
              }}
            />
          );
        }
      },
      {
        accessorKey: 'phone',
        header: 'Телефон',
        enableEditing: (row) => {
          return (
            row.original.passengerType === 'adult' &&
            (row.original?.passengerId?.startsWith('a_') || false)
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       enabled={() => {
        //         return row.original.passengerType === 'adult' && row.original.passengerId.startsWith('a_');
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
        //           if(!action) setAction('edit');
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : undefined;
        //           setValidationErrors(prev => ({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));

        //         },
        //       }}
        //     />
        //   )
        // },
        // muiEditTextFieldProps: ({ cell, table, row }) => ({
        //   type: 'text',
        //   required: true,
        //   error: !!validationErrors?.[ticketId + '_' + cell.id],
        //   helperText: validationErrors?.[ticketId + '_' + cell.id],
        //   onBlur: (event: FocusEvent<HTMLInputElement>) => {
        //     if(!action) setAction('edit');
        //     const validationError = !validateRequired(event.target.value)
        //       ? 'Поле обов\'язкове'
        //       : undefined;
        //     setValidationErrors(prev => ({
        //       ...prev,
        //       [ticketId + '_' + cell.id]: validationError,
        //     }));

        //   },
        // }),
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
                disabled: !(
                  row.original.passengerType === 'adult' &&
                  row.original?.passengerId?.startsWith('a_')
                ),
                onBlur: (value: string) => {
                  // if(!action) setAction('edit');
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
                }
              }}
            />
          );
        }
      },
      {
        accessorKey: 'additionalPhone',
        header: 'Дод. телефон',
        enableEditing: (row) => {
          return (
            row.original.passengerType === 'adult' &&
            (row.original?.passengerId?.startsWith('a_') || false)
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //     enabled={() => {
        //       return row.original.passengerType === 'adult'  && row.original.passengerId.startsWith('a_');
        //     }}
        //       debounceMs={850}
        //       cell={cell}
        //       table={table}
        //       textFieldProps={{
        //         type: 'text',
        //         required: false,
        //         onChange: (event: ChangeEvent<HTMLInputElement>) => {
        //           if(!action) setAction('edit');
        //         },
        //       }}
        //     />
        //   )
        // },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: false,
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // if(!action) setAction('edit');
          }
        }),
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
                disabled: !(
                  row.original.passengerType === 'adult' &&
                  row.original?.passengerId?.startsWith('a_')
                ),
                onBlur: (value: string) => {
                  // if(!action) setAction('edit');
                  const cleanedValue = value?.replace(/\s/g, '');
                  const validationError =
                    cleanedValue?.length && !validatePhone(cleanedValue)
                      ? 'Введіть коректний номер телефону'
                      : undefined;

                  setValidationErrors((prev) => ({
                    ...prev,
                    [ticketId + '_' + cell.id]: validationError
                  }));
                }
              }}
            />
          );
        }
      },
      {
        accessorKey: 'email',
        header: 'Email',
        enableEditing: (row) => {
          return (
            (row.original.passengerType === 'adult' &&
              row.original?.passengerId?.startsWith('a_')) ||
            false
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       enabled={() => {
        //         return row.original.passengerType === 'adult'  && row.original.passengerId.startsWith('a_');
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
        //           if(!action) setAction('edit');
        //           const validationError = !validateRequired(event.target.value)
        //             ? 'Поле обов\'язкове'
        //             : !validateEmail(event.target.value) ? 'Введіть коректну Email адресу' : undefined;
        //           setValidationErrors(prev => ({
        //             ...prev,
        //             [ticketId + '_' + cell.id]: validationError,
        //           }));
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
            // if(!action) setAction('edit');
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : !validateEmail(event.target.value)
              ? 'Введіть коректну Email адресу'
              : undefined;
            setValidationErrors((prev) => ({
              ...prev,
              [ticketId + '_' + cell.id]: validationError
            }));
          }
        })
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.passengerDiscount;
        },
        id: 'passengerDiscount',
        header: 'Знижка пасажира',
        editVariant: 'select',
        editSelectOptions: ({ row }) => {
          return row.original.passengerType === 'adult'
            ? discounts.filter((discount) =>
                ['both', 'adults', 'discount-card'].includes(discount.group)
              )
            : discounts.filter((discount) =>
                ['both', 'children'].includes(discount.group)
              );
        },
        muiEditTextFieldProps: ({ row, cell }) => ({
          select: true,
          onChange: (event) => {
            // if(!action) setAction('edit');
            const selectedDiscount = discounts.find(
              (el) =>
                el.value.toLowerCase() === event.target.value.toLowerCase()
            );
            if (!['discount-card'].includes(selectedDiscount?.group || '')) {
              row._valuesCache.discountCardNumber = '-';
            }
            setPassengersDiscountValues((prev) => ({
              ...prev,
              [ticketId]: selectedDiscount
                ? {
                    name: selectedDiscount?.value,
                    percentage:
                      Math.round(Number(selectedDiscount?.coef) * 100) || 0,
                    id: selectedDiscount?.id
                    // discountCardNumber: null
                  }
                : null
            }));
          },
          value: passengersDiscountValues[ticketId]?.name || ''
        })
      },
      {
        accessorKey: 'discountCardNumber',
        header: 'Дисконтна карта',
        enableEditing: (row) => {
          return (
            row.original.passengerType === 'adult' &&
            discounts
              .filter((discount) => ['discount-card'].includes(discount.group))
              .map((discount) => discount.id)
              .includes(passengersDiscountValues[ticketId]?.id || '')
          );
        },
        // Edit({ cell, table, row }) {
        //   return (
        //     <EditTextFieldDebounced
        //       debounceMs={850}
        //       cell={cell}
        //       table={table}
        //       enabled={() => {
        //         // if(
        //         //   !(discounts.filter(discount => ['discount-card'].includes(discount.group))
        //         //             .map(discount => discount.id)
        //         //             .includes(addNewPassenger ? (passengersDiscountValues[row.id]?.id || '') : (row.original.passengerDiscount?.id || '')))
        //         // ) return false;
        //         // if(addNewPassenger === 'adult-new') return true;
        //         // if(row.original.passengerType === 'adult' && !addNewPassenger) {
        //         //   const isError = validationErrorsExist[ticketId || ''];
        //         //   return !isError || (isError && !!validationErrors?.[ticketId + '_' + row.id + '_discountCardNumber']);
        //         // }

        //         return false;
        //       }}
        //       textFieldProps={{
        //         type: 'text',
        //         required: true,
        //         error: !!validationErrors?.[cell.id],
        //         helperText: validationErrors?.[cell.id],
        //         onChange: (event: ChangeEvent<HTMLInputElement>) => {
        //           if(!action) setAction('edit');
        //         },
        //       }}

        //     />
        //   )
        // }
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: false,
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // if(!action) setAction('edit');
          }
        })
      }
    ],
    [discounts, validationErrors, addNewPassenger, passengersDiscountValues]
  );

  const handleDialogOpen = () => {
    setOpen(true);
  };

  const handleDialogClose = () => {
    setOpen(false);
  };

  const table = useMaterialReactTable({
    columns: columns,
    createDisplayMode: 'modal',
    data: [],
    editDisplayMode: 'cell', // ('modal', 'row', 'table', and 'custom' are also available)
    enableCellActions: false,
    enableClickToCopy: 'context-menu',
    enableColumnPinning: false,
    enableEditing: false,
    enableRowActions: false,
    getRowId: (row) => {
      return row.passengerId || '';
    },
    renderCreateRowDialogContent: () => {
      return null;
    }
  });

  const { getState, setCreatingRow } = table;
  const { creatingRow } = getState();

  useEffect(() => {
    setCreatingRow(createRow(table, passenger));
  }, []);

  useEffect(() => {
    if (
      addNewPassenger === 'adult' &&
      currPassengerId === passenger.passengerId
    ) {
      handleDialogOpen();
    }
  }, [addNewPassenger, currPassengerId, ticketId]);

  return (
    <Card sx={{ width: '100%', borderRadius: 0 }}>
      {creatingRow && (
        <AddPassengersForm
          open={open}
          handleClose={handleDialogClose}
          // handleAddNewAdultPassenger={handleAddNewAdultPassenger}
          passengersIds={passengersIds}
          currPassengerId={currPassengerId}
          setAddNewPassenger={setAddNewPassenger}
          ticketId={ticketId}
          orderNumber={orderNumber}
          setPassengers={setPassengers}
          setPassengersRows={setPassengersRows}
          table={table}
        />
      )}
    </Card>
  );
};

// export default AddPassengersListItem;

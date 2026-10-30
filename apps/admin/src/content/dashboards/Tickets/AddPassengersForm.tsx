import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import {
  MRT_EditCellTextField,
  type MRT_Row,
  type MRT_TableInstance
} from 'material-react-table';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  type PassengerTicket,
  type ChildTicket,
  type PassengerOption
} from 'src/types/passengers';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PassengersSearchAutocomplete } from 'src/components/PassengersSearchAutocomplete';
import {
  validatePassengerSearchSelect,
  validateRequired
} from 'src/helpers/validators';

interface AddPassengersFormProps {
  orderNumber: number;
  open: boolean;
  currPassengerId: string;
  handleClose: () => void;
  table: MRT_TableInstance<PassengerTicket | ChildTicket>;
  ticketId: string;
  setAddNewPassenger: Dispatch<SetStateAction<'adult' | 'child' | null>>;
  setPassengers: Dispatch<SetStateAction<(PassengerTicket | ChildTicket)[]>>;
  setPassengersRows: Dispatch<
    SetStateAction<MRT_Row<PassengerTicket | ChildTicket>[]>
  >;
  // handleAddNewAdultPassenger: () => void;
  passengersIds: string[];
}

export const AddPassengersForm = ({
  orderNumber,
  open,
  currPassengerId,
  handleClose,
  table,
  ticketId,
  passengersIds,
  setAddNewPassenger,
  setPassengers,
  setPassengersRows
}: AddPassengersFormProps) => {
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string | undefined>
  >({});
  const { getState } = table;
  const { creatingRow } = getState();

  const row = creatingRow as MRT_Row<PassengerTicket | ChildTicket>;

  const internalEditComponents = row
    .getAllCells()
    .filter((cell) => cell.column.columnDef.columnDefType === 'data')
    .map((cell) => (
      <MRT_EditCellTextField
        cell={cell as any}
        key={cell.id}
        table={table as any}
      />
    ));

  const handleAddPassenger = () => {
    const newValidationErrors = validatePassengerSearchSelect(
      row._valuesCache,
      ticketId
    );

    if (Object.values(newValidationErrors).some((error) => !!error)) {
      setValidationErrors((prev) => {
        return { ...prev, ...newValidationErrors };
      });
      return;
    }

    handleClose();
    setPassengers((prev) => {
      const prevFiltered = prev.filter(
        (el) => el.passengerId !== currPassengerId
      );
      const newPassenger = {
        passengerId: row._valuesCache.passengerId,
        passengerType: 'adult',
        name: row._valuesCache.name,
        lastName: row._valuesCache.lastName,
        phone: row._valuesCache.phone,
        additionalPhone: !(row._valuesCache.additionalPhone === '-')
          ? row._valuesCache.additionalPhone
          : '',
        dateOfBirth: row._valuesCache.dateOfBirth,
        email: row._valuesCache.email,
        passengerDiscount: row._valuesCache.passengerDiscount
      } as PassengerTicket;
      return [...prevFiltered, newPassenger];
    });
    setPassengersRows((prev) => {
      return [
        ...prev.filter((el) => el.original.passengerId !== currPassengerId)
      ];
    });
    setAddNewPassenger(null);
  };

  useEffect(() => {
    if (row) {
      setPassengersRows((prev) => {
        if (
          prev.some(
            (el) => el.original.passengerId === row.original.passengerId
          )
        )
          return [...prev];
        return [...prev, row];
      });
    }
  }, [row]);

  return (
    <>
      {!open ? (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            Пасажир {orderNumber} (
            {row.original.passengerType === 'adult' ? 'Дорослий' : 'Дитина'})
          </AccordionSummary>
          <AccordionDetails>
            <form onSubmit={(e) => e.preventDefault()}>
              <Stack
                sx={{
                  gap: '18px',
                  paddingTop: '16px',
                  width: '100%'
                }}
              >
                {internalEditComponents}
              </Stack>
            </form>
          </AccordionDetails>
        </Accordion>
      ) : (
        <Dialog
          open={open}
          onClose={() => {
            handleClose();
            setAddNewPassenger(null);
            setPassengers((prev) => {
              return prev.filter((el) => el.passengerId !== currPassengerId);
            });
            setPassengersRows((prev) => {
              return prev.filter(
                (el) => el.original.passengerId !== currPassengerId
              );
            });
          }}
        >
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
                ticketId={ticketId}
                // passengersIds={passengersIds}
                table={table}
                row={row}
                textFieldProps={{
                  required: true,
                  error: !!validationErrors?.[ticketId],
                  helperText: validationErrors?.[ticketId],
                  onChange: (value: PassengerOption) => {
                    const validationError = !validateRequired(
                      value ? value.toString() : ''
                    )
                      ? "Поле обов'язкове"
                      : undefined;
                    setValidationErrors((prev) => ({
                      ...prev,
                      [ticketId]: validationError
                    }));
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
                  onClick={() => {
                    handleClose();
                    setAddNewPassenger(null);
                  }}
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
            {/* <MRT_EditActionButtons variant='text' table={table} row={row} /> */}
            <>
              <Button
                onClick={() => {
                  handleClose();
                  setAddNewPassenger(null);
                  setPassengers((prev) => {
                    return prev.filter(
                      (el) => el.passengerId !== currPassengerId
                    );
                  });
                  setPassengersRows((prev) => {
                    return prev.filter(
                      (el) => el.original.passengerId !== currPassengerId
                    );
                  });
                }}
                sx={{ minWidth: '100px' }}
              >
                Скасувати
              </Button>
              <Button
                onClick={() => {
                  handleAddPassenger();
                }}
                // disabled={isSaving}
                sx={{ minWidth: '100px' }}
                variant="contained"
                type="submit"
                form="send-ticket-mail-form"
              >
                {/* {isSaving && <CircularProgress color='inherit' size={18} />} */}
                Додати
              </Button>
            </>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

// export default AddPassengersForm;

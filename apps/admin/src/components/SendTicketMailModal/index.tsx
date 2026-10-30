import { useState, useEffect } from 'react';

import { type MRT_RowData, type MRT_Row } from 'material-react-table';

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack
} from '@mui/material';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSendTicketMutation } from 'src/services/ticket';
import { type SnackbarState } from 'src/components/PositionedSnackbar';
import { makeSuccessResultMessage, makeErrorResultMessage } from 'src/helpers';
import { type PassengerTicket, type Passenger } from 'src/types/passengers';

interface SendTicketMailModalProps<TData extends MRT_RowData> {
  passenger?: Passenger | PassengerTicket;
  open: boolean;
  row: MRT_Row<TData> | null;
  handleSnackBarOpen: (newState: SnackbarState) => void;
  onClose: (value: string) => void;
}

const validationSchema = z.object({
  email: z
    .string({ required_error: "Поле обов'язкове" })
    .min(1, { message: "Поле обов'язкове" })
    .email({ message: 'Некоректний Email' })
});

type ValidationSchema = z.infer<typeof validationSchema>;

export const SendTicketMailModal = <TData extends MRT_RowData>({
  passenger,
  row,
  open,
  handleSnackBarOpen,
  onClose
}: SendTicketMailModalProps<TData>) => {
  const [emailValue, setEmailValue] = useState(
    passenger?.email || row?.original?.passengers?.[0]?.email || ''
  );
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors }
  } = useForm<ValidationSchema>({
    resolver: zodResolver(validationSchema)
  });

  const [sendFn, sendResult] = useSendTicketMutation();
  const {
    isError: sendIsError,
    isSuccess: sendIsSuccess,
    isLoading: sendIsLoading,
    error: sendError,
    data: sendData,
    reset: sendReset
  } = sendResult;
  const onSubmit: SubmitHandler<ValidationSchema> = async (data) => {
    // Attach only this passenger's PDF (the same passengerId download-pdf uses);
    // omitting it would fall back to the ticket-level PDF for all passengers.
    await sendFn({
      ...data,
      id: row?.original?.ticketId || '',
      passengerId: String(row?.original?.passengerId ?? '')
    });
  };

  const handleCancel = (val: string) => {
    onClose(val);
  };

  // useEffect(() => {
  //   setEmailValue(passenger?.email || row?.original?.passengers?.[0]?.email || '');
  // }, [row]);

  useEffect(() => {
    if (sendIsSuccess) {
      onClose('success');
      resetField('email');
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: makeSuccessResultMessage({
          sendIsSuccess,
          type: 'ticket',
          ticketId: row?.original?.ticketId || '0',
          ticketNumber: row?.original?.ticketNumber || ''
        }),
        open: true,
        severity: 'success'
      });
      {
        sendReset();
      }
    }
  }, [sendIsSuccess]);

  useEffect(() => {
    if (sendIsError) {
      onClose('fail');
      resetField('email');
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `${makeErrorResultMessage({
          sendIsError,
          type: 'ticket',
          ticketId: row?.original?.ticketId || '0',
          ticketNumber: row?.original?.ticketNumber || ''
        })} ${JSON.stringify(sendError, null, 2)}`,
        open: true,
        severity: 'error'
      });
      sendReset();
    }
  }, [sendIsError]);

  return (
    <Dialog
      onClose={(val) => {
        onClose(val.toString());
        resetField('email');
      }}
      open={open}
    >
      <DialogTitle variant="h3">Надіслати квиток на пошту</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <Stack
          sx={{
            gap: '32px',
            paddingTop: '16px',
            width: '100%'
          }}
        >
          <Box
            component="form"
            id="send-ticket-mail-form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            autoComplete="off"
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              autoComplete="email"
              autoFocus
              {...register('email')}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              error={!!errors?.email}
              helperText={errors.email?.message}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <>
          <Button
            onClick={() => {
              handleCancel('cancel');
              resetField('email');
            }}
            sx={{ minWidth: '100px' }}
          >
            Скасувати
          </Button>
          <Button
            disabled={sendIsLoading}
            sx={{ minWidth: '100px' }}
            variant="contained"
            type="submit"
            form="send-ticket-mail-form"
          >
            {sendIsLoading && <CircularProgress color="inherit" size={18} />}
            Надіслати
          </Button>
        </>
      </DialogActions>
    </Dialog>
  );
};

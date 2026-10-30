import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Box, Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { type PassengerTicket, type ChildTicket } from 'src/types/passengers';
import { type MRT_Row } from 'material-react-table';
import { type Discount } from 'src/types/discounts';
import { AddPassengersListItem } from './AddPassengersListItem';

interface AddPassengersListProps {
  // action: 'edit' | 'delete' | 'create' | null;
  discounts: Discount[];
  open: boolean;
  passengers: (PassengerTicket | ChildTicket)[];
  validationErrors: Record<string, string | undefined>;
  handleClose: () => void;
  // setAction: Dispatch<SetStateAction<'edit' | 'delete' | 'create' | null>>;
  setPassengers: Dispatch<SetStateAction<(PassengerTicket | ChildTicket)[]>>;
  setPassengersRows: Dispatch<
    SetStateAction<MRT_Row<PassengerTicket | ChildTicket>[]>
  >;
  setValidationErrors: Dispatch<
    SetStateAction<Record<string, string | undefined>>
  >;
}

export const AddPassengersList = ({
  // action,
  discounts,
  open,
  passengers,
  validationErrors,
  handleClose,
  // setAction,
  setPassengers,
  setPassengersRows,
  setValidationErrors
}: AddPassengersListProps) => {
  const [addNewPassenger, setAddNewPassenger] = useState<
    'adult' | 'child' | null
  >(null);
  const [currPassengerId, setCurrPassengerId] = useState('');
  const [passengersIds, setPassengersIds] = useState<string[]>([]);

  const handleAddNewAdultPassenger = () => {
    const passengerId = 'a_' + String(Date.now()).slice(-8);
    setPassengers((prev) => {
      const newPassenger = {
        passengerId: passengerId,
        passengerType: 'adult',
        name: '',
        lastName: '',
        phone: '',
        additionalPhone: '',
        dateOfBirth: '',
        email: '',
        passengerDiscount: { id: '', percentage: 0, name: '' },
        discountCardNumber: null
      } as PassengerTicket;

      return [...prev, newPassenger];
    });
    setCurrPassengerId(passengerId);
  };

  const handleAddNewChildPassenger = () => {
    const passengerId = 'c_' + String(Date.now()).slice(-8);
    setPassengers((prev) => {
      const newChild = {
        passengerId: passengerId,
        passengerType: 'child',
        name: '',
        lastName: '',
        phone: '',
        additionalPhone: '',
        dateOfBirth: '',
        email: '',
        passengerDiscount: { id: '', percentage: 0, name: '' },
        discountCardNumber: null
      } as ChildTicket;

      return [...prev, newChild];
    });
    setCurrPassengerId(passengerId);
  };

  useEffect(() => {
    const passengersIds = passengers
      .map((el) =>
        !el?.passengerId?.startsWith('a_') ? String(el.passengerId) : null
      )
      .filter(Boolean);
    setPassengersIds(passengersIds as string[]);
  }, [passengers]);

  return (
    <Box>
      {passengers.length
        ? passengers?.map((el, ind) => {
            return (
              <Box
                key={el.passengerId}
                sx={{
                  my: 2
                }}
              >
                <AddPassengersListItem
                  data={{
                    passengersIds: passengersIds,
                    passenger: el,
                    discounts: discounts,
                    ticketId: String('new' + el.passengerId)
                  }}
                  orderNumber={ind + 1}
                  currPassengerId={currPassengerId}
                  // action={action}
                  addNewPassenger={addNewPassenger}
                  validationErrors={validationErrors}
                  setAddNewPassenger={setAddNewPassenger}
                  setPassengers={setPassengers}
                  setPassengersRows={setPassengersRows}
                  setValidationErrors={setValidationErrors}
                  // setAction={setAction}
                />
              </Box>
            );
          })
        : 'Додайте першого пасажира...'}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle variant="h4">{'Оберіть тип пасажира'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            onClick={() => {
              handleClose();
              // if(!action) setAction('create');
              handleAddNewAdultPassenger();
              setAddNewPassenger('adult');
            }}
          >
            Дорослий
          </Button>
          <Button
            disabled={!passengers.length}
            onClick={() => {
              handleClose();
              // if(!action) setAction('create');
              handleAddNewChildPassenger();
              setAddNewPassenger('child');
            }}
          >
            Дитина
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

//   export default AddPassengersList;

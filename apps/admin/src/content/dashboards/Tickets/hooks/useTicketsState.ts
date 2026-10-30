import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import type {
  MRT_PaginationState,
  MRT_ColumnFiltersState,
  MRT_SortingState,
  MRT_Row
} from 'material-react-table';
import type { Ticket } from 'src/types/tickets';
import type { PassengerDiscount } from 'src/types/passengers';
import type { SnackbarState } from 'src/components/PositionedSnackbar';
import { VALID_PAGE_SIZES, type CustomSortingState } from '../constants';

export const useTicketsState = (initialData: Ticket[]) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  // Pagination
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: parseInt(params.get('pageIndex') || '0', 10) || 0,
    pageSize: (() => {
      const size = parseInt(params.get('pageSize') || '20', 10);
      return VALID_PAGE_SIZES.includes(size as any) ? size : 20;
    })()
  });

  // Sorting
  const [sorting, setSorting] = useState<MRT_SortingState>(
    JSON.parse(params.get('sorting') || 'null') || []
  );

  const [customSorting, setCustomSorting] = useState<CustomSortingState[]>(
    JSON.parse(params.get('customSorting') || 'null') || []
  );

  // Filtering
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    JSON.parse(params.get('filters') || 'null')?.map(
      (el: { id: string; value: any }) => el
    ) || []
  );

  // Date filters
  const [dateOfBirthValue, setDateOfBirthValue] = useState<Dayjs | null>(
    columnFilters?.find((el) => el.id === 'dateOfBirth')
      ? dayjs(
          columnFilters?.find((el) => el.id === 'dateOfBirth')?.value as any
        )
      : null
  );

  const [dateOfCreatureValue, setDateOfCreatureValue] = useState<Dayjs | null>(
    columnFilters?.find((el) => el.id === 'dateOfCreature')
      ? dayjs(
          columnFilters?.find((el) => el.id === 'dateOfCreature')?.value as any
        )
      : null
  );

  const [dateOfDepartureValue, setDateOfDepartureValue] =
    useState<Dayjs | null>(
      columnFilters?.find((el) => el.id === 'dateOfDeparture')
        ? dayjs(
            columnFilters?.find((el) => el.id === 'dateOfDeparture')
              ?.value as any
          )
        : null
    );

  const [dateOfReturnValue, setDateOfReturnValue] = useState<Dayjs | null>(
    columnFilters?.find((el) => el.id === 'dateOfReturn')
      ? dayjs(
          columnFilters?.find((el) => el.id === 'dateOfReturn')?.value as any
        )
      : null
  );

  // UI state
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [sendTicketModalOpen, setSendTicketModalOpen] = useState(false);
  const [sendTicketModalRow, setSendTicketModalRow] =
    useState<MRT_Row<Ticket> | null>(null);
  const [actionState, setActionState] = useState<
    'edit' | 'delete' | 'create' | null
  >(null);

  // Snackbar
  const [snackBarState, setSnackBarState] = useState<SnackbarState>({
    open: false,
    vertical: 'bottom',
    horizontal: 'right',
    message: '',
    severity: 'info'
  });

  // Editing state
  const [currId, setCurrId] = useState('0');
  const [editedTicket, setEditedTicket] = useState<Record<string, Ticket>>({});
  const [passengersDiscountValues, setPassengersDiscountValues] = useState<
    Record<string, PassengerDiscount | null>
  >(
    Object.fromEntries([
      ...initialData.map((el) => [el.ticketId, el.passengerDiscount])
    ])
  );

  // Free seats tracking
  const [numOfFreeSeats, setNumOfFreeSeats] = useState<{
    busFlightTo: number | null;
    busFlightFrom: number | null;
  }>({ busFlightTo: null, busFlightFrom: null });

  return {
    // Pagination
    pagination,
    setPagination,

    // Sorting
    sorting,
    setSorting,
    customSorting,
    setCustomSorting,

    // Filtering
    columnFilters,
    setColumnFilters,
    dateOfBirthValue,
    setDateOfBirthValue,
    dateOfCreatureValue,
    setDateOfCreatureValue,
    dateOfDepartureValue,
    setDateOfDepartureValue,
    dateOfReturnValue,
    setDateOfReturnValue,

    // UI state
    isFullScreen,
    setIsFullScreen,
    sendTicketModalOpen,
    setSendTicketModalOpen,
    sendTicketModalRow,
    setSendTicketModalRow,
    actionState,
    setActionState,
    snackBarState,
    setSnackBarState,

    // Editing state
    currId,
    setCurrId,
    editedTicket,
    setEditedTicket,
    passengersDiscountValues,
    setPassengersDiscountValues,
    numOfFreeSeats,
    setNumOfFreeSeats
  };
};

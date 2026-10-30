import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import RefreshIcon from '@mui/icons-material/Refresh';
import SortIcon from '@mui/icons-material/Sort';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';

import {
  Box,
  Button,
  Card,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';

import {
  MaterialReactTable,
  MRT_EditActionButtons,
  useMaterialReactTable,
  MRT_ToggleFiltersButton,
  MRT_ShowHideColumnsButton,
  MRT_ToggleDensePaddingButton,
  MRT_ToggleFullScreenButton,
  type MRT_ColumnDef,
  // type MRT_ColumnFiltersState,
  // type MRT_PaginationState,
  type MRT_Row,
  // type MRT_SortingState,
  type MRT_TableInstance,
  type MRT_TableOptions
} from 'material-react-table';

import { MRT_Localization_UK } from 'material-react-table/locales/uk';

import { PassengerSearchPhoneInput } from 'src/components/PassengerSearchPhoneInput';
import { EditBusFlightsSearchAutocomplete } from 'src/components/EditBusFlightsSearchAutocomplete';
import { EditCustomSelect } from 'src/components/EditCustomSelect';
import { EditDatepicker } from 'src/components/EditDatepicker';
import { AvailableDatesDatepicker } from 'src/components/AvailableDatesDatepicker';
import {
  PositionedSnackbar,
  type SnackbarState
} from 'src/components/PositionedSnackbar';
import { SendTicketMailModal } from 'src/components/SendTicketMailModal';
import { TopToolbarMenu } from './TopToolbarMenu';
import {
  AdditionalPassengersSection,
  validateAdditionalPassenger,
  type AdditionalPassenger,
  type AdditionalPassengerErrors
} from './AdditionalPassengersSection';
import { isOneWayTicket } from 'src/helpers';

// Local module imports
import {
  useTicketsData,
  useTicketsMutations,
  useTicketsState,
  useTicketsValidation
} from './hooks';
import {
  VALID_PAGE_SIZES,
  COLUMNS_DEFINITIONS,
  type CustomOrder
} from './constants';
import {
  transformTicket,
  transformTicketBusFlightToString,
  normalizeTicket,
  buildCreateTicketBody,
  validateRequired,
  validateEmail,
  validatePhone,
  isValidationErrorsExist,
  isUAHCurrency,
  currencySymbol
} from './utils';

import {
  hashCode,
  makeErrorResultMessage,
  makeSuccessResultMessage,
  orderObjectKeys
} from 'src/helpers';

import { validateTicket, getTicketFieldError } from 'src/helpers/validators';

import { useGetTicketsQuery } from 'src/services/ticket';

import { setFullScreen } from 'src/slices/appSlice';
import { useAppDispatch } from 'src/store/hooks';

import {
  type Ticket,
  type TicketBusFlight,
  type TicketCity,
  type CreateTicketBody
} from 'src/types/tickets';
import { type PassengerDiscount } from 'src/types/passengers';

import { type Discount } from 'src/types/discounts';
import 'react-phone-number-input/style.css';

// --- Column auto-sizing: fit each column to its header text ---------------
// Headers are rendered bold + uppercase (theme font is Inter). We measure the
// real rendered width with a canvas and add a fixed overhead for the sort icon
// and the column-actions (3-dot) button so the title is never truncated.
const HEADER_FONT =
  '700 14px "Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
const HEADER_ICON_OVERHEAD = 84; // sort + actions icons + cell padding

const headerMeasureCtx: CanvasRenderingContext2D | null =
  typeof document !== 'undefined'
    ? document.createElement('canvas').getContext('2d')
    : null;

const measureHeaderWidth = (header: string): number => {
  const text = (header || '').toUpperCase();
  if (headerMeasureCtx) {
    headerMeasureCtx.font = HEADER_FONT;
    // small per-glyph budget for the letter-spacing on uppercase headers
    return Math.ceil(
      headerMeasureCtx.measureText(text).width + text.length * 0.4
    );
  }
  return text.length * 10; // fallback if canvas is unavailable
};

// A promo discount (Акційна знижка) is "set" when it's a positive percentage.
// 0 / null / '' / 'Без знижки' all count as no promo discount.
const hasPromoDiscount = (discount: unknown): boolean =>
  discount !== null &&
  discount !== undefined &&
  String(discount).trim() !== '' &&
  Number(discount) > 0;

// A passenger discount (Знижка пасажира) is "set" when it carries a positive
// percentage. The two discounts are mutually exclusive (the backend lets a
// promo discount override the passenger one), so each disables the other.
const hasPassengerDiscount = (pd: unknown): boolean =>
  !!pd && typeof pd === 'object' && Number((pd as any).percentage) > 0;

// Current value of a field on a row being edited/created: prefer the live edit
// cache, fall back to the loaded row. Used for the dependent-field cascade
// (origin → destination → dates → busflights).
const fieldValue = (row: any, field: string): any =>
  row?._valuesCache?.[field] ?? row?.original?.[field];

const isCitySelected = (value: any): boolean =>
  !!(value && (typeof value === 'object' ? value.id : value));

const isDateSelected = (value: any): boolean =>
  !!value && dayjs(value).isValid();

// Money is displayed in UAH (the backend's canonical currency). The currency is
// shown in its own column, so no symbol is appended here.
// Empty / not-paid values render blank.
const formatUAH = (value: any): string =>
  value === null || value === undefined || value === '' ? '' : `${value}`;

// True for a filter value that carries no actual constraint: empty scalar, or a
// range array whose every slot is empty. MRT's range-filter `handleClear` writes
// `[undefined, undefined]` (an array, not `undefined`), which TanStack keeps as a
// live filter — it serializes to `[null, null]` and the backend's "between" then
// matches nothing. Treating these as empty lets us drop the filter outright.
const isEmptyFilterValue = (v: any): boolean => {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.every(isEmptyFilterValue);
  return false;
};

// Date-filter props that work in BOTH single-value modes (equals / greaterThan
// / …) and the two-input "between" range mode. In range mode MRT renders two
// pickers and passes `rangeFilterIndex` (0 = from, 1 = to); the filter value is
// a `[from, to]` array. Driving each picker straight off the column's own
// filter value (rather than one shared scalar) is what lets the two dates
// differ — a single shared state forced both inputs to the same value.
const buildDateFilterProps = ({
  column,
  rangeFilterIndex
}: {
  column: any;
  rangeFilterIndex?: number;
}) => {
  const isRange = rangeFilterIndex !== undefined;
  const filterValue = column.getFilterValue();
  const current = isRange
    ? Array.isArray(filterValue)
      ? filterValue[rangeFilterIndex as number] ?? null
      : null
    : filterValue ?? null;
  return {
    slotProps: { textField: { placeholder: 'ДД-ММ-РРРР' } },
    value: current ? dayjs(current) : null,
    onChange: (val: any) => {
      const value = val ? dayjs(val) : null;
      if (isRange) {
        const prev = Array.isArray(filterValue) ? [...filterValue] : [];
        prev[rangeFilterIndex as number] = value;
        column.setFilterValue(prev);
      } else {
        column.setFilterValue(value);
      }
    }
  };
};

const TicketsTable: FC = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<Ticket[] | []>([]);

  // Custom hooks - refactored for better organization
  const dataQueries = useTicketsData();
  const mutations = useTicketsMutations();
  const state = useTicketsState(initialData);
  const validation = useTicketsValidation();

  // Destructure data queries
  const { ticketAttributes, currencies, cities, discounts, agents } =
    dataQueries;
  const ticketAttributesData = ticketAttributes.data;
  const ticketAttributesIsLoading = ticketAttributes.isLoading;
  const currenciesData = currencies.data;
  const currenciesIsLoading = currencies.isLoading;
  const citiesData = cities.data;
  const citiesIsLoading = cities.isLoading;
  const discountsData = discounts.data;
  const discountsIsLoading = discounts.isLoading;
  // Single source of truth for "is a loyalty/discount-card discount": the ids of
  // the `discount-card` group. Drives both the column editability and the
  // discountCardNumber requirement in the validator (kept in sync).
  const discountCardIds = useMemo(
    () =>
      (discountsData?.data || [])
        .filter((discount: Discount) => discount.group === 'discount-card')
        .map((discount: Discount) => String(discount.id)),
    [discountsData?.data]
  );
  const refetchAttributes = ticketAttributes.refetch;
  const refetchCurrencies = currencies.refetch;
  const refetchCities = cities.refetch;
  const refetchDiscounts = discounts.refetch;
  const agentsData = agents.data;

  // Pending display values for the editable Агентство (agent) select, keyed by
  // row id — mirrors passengersDiscountValues for the discount select.
  const [agentValues, setAgentValues] = useState<Record<string, string>>({});

  // Extra passengers added in the create modal beyond the main create-row one.
  // The single create row supplies passenger #1; these are appended to the POST
  // body's passengers[]/children[]. Errors are keyed by passenger.key.
  const [additionalPassengers, setAdditionalPassengers] = useState<
    AdditionalPassenger[]
  >([]);
  const [additionalPassengerErrors, setAdditionalPassengerErrors] =
    useState<AdditionalPassengerErrors>({});

  // The ticketNumber of the row the current operation acts on, shown in the
  // success/error snackbar ("Квиток з номером …"). Set alongside currId.
  const [currTicketNumber, setCurrTicketNumber] = useState<string>('');

  // MRT doesn't always hand the table instance to a column's `Edit` when it
  // renders inside the create-row dialog (internalEditComponents), leaving the
  // busflight autocomplete with an undefined `table`. Keep a ref to the live
  // instance so those Edits can fall back to it.
  const tableInstanceRef = useRef<MRT_TableInstance<Ticket> | null>(null);

  // Destructure mutations
  const deleteFn = mutations.delete.mutate;
  const updateFn = mutations.update.mutate;
  const createFn = mutations.create.mutate;
  const generateFn = mutations.generate.mutate;
  const deletePdfFn = mutations.deletePdf.mutate;
  const downloadTicketFn = mutations.download.mutate;

  const createIsError = mutations.create.isError;
  const createIsSuccess = mutations.create.isSuccess;
  const createIsLoading = mutations.create.isLoading;
  const createError = mutations.create.error;
  const createReset = mutations.create.reset;

  const updateIsError = mutations.update.isError;
  const updateIsSuccess = mutations.update.isSuccess;
  const updateIsLoading = mutations.update.isLoading;
  const updateError = mutations.update.error;
  const updateReset = mutations.update.reset;

  const deleteIsError = mutations.delete.isError;
  const deleteIsSuccess = mutations.delete.isSuccess;
  const deleteIsLoading = mutations.delete.isLoading;
  const deleteError = mutations.delete.error;
  const deleteData = mutations.delete.data;
  const deleteReset = mutations.delete.reset;

  const generateIsError = mutations.generate.isError;
  const generateIsSuccess = mutations.generate.isSuccess;
  const generateIsLoading = mutations.generate.isLoading;
  const generateError = mutations.generate.error;
  const generateData = mutations.generate.data;
  const generateReset = mutations.generate.reset;

  const deletePdfIsLoading = mutations.deletePdf.isLoading;
  const deletePdfIsSuccess = mutations.deletePdf.isSuccess;
  const deletePdfIsError = mutations.deletePdf.isError;
  const deletePdfError = mutations.deletePdf.error;
  const deletePdfReset = mutations.deletePdf.reset;

  const downloadIsError = mutations.download.isError;
  const downloadIsSuccess = mutations.download.isSuccess;
  const downloadIsLoading = mutations.download.isLoading;
  const downloadError = mutations.download.error;
  const downloadData = mutations.download.data;
  const downloadReset = mutations.download.reset;

  // Destructure state
  const {
    pagination,
    setPagination,
    sorting,
    setSorting,
    customSorting,
    setCustomSorting,
    columnFilters,
    setColumnFilters,
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
    currId,
    setCurrId,
    editedTicket,
    setEditedTicket,
    passengersDiscountValues,
    setPassengersDiscountValues,
    numOfFreeSeats,
    setNumOfFreeSeats
  } = state;

  // Destructure validation
  const {
    validationErrors,
    setValidationErrors,
    validationErrorsExist,
    setValidationErrorsExist
  } = validation;

  // Helper function for checking if phone input should be disabled
  const checkIfMaskedPhoneInputIsDisabled = ({
    row,
    validationErrorsExist,
    validationErrors,
    ticketId,
    columnName
  }: {
    row: MRT_Row<Ticket>;
    validationErrorsExist: Record<string, boolean>;
    validationErrors: Record<string, string | undefined>;
    ticketId: string | undefined;
    columnName: string;
  }) => {
    const isError = validationErrorsExist[ticketId || ''];
    return (
      isError && !validationErrors?.[ticketId + '_' + row.id + '_' + columnName]
    );
  };

  // A selected bus flight is only valid for a specific city pair + date, so
  // clearing the relevant flight(s) when those change keeps the form honest.
  // Mutates the row cache (the busflight editors re-read it on remount, keyed by
  // the same trigger values) and clears the free-seat counters.
  const resetBusFlights = (
    row: MRT_Row<Ticket>,
    fields: ('busFlightFrom' | 'busFlightTo')[]
  ) => {
    fields.forEach((f) => {
      //@ts-ignore - clearing the edit cache for the dependent flight
      row._valuesCache[f] = '';
    });
    setNumOfFreeSeats((prev) => ({
      ...prev,
      ...(fields.includes('busFlightFrom') ? { busFlightFrom: null } : {}),
      ...(fields.includes('busFlightTo') ? { busFlightTo: null } : {})
    }));
    // Inline editing auto-saves an existing row whenever its values change (and
    // bails when a validation error is present). A cleared flight is required
    // again, so flag it to hold that auto-save until the user re-selects, rather
    // than PUTting an empty leg. The create modal doesn't auto-save (it validates
    // on submit), so skip the flag there to avoid a premature error on a field
    // that's still disabled. The return leg isn't required for one-way tickets.
    if (row.id === 'mrt-row-create') return;
    const oneWay = isOneWayTicket(fieldValue(row, 'type') || '');
    setValidationErrors((prev) => {
      const next = { ...prev };
      if (fields.includes('busFlightFrom'))
        next[row.id + '_busFlightFrom'] = "Поле обов'язкове";
      if (fields.includes('busFlightTo')) {
        if (oneWay) delete next[row.id + '_busFlightTo'];
        else next[row.id + '_busFlightTo'] = "Поле обов'язкове";
      }
      return next;
    });
  };

  const columns = useMemo<MRT_ColumnDef<Ticket>[]>(
    () => [
      {
        accessorKey: 'ticketId',
        id: 'ticketId',
        header: 'ID',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
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
        accessorKey: 'lastName',
        id: 'lastName',
        header: 'Прізвище',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_lastName'])
          );
        },
        Cell: ({ cell, row }) => {
          return validationErrorsExist[row?.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrorsExist[row?.id]}</Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        muiEditTextFieldProps: ({ cell, row }) => ({
          type: 'text',
          required: true,
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : undefined;

            setValidationErrors((prev) => ({
              ...prev,
              [cell.id]: validationError
            }));

            setEditedTicket({
              [row.id]: {
                ...row._valuesCache,
                lastName: event.target.value
              }
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_lastName']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'name',
        id: 'name',
        header: "Ім'я",
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_name'])
          );
        },
        Cell: ({ cell }) => cell.getValue<string>() || '',
        muiEditTextFieldProps: ({ cell, row }) => ({
          type: 'text',
          required: true,
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const validationError = !validateRequired(event.target.value)
              ? "Поле обов'язкове"
              : undefined;

            setValidationErrors((prev) => ({
              ...prev,
              [cell.id]: validationError
            }));

            setEditedTicket({
              [row.id]: {
                ...row._valuesCache,
                name: event.target.value
              }
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_name']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'confirmation',
        id: 'confirmation',
        header: 'Підтвердження',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_confirmation'])
          );
        },
        editVariant: 'select',
        editSelectOptions: ticketAttributesData?.data?.confirmations || [],
        muiEditTextFieldProps: ({ row, cell }) => {
          const { setEditingCell } = table;

          return {
            select: true,
            // Confirmation isn't required (backend accepts null; validateTicket
            // doesn't enforce it) — no asterisk.
            required: false,
            error: !!validationErrors?.[cell.id],
            helperText: validationErrors?.[cell.id],
            onChange: (event) => {
              const validationError = !validateRequired(event.target.value)
                ? "Поле обов'язкове"
                : undefined;
              setValidationErrors((prev) => ({
                ...prev,
                [cell.id]: validationError
              }));
              // The PUT endpoint reads passengerConfirmation.id, not the
              // display string — resolve the id from the attributes list.
              const selectedConfirmation = (
                ticketAttributesData?.data?.confirmations || []
              ).find((c) => c.value === event.target.value);
              setEditedTicket({
                [row.id]: {
                  ...row._valuesCache,
                  confirmation: event.target.value,
                  passengerConfirmation: selectedConfirmation
                    ? { id: String(selectedConfirmation.id) }
                    : null
                }
              });
              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            }
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_confirmation']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'ticketNumber',
        id: 'ticketNumber',
        header: '№ квитка',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
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
        accessorKey: 'type',
        id: 'type',
        header: 'Тип квитка',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        editVariant: 'select',
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_type'])
          );
        },
        editSelectOptions: ticketAttributesData?.data?.types || [],
        muiEditTextFieldProps: ({ row, cell, table }) => {
          const { setEditingCell } = table;
          return {
            select: true,
            required: true,
            error: !!validationErrors?.[cell.id],
            helperText: validationErrors?.[cell.id],
            onChange: (event) => {
              const validationError = !validateRequired(event.target.value)
                ? "Поле обов'язкове"
                : undefined;

              if (!isOneWayTicket(event.target.value || '')) {
                setValidationErrors((prev) => ({
                  ...prev,
                  [cell.id]: validationError
                }));
              } else {
                const errors = {};
                for (let key in validationErrors) {
                  if (validationErrors.hasOwnProperty(key)) {
                    if (
                      key !== 'mrt-row-create_dateOfReturn' &&
                      key !== 'mrt-row-create_busFlightTo'
                    ) {
                      //@ts-ignore
                      errors[key] = validationErrors[key];
                    }
                  }
                }
                setValidationErrors((prev) => ({
                  ...prev,
                  [cell.id]: validationError
                }));
              }

              setEditedTicket({
                [row.id]: {
                  ...row._valuesCache,
                  type: event.target.value
                }
              });
              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            }
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_type']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'paymentOnBus',
        id: 'paymentOnBus',
        header: 'Оплата в автобусі',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_paymentOnBus'])
          );
        },
        // Display the UAH-normalized amount; the raw accessor value
        // (paymentOnBus, booking currency) is what the edit field shows and the
        // write path sends. After save the backend recomputes the UAH value.
        Cell: ({ cell, row }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            formatUAH(row.original.paymentOnBusUAH)
          );
        },
        muiEditTextFieldProps: ({ cell, row }) => ({
          type: 'text',
          // required only if the other payment field is empty
          required: !!getTicketFieldError('paymentOnBus', {
            ...row._valuesCache,
            paymentOnBus: undefined
          }),
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          // Show which currency this amount is typed in — the ticket's currency
          // (UAH → ₴, EUR → €, …). The write path sends it as that currency.
          InputProps: {
            endAdornment: (
              <InputAdornment position="end">
                {currencySymbol(fieldValue(row, 'currency'))}
              </InputAdornment>
            )
          },
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const merged = {
              ...row._valuesCache,
              paymentOnBus: Number(event.target.value) || 0
            };
            // re-validate both payment fields (one satisfies the other)
            setValidationErrors((prev) => ({
              ...prev,
              [row.id + '_paymentOnBus']:
                getTicketFieldError('paymentOnBus', merged) || undefined,
              [row.id + '_paymentAtOffice']:
                getTicketFieldError('paymentAtOffice', merged) || undefined
            }));

            setEditedTicket({
              [row.id]: merged
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_paymentOnBus']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'paymentAtOffice',
        id: 'paymentAtOffice',
        header: 'Оплата в бюро',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_paymentAtOffice'])
          );
        },
        // Display the UAH-normalized amount; the raw accessor value
        // (paymentAtOffice, booking currency) is what the edit field shows and
        // the write path sends. After save the backend recomputes the UAH value.
        Cell: ({ cell, row }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            formatUAH(row.original.paymentAtOfficeUAH)
          );
        },
        muiEditTextFieldProps: ({ cell, row }) => ({
          type: 'text',
          // required only if the other payment field is empty
          required: !!getTicketFieldError('paymentAtOffice', {
            ...row._valuesCache,
            paymentAtOffice: undefined
          }),
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          // Show which currency this amount is typed in (see paymentOnBus).
          InputProps: {
            endAdornment: (
              <InputAdornment position="end">
                {currencySymbol(fieldValue(row, 'currency'))}
              </InputAdornment>
            )
          },
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const merged = {
              ...row._valuesCache,
              paymentAtOffice: Number(event.target.value) || 0
            };
            // re-validate both payment fields (one satisfies the other)
            setValidationErrors((prev) => ({
              ...prev,
              [row.id + '_paymentOnBus']:
                getTicketFieldError('paymentOnBus', merged) || undefined,
              [row.id + '_paymentAtOffice']:
                getTicketFieldError('paymentAtOffice', merged) || undefined
            }));

            setEditedTicket({
              [row.id]: merged
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_paymentAtOffice']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        // Displays the per-passenger price; column id stays 'price' so existing
        // server-side sort/filter and columnOrder keep working.
        accessorKey: 'passengerPrice',
        id: 'price',
        header: 'Ціна квитка',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        // Read-only: price is calculated on the backend.
        enableEditing: false,
        // Display the UAH-normalized per-passenger price so the money row is
        // consistent in UAH (priceUAH = paymentAtOfficeUAH + paymentOnBusUAH).
        Cell: ({ row }) => formatUAH(row.original.passengerPriceUAH),
        muiTableBodyCellProps: () => ({
          sx: (theme) => ({
            backgroundColor: theme.colors.alpha.black[30]
          })
        })
      },
      {
        accessorKey: 'currency',
        id: 'currency',
        header: 'Валюта',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_currency'])
          );
        },
        editVariant: 'select',
        editSelectOptions: currenciesData?.data || [],
        muiEditTextFieldProps: ({ row, cell, table }) => {
          const { setEditingCell } = table;

          return {
            select: true,
            error: !!validationErrors?.[cell.id],
            helperText: validationErrors?.[cell.id],
            required: true,
            onChange: (event) => {
              const newCurrency = event.target.value;
              const validationError = !validateRequired(newCurrency)
                ? "Поле обов'язкове"
                : undefined;
              setValidationErrors((prev) => ({
                ...prev,
                [cell.id]: validationError
              }));

              // Switching the currency changes the denomination the payment
              // inputs are typed in, so the previously-entered amounts are no
              // longer valid (a UAH number must not be re-sent as €). Clear them
              // and let the admin re-enter in the new currency. Compare against
              // the loaded currency so re-selecting the original doesn't wipe a
              // valid prefilled amount.
              const currencyChanged = newCurrency !== row.original.currency;
              if (currencyChanged) {
                row._valuesCache.paymentOnBus = '';
                row._valuesCache.paymentAtOffice = '';
                // Re-validate: cleared payments must be re-entered before save
                // (one of the two is required), so this blocks a stale/empty PUT.
                const cleared = {
                  ...row._valuesCache,
                  currency: newCurrency
                };
                setValidationErrors((prev) => ({
                  ...prev,
                  [row.id + '_paymentOnBus']:
                    getTicketFieldError('paymentOnBus', cleared) || undefined,
                  [row.id + '_paymentAtOffice']:
                    getTicketFieldError('paymentAtOffice', cleared) || undefined
                }));
              }

              setEditedTicket({
                [row.id]: {
                  ...row._valuesCache,
                  currency: newCurrency
                }
              });
              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            }
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_currency']
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
        minSize: 100,
        maxSize: 400,
        size: 200,
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        enableEditing: (row) => {
          // Locked when a promo discount (Акційна знижка) is set — the promo
          // discount and the passenger discount are mutually exclusive. Read the
          // live value (fieldValue) so it also reflects a promo typed in the
          // create modal / during inline editing, not just the loaded row.
          if (hasPromoDiscount(fieldValue(row, 'discount'))) return false;
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_passengerDiscount'])
          );
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
          // Children get child-group discounts; adults the adult/discount-card
          // ones (read the live passengerType so the create modal reacts to the
          // type select).
          const isChild =
            String(fieldValue(row, 'passengerType') ?? 'adult') === 'child';
          const groups = isChild
            ? ['both', 'children']
            : ['both', 'adults', 'discount-card'];
          return (
            discountsData?.data?.filter((discount: Discount) =>
              groups.includes(discount.group)
            ) || []
          );
        },
        muiEditTextFieldProps: ({ table, row, cell }) => {
          const { setEditingCell } = table;
          return {
            select: true,
            // Disable in the create modal too (enableEditing isn't consulted
            // there) when a promo discount is set.
            disabled: hasPromoDiscount(fieldValue(row, 'discount')),
            onChange: (event) => {
              const selectedDiscount = discountsData?.data?.find(
                (el: Discount) =>
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

              const merged = {
                ...row._valuesCache,
                passengerDiscount: discountValue
              };
              setEditedTicket({
                [row.id]: merged
              });

              // toggle the discount-card-number requirement for this discount
              setValidationErrors((prev) => ({
                ...prev,
                [row.id + '_discountCardNumber']:
                  getTicketFieldError(
                    'discountCardNumber',
                    merged,
                    discountCardIds
                  ) || undefined
              }));

              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            },
            value:
              cell.getValue<PassengerDiscount>()?.name ||
              passengersDiscountValues[row.id]?.name ||
              ''
          };
        },
        muiTableBodyCellProps: ({ cell, row }) => {
          const isError = validationErrorsExist[row.id];
          const locked = hasPromoDiscount(row.original?.discount);
          return {
            sx: (theme) => ({
              backgroundColor:
                locked ||
                (isError && !validationErrors?.[row.id + '_passengerDiscount'])
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
        minSize: 60,
        maxSize: 240,
        size: 120,
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        enableEditing: (row) => {
          // Use the freshly-selected discount (tracked in passengersDiscountValues
          // for both create and inline edits) and fall back to the loaded value.
          const currentDiscountId =
            passengersDiscountValues[row.id]?.id ??
            (row.original?.passengerDiscount?.id || '');
          const isDiscountCard = discountCardIds.includes(
            String(currentDiscountId)
          );
          if (!isDiscountCard) return false;
          const isError = validationErrorsExist[row.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_discountCardNumber'])
          );
        },
        Cell: ({ cell }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          // required only for loyalty-card discounts (id 10/11)
          required: !!getTicketFieldError(
            'discountCardNumber',
            row._valuesCache,
            discountCardIds
          ),
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            const merged = {
              ...row._valuesCache,
              discountCardNumber: event.target.value
            };
            setValidationErrors((prev) => ({
              ...prev,
              [cell.id]:
                getTicketFieldError(
                  'discountCardNumber',
                  merged,
                  discountCardIds
                ) || undefined
            }));
            setEditedTicket({
              [row.id]: merged
            });
            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const currentDiscountId =
            passengersDiscountValues[row.id]?.id ??
            (row.original?.passengerDiscount?.id || '');
          const isDiscountCard = discountCardIds.includes(
            String(currentDiscountId)
          );
          const isError = validationErrorsExist[row.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                (isError &&
                  !validationErrors?.[row.id + '_discountCardNumber']) ||
                !isDiscountCard
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'discount',
        id: 'discount',
        header: 'Акційна знижка',
        columnFilterModeOptions: [
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          // Mutually exclusive with the passenger discount — locked when one is
          // selected (live value covers the create modal / inline editing).
          if (
            hasPassengerDiscount(
              passengersDiscountValues[row.id] ??
                fieldValue(row, 'passengerDiscount')
            )
          )
            return false;
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_discount'])
          );
        },
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          required: false,
          // Disable in the create modal too when a passenger discount is set.
          disabled: hasPassengerDiscount(
            passengersDiscountValues[row.id] ??
              fieldValue(row, 'passengerDiscount')
          ),
          onChange: (event: FocusEvent<HTMLInputElement>) => {
            const discountValue = Number(event.target.value) || 'Без знижки';
            // Write straight to the row cache so dependent fields (the mutually
            // exclusive passengerDiscount) recompute their disabled state on this
            // keystroke — MRT only commits the value to the cache on blur.
            //@ts-ignore
            row._valuesCache.discount = discountValue;
            setEditedTicket({
              [row.id]: {
                ...row._valuesCache,
                discount: discountValue
              }
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_discount']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.origin;
        },
        id: 'origin',
        header: 'Пункт відправлення',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_origin']) ||
            (isError && !!validationErrors?.[row.id + '_destination'])
          );
        },
        renderColumnActionsMenuItems: ({
          closeMenu,
          internalColumnMenuItems,
          column
        }) => {
          return [
            ...internalColumnMenuItems,
            <Divider key="divider-1" />,
            <MenuItem
              key={'item-1'}
              onClick={() => {
                handleCustomSotring(column.id, 'ZD');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Запоріжжя - Швайнфурт
              </ListItemText>
            </MenuItem>,
            <MenuItem
              key={'item-2'}
              onClick={() => {
                handleCustomSotring(column.id, 'DZ');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Швайнфурт - Запоріжжя
              </ListItemText>
            </MenuItem>,
            <MenuItem
              key={'item-3'}
              onClick={() => {
                handleCustomSotring(column.id, 'ZK');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Запоріжжя - Карлсруе
              </ListItemText>
            </MenuItem>,
            <MenuItem
              key={'item-4'}
              onClick={() => {
                handleCustomSotring(column.id, 'KZ');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Карлсруе - Запоріжжя
              </ListItemText>
            </MenuItem>
          ];
        },
        enableSorting: true,
        Cell: ({ cell }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            cell.getValue<TicketCity>().name || ''
          );
        },
        Edit({ cell, table, row }) {
          let defaultValue = null;
          if (row.original.origin && citiesData?.data) {
            const cityObj = citiesData.data.find(
              (el: any) =>
                el.label.toLowerCase() ===
                cell.getValue<TicketCity>().name.toLowerCase()
            );
            defaultValue = cityObj?.id
              ? {
                  id: cityObj?.id || '1',
                  label: cityObj?.label || 'test',
                  groupBy: cityObj?.groupBy || 'test',
                  countryId: cityObj?.countryId || '1'
                }
              : null;
          }

          const excludedCountry = row._valuesCache?.destination?.countryId
            ? String(row._valuesCache?.destination?.countryId)
            : null;
          const dataOptions = citiesData?.data?.filter((el: any) => {
            if (el?.countryId && excludedCountry) {
              return String(el.countryId) !== excludedCountry;
            }

            return true;
          });

          return (
            <EditCustomSelect
              cell={cell}
              table={table}
              defaultValue={defaultValue}
              data={[...(dataOptions ?? [])].sort(
                (a, b) => -b.groupBy.localeCompare(a.groupBy)
              )}
              textFieldProps={{
                onChange: (value: TicketCity) => {
                  const validationError = !validateRequired(
                    value ? value.toString() : ''
                  )
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));
                  // City pair changed → both flights are no longer valid.
                  resetBusFlights(row, ['busFlightFrom', 'busFlightTo']);
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      origin: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                required: true,
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError &&
                !validationErrors?.[row.id + '_destination'] &&
                !validationErrors?.[row.id + '_origin']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.destination;
        },
        id: 'destination',
        header: 'Пункт прибуття',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          // Disabled until "Пункт відправлення" (origin) is selected.
          if (!isCitySelected(fieldValue(row, 'origin'))) return false;
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_destination']) ||
            (isError && !!validationErrors?.[row.id + '_origin'])
          );
        },
        renderColumnActionsMenuItems: ({
          closeMenu,
          internalColumnMenuItems,
          column
        }) => {
          return [
            ...internalColumnMenuItems,
            <Divider key="divider-1" />,
            <MenuItem
              key={'item-1'}
              onClick={() => {
                handleCustomSotring(column.id, 'ZD');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Запоріжжя - Швайнфурт
              </ListItemText>
            </MenuItem>,
            <MenuItem
              key={'item-2'}
              onClick={() => {
                handleCustomSotring(column.id, 'DZ');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Швайнфурт - Запоріжжя
              </ListItemText>
            </MenuItem>,
            <MenuItem
              key={'item-3'}
              onClick={() => {
                handleCustomSotring(column.id, 'ZK');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Запоріжжя - Карлсруе
              </ListItemText>
            </MenuItem>,
            <MenuItem
              key={'item-4'}
              onClick={() => {
                handleCustomSotring(column.id, 'KZ');
                closeMenu();
              }}
            >
              <ListItemIcon>
                <SortIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                Сортувати за маршрутом Карлсруе - Запоріжжя
              </ListItemText>
            </MenuItem>
          ];
        },
        enableSorting: true,
        Cell: ({ cell }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            cell.getValue<TicketCity>().name || ''
          );
        },
        Edit({ cell, table, row }) {
          let defaultValue = null;
          if (row.original.origin && citiesData?.data) {
            const cityObj = citiesData.data.find(
              (el: any) =>
                el.label.toLowerCase() ===
                cell.getValue<TicketCity>().name.toLowerCase()
            );
            defaultValue = cityObj?.id
              ? {
                  id: cityObj?.id || '1',
                  label: cityObj?.label || 'test',
                  groupBy: cityObj?.groupBy || 'test',
                  countryId: cityObj?.countryId || '1'
                }
              : null;
          }

          const excludedCountry = row._valuesCache?.origin?.countryId
            ? String(row._valuesCache?.origin?.countryId)
            : null;
          const dataOptions = citiesData?.data?.filter((el: any) => {
            if (el?.countryId && excludedCountry) {
              return String(el.countryId) !== excludedCountry;
            }

            return true;
          });

          // Destination can't be picked until origin is chosen (applies in the
          // create modal too, where enableEditing isn't consulted).
          const originSelected = isCitySelected(fieldValue(row, 'origin'));

          return (
            <EditCustomSelect
              cell={cell}
              table={table}
              disabled={!originSelected}
              defaultValue={defaultValue}
              data={[...(dataOptions ?? [])].sort(
                (a, b) => -b.groupBy.localeCompare(a.groupBy)
              )}
              textFieldProps={{
                onChange: (value: TicketCity) => {
                  const validationError = !validateRequired(
                    value ? value.toString() : ''
                  )
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));
                  // City pair changed → both flights are no longer valid.
                  resetBusFlights(row, ['busFlightFrom', 'busFlightTo']);
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      destination: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                required: true,
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError &&
                !validationErrors?.[row.id + '_destination'] &&
                !validationErrors?.[row.id + '_origin']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.busFlightFrom;
        },
        id: 'busFlightFrom',
        header: 'Рейс відправлення',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 100,
        maxSize: 400,
        size: 200,
        enableEditing: (row) => {
          // Disabled until the departure date is selected.
          if (!isDateSelected(fieldValue(row, 'dateOfDeparture'))) return false;
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_busFlightFrom'])
          );
        },
        Cell: ({ row, cell }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            transformTicketBusFlightToString(
              row._valuesCache,
              'busFlightFrom'
            ) || ''
          );
        },
        Edit({ cell, table, row }) {
          const defaultValue =
            (row._valuesCache.busFlightFrom as TicketBusFlight)?.id !==
              undefined && typeof row._valuesCache.busFlightFrom === 'object'
              ? {
                  id: row._valuesCache.busFlightFrom?.id,
                  name: row._valuesCache.busFlightFrom?.name,
                  dateOfDeparture:
                    row._valuesCache.busFlightFrom?.dateOfDeparture,
                  label: transformTicketBusFlightToString(
                    row._valuesCache,
                    'busFlightFrom'
                  )
                }
              : null;
          const tbl = (table || tableInstanceRef.current) as
            | MRT_TableInstance<Ticket>
            | undefined;
          const isCreating = tbl?.getState()?.creatingRow?.id === row.id;

          // Preload flights for the chosen departure date AND the date of the
          // currently-selected flight, so both are offered without typing.
          const currentFlightDate = (
            (row._valuesCache.busFlightFrom as TicketBusFlight) ||
            (row.original?.busFlightFrom as TicketBusFlight)
          )?.dateOfDeparture;
          const selectedDates = Array.from(
            new Set(
              [fieldValue(row, 'dateOfDeparture'), currentFlightDate]
                .filter((d) => d && dayjs(d).isValid())
                .map((d) => dayjs(d).format('DD-MM-YYYY'))
            )
          );

          // Remount (clearing the displayed flight) whenever the city pair or
          // departure date changes — the onChange handlers also clear the cache.
          const resetKey = [
            fieldValue(row, 'origin')?.id ?? '',
            fieldValue(row, 'destination')?.id ?? '',
            isDateSelected(fieldValue(row, 'dateOfDeparture'))
              ? dayjs(fieldValue(row, 'dateOfDeparture')).format('YYYY-MM-DD')
              : ''
          ].join('|');

          return (
            <EditBusFlightsSearchAutocomplete
              key={resetKey}
              disabled={!isDateSelected(fieldValue(row, 'dateOfDeparture'))}
              selectedDates={selectedDates}
              defaultValue={defaultValue}
              cell={cell}
              table={tbl as MRT_TableInstance<Ticket>}
              textFieldProps={{
                onChange: (value: TicketBusFlight) => {
                  if (isCreating)
                    setNumOfFreeSeats((prev) => {
                      return {
                        ...prev,
                        busFlightFrom:
                          value === null ? null : value?.freeSeats || 0
                      };
                    });

                  const validationError = !validateRequired(
                    value ? value.toString() : ''
                  )
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      busFlightFrom: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                required: true,
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_busFlightFrom']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return originalRow.busFlightTo;
        },
        id: 'busFlightTo',
        header: 'Рейс повернення',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 100,
        maxSize: 400,
        size: 200,
        enableEditing: (row) => {
          if (isOneWayTicket(row._valuesCache.type || '')) return false;
          // Disabled until the return date is selected.
          if (!isDateSelected(fieldValue(row, 'dateOfReturn'))) return false;
          const isError = validationErrorsExist[row?.id];
          return (
            (!isError && !isOneWayTicket(row.original.type || '')) ||
            (isError && !!validationErrors?.[row.id + '_busFlightTo'])
          );
        },
        Cell: ({ row, cell }) => {
          if (isOneWayTicket(row.original.type || '')) return '-';
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            transformTicketBusFlightToString(row._valuesCache, 'busFlightTo') ||
              ''
          );
        },
        Edit({ cell, table, row }) {
          const tbl = (table || tableInstanceRef.current) as
            | MRT_TableInstance<Ticket>
            | undefined;
          const { editingCell, creatingRow } = (tbl?.getState() ??
            {}) as ReturnType<MRT_TableInstance<Ticket>['getState']>;
          const isCreating = creatingRow?.id === row.id;
          const isEditing = editingCell?.row?.id === row.id;
          const defaultValue =
            (row._valuesCache.busFlightTo as TicketBusFlight)?.id !==
              undefined && typeof row._valuesCache.busFlightTo === 'object'
              ? {
                  id: row._valuesCache.busFlightTo?.id,
                  name: row._valuesCache.busFlightTo?.name,
                  dateOfDeparture:
                    row._valuesCache.busFlightTo?.dateOfDeparture,
                  label: transformTicketBusFlightToString(
                    row._valuesCache,
                    'busFlightTo'
                  )
                }
              : null;

          // Preload flights for the chosen return date AND the date of the
          // currently-selected return flight.
          const currentFlightDate = (
            (row._valuesCache.busFlightTo as TicketBusFlight) ||
            (row.original?.busFlightTo as TicketBusFlight)
          )?.dateOfDeparture;
          const selectedDates = Array.from(
            new Set(
              [fieldValue(row, 'dateOfReturn'), currentFlightDate]
                .filter((d) => d && dayjs(d).isValid())
                .map((d) => dayjs(d).format('DD-MM-YYYY'))
            )
          );

          // Remount (clearing the displayed flight) whenever the city pair or
          // return date changes — the onChange handlers also clear the cache.
          const resetKey = [
            fieldValue(row, 'origin')?.id ?? '',
            fieldValue(row, 'destination')?.id ?? '',
            isDateSelected(fieldValue(row, 'dateOfReturn'))
              ? dayjs(fieldValue(row, 'dateOfReturn')).format('YYYY-MM-DD')
              : ''
          ].join('|');

          return (
            <EditBusFlightsSearchAutocomplete
              key={resetKey}
              disabled={
                isOneWayTicket(row._valuesCache.type || '') ||
                !isDateSelected(fieldValue(row, 'dateOfReturn'))
              }
              selectedDates={selectedDates}
              defaultValue={defaultValue}
              cell={cell}
              table={tbl as MRT_TableInstance<Ticket>}
              textFieldProps={{
                onChange: (value: TicketBusFlight) => {
                  if (isCreating)
                    setNumOfFreeSeats((prev) => {
                      return {
                        ...prev,
                        busFlightTo:
                          value === null ? null : value?.freeSeats || 0
                      };
                    });
                  const validationError = !validateRequired(
                    value ? value.toString() : ''
                  )
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      busFlightTo: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                required: isCreating
                  ? !isOneWayTicket(row._valuesCache.type || '')
                  : isEditing
                  ? !isOneWayTicket(row.original.type || '')
                  : true,
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                (isError && !validationErrors?.[row.id + '_busFlightTo']) ||
                isOneWayTicket(row.original.type || '')
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return dayjs(originalRow.dateOfCreature).startOf('day').utc(true);
        },
        id: 'dateOfCreature',
        header: 'Дата створення',
        filterVariant: 'date',
        columnFilterModeOptions: [
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        enableEditing: false,
        minSize: 60,
        maxSize: 240,
        size: 120,
        Cell: ({ cell }) => {
          return dayjs(cell.getValue<Dayjs>()).format('DD-MM-YYYY') || '';
        },
        Edit({ cell, table, row }) {
          return (
            <EditDatepicker
              cell={cell}
              table={table}
              disabled={true}
              textFieldProps={{
                onChange: (value: string) => {
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      dateOfCreature: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        //@ts-ignore
        muiFilterDatePickerProps: buildDateFilterProps,
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
          return dayjs(originalRow.dateOfDeparture).startOf('day').utc(true);
        },
        id: 'dateOfDeparture',
        filterVariant: 'date',
        columnFilterModeOptions: [
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
        header: 'Дата відправлення',
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          // Disabled until both origin and destination are selected.
          if (
            !isCitySelected(fieldValue(row, 'origin')) ||
            !isCitySelected(fieldValue(row, 'destination'))
          )
            return false;
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_dateOfDeparture'])
          );
        },
        Cell: ({ cell }) => {
          return validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            dayjs(cell.getValue<Dayjs>()).format('DD-MM-YYYY') || ''
          );
        },
        Edit({ cell, table, row }) {
          return (
            <AvailableDatesDatepicker
              cell={cell}
              table={table}
              direction="forwards"
              disabled={
                !isCitySelected(fieldValue(row, 'origin')) ||
                !isCitySelected(fieldValue(row, 'destination'))
              }
              textFieldProps={{
                onChange: (value: string) => {
                  const validationError = !validateRequired(value)
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));
                  // Departure date changed → the departure flight no longer fits.
                  resetBusFlights(row, ['busFlightFrom']);
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      dateOfDeparture: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                required: true,
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        //@ts-ignore
        muiFilterDatePickerProps: buildDateFilterProps,
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_dateOfDeparture']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorFn: (originalRow) => {
          return dayjs(originalRow.dateOfReturn).startOf('day').utc(true);
        },
        id: 'dateOfReturn',
        filterVariant: 'date',
        columnFilterModeOptions: [
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ],
        header: 'Дата повернення',
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          if (isOneWayTicket(row._valuesCache.type || '')) return false;
          // Disabled until the departure date is selected.
          if (!isDateSelected(fieldValue(row, 'dateOfDeparture'))) return false;
          const isError = validationErrorsExist[row?.id];
          return (
            (!isError && !isOneWayTicket(row.original.type || '')) ||
            (isError && !!validationErrors?.[row.id + '_dateOfReturn'])
          );
        },
        Cell: ({ row, cell }) => {
          if (isOneWayTicket(row.original.type || '')) return '-';
          const error = validationErrors?.[cell.id];
          const value = cell.getValue<Dayjs>();
          // Round-trip but no return date yet → required message, not "Invalid Date".
          if (!dayjs(value).isValid()) {
            return (
              <Box sx={{ color: 'red' }}>{error || "Поле обов'язкове"}</Box>
            );
          }
          return error ? (
            <Box sx={{ color: 'red' }}>{error}</Box>
          ) : (
            dayjs(value).format('DD-MM-YYYY')
          );
        },
        Edit({ cell, table, row }) {
          return (
            <AvailableDatesDatepicker
              cell={cell}
              table={table}
              direction="backwards"
              disabled={
                isOneWayTicket(row._valuesCache.type || '') ||
                !isDateSelected(fieldValue(row, 'dateOfDeparture'))
              }
              textFieldProps={{
                onChange: (value: string) => {
                  const validationError = !validateRequired(value)
                    ? "Поле обов'язкове"
                    : undefined;
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));
                  // Return date changed → the return flight no longer fits.
                  resetBusFlights(row, ['busFlightTo']);
                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      dateOfReturn: value
                    }
                  });
                  setCurrId(row.original.ticketId || '0');
                },
                required: !isOneWayTicket(row._valuesCache.type || ''),
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        //@ts-ignore
        muiFilterDatePickerProps: buildDateFilterProps,
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                (isError && !validationErrors?.[row.id + '_dateOfReturn']) ||
                isOneWayTicket(row.original.type || '')
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'phone',
        id: 'phone',
        header: 'Телефон',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_phone'])
          );
        },
        Cell: ({ cell }) =>
          validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            cell.getValue<string>() || ''
          ),
        Edit({ cell, table, row }) {
          const tbl = (table || tableInstanceRef.current) as
            | MRT_TableInstance<Ticket>
            | undefined;
          const isCreating = tbl?.getState()?.creatingRow?.id === row.id;
          const raw = fieldValue(row, 'phone');
          const phoneValue = !raw || raw === '-' ? '' : String(raw);
          return (
            <PassengerSearchPhoneInput
              label="Телефон"
              value={phoneValue}
              // Required for adults (the backend rejects an adult with no phone);
              // validateTicket is the authoritative create-time gate.
              required={
                String(fieldValue(row, 'passengerType') ?? 'adult') !== 'child'
              }
              error={!!validationErrors?.[cell.id]}
              helperText={validationErrors?.[cell.id]}
              onClose={isCreating ? undefined : () => tbl?.setEditingCell(null)}
              onChange={(phone) => {
                //@ts-ignore
                row._valuesCache.phone = phone;
                const isAdult =
                  String(fieldValue(row, 'passengerType') ?? 'adult') !==
                  'child';
                // Empty adult phone is invalid — flag it so the inline auto-save
                // is held (the backend rejects an adult with no phone) instead of
                // PUTting an empty value.
                const validationError =
                  isAdult && !phone
                    ? "Поле обов'язкове"
                    : phone && !validatePhone(phone)
                    ? 'Введіть коректний номер телефону'
                    : undefined;
                setValidationErrors((prev) => ({
                  ...prev,
                  [cell.id]: validationError
                }));
                setEditedTicket({
                  [row.id]: { ...row._valuesCache, phone }
                });
                setCurrId(row.original.ticketId || '0');
              }}
              onSelectPassenger={(found) => {
                if (isCreating) {
                  // Autofill the new row's passenger fields (merge — keep any
                  // ticket-level fields already entered).
                  //@ts-ignore
                  row._valuesCache = {
                    ...row._valuesCache,
                    passengerId: found.passengerId || '1',
                    name: found.name || '',
                    lastName: found.lastName || '',
                    additionalPhone:
                      found.additionalPhone && found.additionalPhone !== '-'
                        ? found.additionalPhone
                        : '',
                    dateOfBirth:
                      found.dateOfBirth && dayjs(found.dateOfBirth).isValid()
                        ? dayjs(found.dateOfBirth).format('YYYY-MM-DD')
                        : '',
                    email: found.email || ''
                  };
                  setEditedTicket({ [row.id]: { ...row._valuesCache } });
                } else {
                  // Edit: re-link this ticket row to the selected passenger
                  // (backend reads newPassengerId; identity fields untouched).
                  //@ts-ignore
                  row._valuesCache = {
                    ...row._valuesCache,
                    newPassengerId: found.passengerId
                  };
                  setEditedTicket({ [row.id]: { ...row._valuesCache } });
                }
                setCurrId(row.original.ticketId || '0');
              }}
            />
          );
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                // row.original.passengerType === "child" ||
                isError && !validationErrors?.[row.id + '_phone']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'additionalPhone',
        id: 'additionalPhone',
        header: 'Дод. телефон',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableEditing: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_additionalPhone'])
          );
        },
        Cell: ({ cell }) =>
          validationErrors?.[cell.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrors?.[cell.id]}</Box>
          ) : (
            cell.getValue<string>() || ''
          ),
        Edit({ cell, table, row }) {
          const tbl = (table || tableInstanceRef.current) as
            | MRT_TableInstance<Ticket>
            | undefined;
          const isCreating = tbl?.getState()?.creatingRow?.id === row.id;
          const raw = fieldValue(row, 'additionalPhone');
          const phoneValue = !raw || raw === '-' ? '' : String(raw);
          return (
            <PassengerSearchPhoneInput
              label="Дод. телефон"
              enableSearch={false}
              value={phoneValue}
              error={!!validationErrors?.[cell.id]}
              helperText={validationErrors?.[cell.id]}
              onClose={isCreating ? undefined : () => tbl?.setEditingCell(null)}
              disabled={checkIfMaskedPhoneInputIsDisabled({
                row,
                validationErrors,
                validationErrorsExist,
                ticketId: row.original.ticketId,
                columnName: 'additionalPhone'
              })}
              onChange={(phone) => {
                //@ts-ignore
                row._valuesCache.additionalPhone = phone;
                const validationError =
                  phone && !validatePhone(phone)
                    ? 'Введіть коректний номер телефону'
                    : undefined;
                setValidationErrors((prev) => ({
                  ...prev,
                  [cell.id]: validationError
                }));
                setEditedTicket({
                  [row.id]: { ...row._valuesCache, additionalPhone: phone }
                });
                setCurrId(row.original.ticketId || '0');
              }}
            />
          );
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                // row.original.passengerType === "child" ||
                isError && !validationErrors?.[row.id + '_additionalPhone']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'email',
        id: 'email',
        header: 'Email',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enableEditing: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_email'])
          );
        },
        Cell: ({ cell }) => cell.getValue<string>() || '',
        muiEditTextFieldProps: ({ cell, table, row }) => ({
          type: 'text',
          // Email is optional (backend allows null) — no asterisk.
          required: false,
          error: !!validationErrors?.[cell.id],
          helperText: validationErrors?.[cell.id],
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // email is not required; validate format only when filled
            const value = event.target.value;
            const validationError =
              value && !validateEmail(value)
                ? 'Введіть коректну Email адресу'
                : undefined;

            setValidationErrors((prev) => ({
              ...prev,
              [cell.id]: validationError
            }));

            setEditedTicket({
              [row.id]: {
                ...row._valuesCache,
                email: event.target.value
              }
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                // row.original.passengerType === "child" ||
                isError && !validationErrors?.[row.id + '_email']
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
        filterVariant: 'date',
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_dateOfBirth'])
          );
        },
        columnFilterModeOptions: [
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        header: 'Дата народження',
        // enableColumnPinning: false,
        // enableRowPinning: false,
        minSize: 80,
        maxSize: 300,
        size: 160,
        Cell: ({ cell }) => {
          const value = cell.getValue<Dayjs>();
          return dayjs(value).isValid()
            ? dayjs(value).format('DD-MM-YYYY')
            : '';
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
                  setValidationErrors((prev) => ({
                    ...prev,
                    [cell.id]: validationError
                  }));

                  setEditedTicket({
                    [row.id]: {
                      ...row._valuesCache,
                      dateOfBirth: value
                    }
                  });

                  setCurrId(row.original.ticketId || '0');
                },
                required: true,
                error: !!validationErrors?.[cell.id],
                helperText: validationErrors?.[cell.id]
              }}
            />
          );
        },
        //@ts-ignore
        muiFilterDatePickerProps: buildDateFilterProps,
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_dateOfBirth']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'passengerType',
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
        editVariant: 'select',
        editSelectOptions: [
          { value: 'adult', label: 'Дорослий' },
          { value: 'child', label: 'Дитина' }
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError ||
            (isError && !!validationErrors?.[row.id + '_passengerType'])
          );
        },
        Cell: ({ cell }) => {
          // default display is "Дорослий" (adult) when unset
          return cell.getValue<string>() === 'child' ? 'Дитина' : 'Дорослий';
        },
        muiEditTextFieldProps: ({ row, cell, table }) => {
          const { setEditingCell } = table;
          return {
            select: true,
            required: true,
            error: !!validationErrors?.[cell.id],
            helperText: validationErrors?.[cell.id],
            value: cell.getValue<string>() || 'adult',
            onChange: (event) => {
              const nextType = event.target.value as 'adult' | 'child';
              // Switching type invalidates the chosen discount (adult/child
              // discount groups differ) and its card number — clear them.
              //@ts-ignore
              row._valuesCache.passengerDiscount = null;
              //@ts-ignore
              row._valuesCache.discountCardNumber = '';
              setPassengersDiscountValues((prev) => ({
                ...prev,
                [row.id]: null
              }));
              // Phone/email are only required for adults — drop their (stale)
              // required errors when switching to child so the form isn't blocked
              // by fields that no longer apply.
              if (nextType === 'child') {
                setValidationErrors((prev) => {
                  const next = { ...prev };
                  delete next[row.id + '_phone'];
                  delete next[row.id + '_email'];
                  return next;
                });
              }
              setEditedTicket({
                [row.id]: {
                  ...row._valuesCache,
                  passengerType: nextType,
                  passengerDiscount: null,
                  discountCardNumber: ''
                }
              });
              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            }
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_passengerType']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        // `agent` is an Agent object ({ id, name }) or a string; accessorFn
        // normalises it to a label string for display/filtering.
        // Editable as a select populated from the /agents endpoint.
        accessorFn: (originalRow) => {
          const agent = originalRow.agent;
          if (!agent) return '';
          return typeof agent === 'string' ? agent : agent.name || '';
        },
        id: 'agent',
        header: 'Агентство',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_agent'])
          );
        },
        editVariant: 'select',
        editSelectOptions:
          agentsData?.data?.map((agent) => ({
            label: agent.label,
            value: agent.value
          })) || [],
        muiEditTextFieldProps: ({ row, cell, table }) => {
          const { setEditingCell } = table;
          return {
            select: true,
            error: !!validationErrors?.[cell.id],
            helperText: validationErrors?.[cell.id],
            onChange: (event) => {
              const selectedAgent = agentsData?.data?.find(
                (a) => a.value === event.target.value
              );
              // Store the same { id, name } shape the API returns and the PUT
              // body needs (backend reads agent.id); name is the display label.
              const agentValue = selectedAgent
                ? {
                    id: selectedAgent.id,
                    name: selectedAgent.label
                  }
                : event.target.value;

              setAgentValues((prev) => ({
                ...prev,
                [row.id]: selectedAgent?.value || ''
              }));

              setEditedTicket({
                [row.id]: {
                  ...row._valuesCache,
                  agent: agentValue
                }
              });

              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            },
            value:
              agentValues[row.id] ??
              (typeof row.original.agent === 'string'
                ? row.original.agent
                : row.original.agent?.name || '')
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_agent']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'busSeat',
        id: 'busSeat',
        header: 'Місце',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_busSeat'])
          );
        },
        Cell: ({ cell, row }) => {
          return validationErrorsExist[row?.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrorsExist[row?.id]}</Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        muiEditTextFieldProps: ({ cell, row }) => ({
          type: 'text',
          required: false,
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            setEditedTicket({
              [row.id]: {
                ...row._valuesCache,
                busSeat: event.target.value
              }
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_busSeat']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: 'Статус',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ],
        minSize: 60,
        maxSize: 240,
        size: 120,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_status'])
          );
        },
        editVariant: 'select',
        editSelectOptions: ticketAttributesData?.data?.statuses || [],
        muiEditTextFieldProps: ({ row, cell }) => {
          const { setEditingCell } = table;

          return {
            select: true,
            required: true,
            error: !!validationErrors?.[cell.id],
            helperText: validationErrors?.[cell.id],
            onChange: (event) => {
              const validationError = !validateRequired(event.target.value)
                ? "Поле обов'язкове"
                : undefined;
              setValidationErrors((prev) => ({
                ...prev,
                [cell.id]: validationError
              }));
              setEditedTicket({
                [row.id]: {
                  ...row._valuesCache,
                  status: event.target.value
                }
              });
              setCurrId(row.original.ticketId || '0');
              setEditingCell(null);
            }
          };
        },
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_status']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      },
      {
        accessorKey: 'note',
        id: 'note',
        header: 'Примітка',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        minSize: 80,
        maxSize: 300,
        size: 160,
        enableEditing: (row) => {
          const isError = validationErrorsExist[row?.id];
          return (
            !isError || (isError && !!validationErrors?.[row.id + '_note'])
          );
        },
        Cell: ({ cell, row }) => {
          return validationErrorsExist[row?.id] ? (
            <Box sx={{ color: 'red' }}>{validationErrorsExist[row?.id]}</Box>
          ) : (
            cell.getValue<string>() || ''
          );
        },
        muiEditTextFieldProps: ({ cell, row }) => ({
          type: 'text',
          required: false,
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            setEditedTicket({
              [row.id]: {
                ...row._valuesCache,
                note: event.target.value
              }
            });

            setCurrId(row.original.ticketId || '0');
          }
        }),
        muiTableBodyCellProps: ({ row }) => {
          const isError = validationErrorsExist[row?.id];
          return {
            sx: (theme) => ({
              backgroundColor:
                isError && !validationErrors?.[row.id + '_note']
                  ? theme.colors.alpha.black[30]
                  : 'inherit'
            })
          };
        }
      }
    ],
    [
      initialData,
      ticketAttributesData?.data,
      currenciesData?.data,
      citiesData?.data,
      discountsData?.data,
      discountCardIds,
      agentsData?.data,
      agentValues,
      editedTicket,
      validationErrors,
      validationErrorsExist,
      actionState
    ]
  );

  // Derive the columns actually fed to the table:
  //  - size each one to fit its header text (measured width + icon overhead);
  //    minSize/maxSize stay loose so columns remain manually resizable.
  //  - wrap each Cell so empty values ('' / null / undefined) render as "-".
  //    Display-only: editing renders the edit field, not Cell. Columns without
  //    a custom Cell fall back to renderedCellValue.
  const sizedColumns = useMemo<MRT_ColumnDef<Ticket>[]>(
    () =>
      columns.map((col) => {
        const header = typeof col.header === 'string' ? col.header : '';
        // Phone editors (country select + input, and the passenger-search
        // dropdown) need more room, so give these two columns double width.
        const isWidePhone = col.id === 'phone' || col.id === 'additionalPhone';
        const width =
          Math.max(90, measureHeaderWidth(header) + HEADER_ICON_OVERHEAD) *
          (isWidePhone ? 2 : 1);
        const originalCell = col.Cell;
        return {
          ...col,
          size: width,
          minSize: 50,
          maxSize: 500,
          Cell: (props) => {
            const content = originalCell
              ? originalCell(props)
              : props.renderedCellValue;
            return content === '' || content === null || content === undefined
              ? '-'
              : content;
          }
        };
      }),
    [columns]
  );

  const [columnFilterFns, setColumnFilterFns] = useState(
    JSON.parse(params.get('filterFns') || 'null') ||
      Object.fromEntries(
        columns.map(({ accessorKey, id }) => {
          if (
            id === 'dateOfDeparture' ||
            id === 'dateOfReturn' ||
            id === 'dateOfCreature'
          ) {
            return [id, 'equals'];
          }

          if (
            id === 'busFlightTo' ||
            id === 'busFlightFrom' ||
            id === 'origin' ||
            id === 'destination'
          ) {
            return [id, 'contains'];
          }

          return [id, 'contains'];
        })
      )
  );

  console.log('COLUMN FILTER FNS: ', columnFilterFns);

  const {
    data,
    isLoading: getTicketsIsLoading,
    isSuccess,
    isError: getTicketsIsError,
    isFetching: getTicketsIsFetching,
    error: getTicketsError,
    refetch
  } = useGetTicketsQuery(
    {
      start: (pagination.pageIndex || 0) * pagination.pageSize,
      size: pagination.pageSize,
      filters: JSON.stringify(columnFilters ?? []),
      filtersFns: JSON.stringify(columnFilterFns ?? []),
      sorting: JSON.stringify(sorting ?? []),
      // Route-based sort ("Сортувати за маршрутом …") is global, so the backend
      // applies it; sending it as a query arg also makes RTK Query refetch when
      // it changes.
      customSorting: JSON.stringify(customSorting ?? [])
    },
    {
      refetchOnFocus: false
    }
  );

  console.log('TICKETS DATA: ', data);

  const openDeleteConfirmModal = (row: MRT_Row<Ticket>) => {
    setCurrId(row.original.ticketId || '0');
    setCurrTicketNumber(row.original.ticketNumber || '');
    async function deleteTicket() {
      if (
        window.confirm(
          `Ви впевнені, що хочете видалити квиток з номером ${
            row?.original?.ticketNumber || '0'
          }?`
        )
      ) {
        // Remove this passenger from the ticket. passengerType is normalized to
        // a flat 'adult'/'child' string, but guard the { id, name } shape too.
        const rawType = (row?.original as any)?.passengerType;
        const type =
          (typeof rawType === 'object' ? rawType?.id : rawType) === 'child'
            ? 'child'
            : 'adult';
        await deleteFn({
          type,
          ticketId: row?.original?.ticketId || '0',
          id: String(row?.original?.passengerId ?? '0')
        });
      }
    }
    deleteTicket();
    return;
  };

  const openSendTicketModal = (row: MRT_Row<Ticket>) => {
    setSendTicketModalOpen(true);
    setSendTicketModalRow(row);
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

  const handleCustomSotring = (colId: string, order: CustomOrder) => {
    setCustomSorting((prev) => {
      return [{ id: colId, order }];
    });
  };

  const handleGenerateTicket = async (
    id: string,
    passengerId?: string,
    cb: () => void = () => {}
  ) => {
    setCurrId(id);
    // The table is one row per passenger, so (re)generate only this passenger's
    // PDF. Omitting passengerId would regenerate every passenger on the ticket.
    await generateFn({ id, passengerId });
    cb();
  };

  const handleDeleteTicketPdf = async (
    id: string,
    passengerId?: string,
    cb: () => void = () => {}
  ) => {
    setCurrId(id);
    // Delete only this passenger's PDF (one row per passenger). Omitting
    // passengerId would remove every PDF on the ticket.
    await deletePdfFn({ id, passengerId });
    cb();
  };

  const handleCreateTicket: MRT_TableOptions<Ticket>['onCreatingRowSave'] =
    async ({ values, table }) => {
      let isError = false;

      const newValidationErrors = validateTicket(values, discountCardIds);

      if (Object.values(newValidationErrors).some((error) => !!error)) {
        setValidationErrors((prev) => {
          return { ...prev, ...newValidationErrors };
        });
        isError = true;
      }

      // Validate the extra passengers (if any); collect per-passenger errors.
      const extraErrors: AdditionalPassengerErrors = {};
      additionalPassengers.forEach((p) => {
        const errs = validateAdditionalPassenger(p, discountCardIds);
        if (Object.values(errs).some(Boolean)) {
          extraErrors[p.key] = errs;
          isError = true;
        }
      });
      setAdditionalPassengerErrors(extraErrors);

      if (isError) return;

      setValidationErrors((prev) => {
        const entries = Object.entries(prev);
        const filteredEntries = entries.filter(
          (el) => !String(el[0]).includes('create')
        );
        return Object.fromEntries(filteredEntries);
      });

      // POST expects ticket-level fields + passengers[]/children[] arrays;
      // buildCreateTicketBody normalises the single create row into that shape.
      const transformRefs = {
        types: ticketAttributesData?.data?.types,
        statuses: ticketAttributesData?.data?.statuses,
        discounts: discountsData?.data,
        agents: agentsData?.data
      };
      const body = buildCreateTicketBody(values, transformRefs);
      if (!body) return;

      // Append the extra passengers to the matching POST array (adults →
      // passengers[], children → children[]), shaped like buildCreateTicketBody's
      // own items.
      const amountOrNull = (v: string) =>
        v && Number(v) > 0 ? Number(v) : null;
      // Extra passengers inherit the ticket-level currency entered on the create
      // row. Send the *UAH pair for a UAH ticket, the raw pair otherwise — same
      // currency-aware contract as the main passenger (one pair, not both).
      const extraPayments = (p: {
        paymentOnBus: string;
        paymentAtOffice: string;
      }) =>
        isUAHCurrency(values?.currency)
          ? {
              paymentOnBusUAH: amountOrNull(p.paymentOnBus),
              paymentAtOfficeUAH: amountOrNull(p.paymentAtOffice)
            }
          : {
              paymentOnBus: amountOrNull(p.paymentOnBus),
              paymentAtOffice: amountOrNull(p.paymentAtOffice)
            };
      const extraAdults = additionalPassengers
        .filter((p) => p.passengerType === 'adult')
        .map((p) => ({
          name: p.name,
          lastName: p.lastName,
          passengerType: { id: 'adult', name: 'adult' },
          phone: p.phone || null,
          additionalPhone: p.additionalPhone || null,
          email: p.email || null,
          dateOfBirth: p.dateOfBirth
            ? dayjs(p.dateOfBirth).format('YYYY-MM-DD')
            : null,
          passengerDiscount: p.passengerDiscount,
          discountCardNumber: p.discountCardNumber || null,
          ...extraPayments(p),
          agent: p.agent,
          passengerConfirmation: p.passengerConfirmation,
          busSeat: p.busSeat || null,
          note: p.note || null
        }));
      const extraChildren = additionalPassengers
        .filter((p) => p.passengerType === 'child')
        .map((p) => ({
          name: p.name,
          lastName: p.lastName,
          passengerType: { id: 'child', name: 'child' },
          dateOfBirth: p.dateOfBirth
            ? dayjs(p.dateOfBirth).format('YYYY-MM-DD')
            : null,
          passengerDiscount: p.passengerDiscount,
          ...extraPayments(p),
          agent: p.agent,
          passengerConfirmation: p.passengerConfirmation,
          busSeat: p.busSeat || null,
          note: p.note || null
        }));
      body.passengers = [...(body.passengers ?? []), ...extraAdults];
      body.children = [...(body.children ?? []), ...extraChildren];

      await createFn(body as CreateTicketBody);
      setNumOfFreeSeats({ busFlightTo: null, busFlightFrom: null });
      setAdditionalPassengers([]);
      setAdditionalPassengerErrors({});
      table.setCreatingRow(null); //exit creating mode
    };

  const validateDataOnLoad = useCallback(
    (data: Ticket[]) => {
      // Authoritative per-row recompute: set the error when the return leg is
      // missing AND clear it when it's present, so a stale error doesn't linger
      // after a refetch returns valid data (e.g. another passenger of the same
      // booking gets the return flight, so this row is now valid too).
      setValidationErrors((prev) => {
        const next = { ...prev };
        data.forEach((el) => {
          const toKey = el.ticketNumber + '_busFlightTo';
          const returnKey = el.ticketNumber + '_dateOfReturn';
          if (!isOneWayTicket(el.type || '')) {
            // Round-trip ticket missing its return leg (e.g. after switching
            // type from "Відкрита дата") → required.
            const busFlightTo = el.busFlightTo as any;
            const hasReturnFlight = !!(
              busFlightTo &&
              busFlightTo !== '-' &&
              (typeof busFlightTo === 'object' ? busFlightTo.id : busFlightTo)
            );
            if (!hasReturnFlight) next[toKey] = "Поле обов'язкове";
            else delete next[toKey];

            if (!isDateSelected(el.dateOfReturn))
              next[returnKey] = "Поле обов'язкове";
            else delete next[returnKey];
          } else {
            // One-way / open-date: the return leg isn't required — clear any
            // stale errors left over from a previous type.
            delete next[toKey];
            delete next[returnKey];
          }

          // Payments: each is required only when the other is empty, so a row
          // with both cleared is invalid on load (not just while editing).
          // Drive this off the same getTicketFieldError rule the cells use.
          const onBusKey = el.ticketNumber + '_paymentOnBus';
          const atOfficeKey = el.ticketNumber + '_paymentAtOffice';
          const onBusError = getTicketFieldError('paymentOnBus', el);
          const atOfficeError = getTicketFieldError('paymentAtOffice', el);
          if (onBusError) next[onBusKey] = onBusError;
          else delete next[onBusKey];
          if (atOfficeError) next[atOfficeKey] = atOfficeError;
          else delete next[atOfficeKey];
        });
        return next;
      });
    },
    [setValidationErrors]
  );

  const table = useMaterialReactTable({
    autoResetPageIndex: false,
    columns: sizedColumns,
    createDisplayMode: 'modal', // ("modal", and "custom" are also available)
    data: initialData,
    // MRT injects the required `open`/`onClose` itself; we only widen the paper.
    // @ts-ignore - partial DialogProps is accepted at runtime
    muiCreateRowModalProps: {
      sx: {
        '& .MuiDialog-paper': {
          width: '640px',
          maxWidth: '640px'
        }
      }
    },
    // defaultDisplayColumn: {
    //   enableResizing: true, //turn on some features that are usually off for all display columns
    // },
    displayColumnDefOptions: {
      'mrt-row-numbers': {
        muiTableHeadCellProps: {
          children: (
            <span>
              № <br /> п/п
            </span>
          )
        }
      }
    },
    // defaultColumn: {
    //   minSize: 20,
    //   maxSize: 180,
    //   size: 100,
    // },
    editDisplayMode: 'cell', // ("modal", "row", "cell", and "custom", "table" are also
    //@ts-ignore
    enableCellActions: true,
    enableColumnFilterModes: true,
    enableColumnPinning: true,
    enableRowPinning: false,
    enableColumnResizing: true,
    columnResizeMode: 'onEnd', //instead of the default "onChange" mode
    enableEditing: true,
    // enableExpanding: true,
    // enableExpandAll: false,
    enableFullScreenToggle: true,
    enableGlobalFilter: false,
    enableMultiSort: true,
    // enablePagination: false,
    enableRowActions: true,
    enableRowNumbers: true,
    rowNumberDisplayMode: 'original',
    enableStickyFooter: true,
    enableStickyHeader: true,
    getRowId: (row) => {
      // ticketNumber is unique per row; ticketId repeats across the passengers
      // of a multi-passenger booking, so it can't identify a row on its own.
      return row.ticketNumber || '';
    },
    initialState: {
      columnVisibility: {
        ticketId: false
        // isPDFExists: false
      },
      // isFullScreen: true,
      expanded: true,
      density: 'compact',
      showColumnFilters: true,
      // Column order follows the passenger-manifest layout. № п/п
      // (mrt-row-numbers) and № квитка (ticketNumber) come first and are
      // pinned left; row actions stay pinned right. Columns not on the
      // manifest follow after the manifest ones.
      columnOrder: [
        'mrt-row-numbers', // № п/п
        'ticketNumber', // № квитка (pinned left)
        'lastName', // Прізвище
        'name', // Ім'я
        'dateOfBirth', // Дата народження
        'passengerType', // Тип пасажира
        'confirmation', // Підтвердження
        'paymentOnBus', // Оплата в автобусі
        'paymentAtOffice', // Оплата в бюро
        'discount', // Акційна знижка
        'passengerDiscount', // Знижка пасажира
        'discountCardNumber', // Дисконтна карта
        'type', // Тип квитка
        'origin', // Пункт відправлення
        'destination', // Пункт прибуття
        'dateOfDeparture', // Дата відправлення
        'dateOfReturn', // Дата повернення
        'busFlightFrom', // Рейс відправлення
        'busFlightTo', // Рейс повернення
        'phone', // Телефон
        'agent', // Агентство
        'busSeat', // Місце
        'note', // Примітка
        // Remaining columns (left as-is, after the ordered set)
        'price',
        'currency',
        'dateOfCreature',
        'additionalPhone',
        'email',
        'status',
        'ticketId',
        'mrt-row-actions'
      ],
      columnPinning: {
        left: ['mrt-row-numbers', 'ticketNumber'],
        right: ['mrt-row-actions']
      }
    },
    isMultiSortEvent: () => true,
    // layoutMode: "semantic",
    localization: {
      ...MRT_Localization_UK
    },
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    muiBottomToolbarProps: {
      sx: {
        minHeight: '3.5rem!important'
      }
    },
    muiFilterDatePickerProps: {
      format: 'DD-MM-YYYY',
      timezone: 'UTC'
    },

    muiTableBodyRowProps: ({ isDetailPanel, row, table }) => {
      const isError = validationErrorsExist[row?.id];
      return {
        sx: (theme) => ({
          backgroundColor: isError ? theme.palette.error.light : 'white'
        })
      };
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: 'clamp(350px, calc(100vh - 135px), 9999px)'
      }
    },
    muiTableHeadProps: {
      sx: (theme) => ({
        zIndex: 5
      })
    },
    muiTablePaperProps: ({ table }) => ({
      //not sx
      style: {
        zIndex: isFullScreen ? 1000 : undefined,
        borderRadius: isFullScreen ? '0' : '10px'
      }
    }),
    muiPaginationProps: {
      rowsPerPageOptions: [...VALID_PAGE_SIZES],
      showFirstButton: true,
      showLastButton: true
    },
    muiTopToolbarProps: {
      sx: {
        minHeight: '3.5rem!important'
      }
    },
    muiToolbarAlertBannerProps: getTicketsIsError
      ? {
          color: 'error',
          children: `Виникла помилка. Неможливо завантажити дані. ${
            'data' in getTicketsError
              ? 'status' in (getTicketsError.data as any)
                ? (getTicketsError.data as any).status
                : JSON.stringify(getTicketsError)
              : JSON.stringify(getTicketsError)
          }.`
        }
      : undefined,
    onCreatingRowCancel: () => {
      setValidationErrors((prev) => {
        const entries = Object.entries(prev);
        const filteredEntries = entries.filter(
          (el) => !String(el[0]).includes('create')
        );
        return Object.fromEntries(filteredEntries);
      });

      setNumOfFreeSeats({ busFlightTo: null, busFlightFrom: null });
      setEditedTicket({});
      setAdditionalPassengers([]);
      setAdditionalPassengerErrors({});
      if (actionState) setActionState(null);
    },
    onCreatingRowSave: handleCreateTicket,
    onColumnFilterFnsChange: setColumnFilterFns,
    // @ts-ignore
    // Drop filters whose value is empty (incl. `[null, null]` ranges left behind
    // by MRT's range-filter clear) so a cleared/reset filter is removed instead
    // of sent to the backend as an all-empty constraint that matches nothing.
    onColumnFiltersChange: (updater: any) =>
      setColumnFilters((old: any) => {
        const next = typeof updater === 'function' ? updater(old) : updater;
        return (next ?? []).filter((f: any) => !isEmptyFilterValue(f?.value));
      }),
    onIsFullScreenChange: setIsFullScreen,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    renderCreateRowDialogContent: ({ table, row, internalEditComponents }) => (
      <>
        <DialogTitle variant="h3">Створити квиток</DialogTitle>
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
            {internalEditComponents}
            <Divider
              sx={(theme) => ({
                height: '2px',
                mt: 2,
                mb: 2,
                borderColor: theme.colors.alpha.black[100],
                background: theme.colors.alpha.black[100]
              })}
            />
            <AdditionalPassengersSection
              passengers={additionalPassengers}
              setPassengers={setAdditionalPassengers}
              errors={additionalPassengerErrors}
              setErrors={setAdditionalPassengerErrors}
              discounts={discountsData?.data ?? []}
              discountCardIds={discountCardIds}
              agents={
                agentsData?.data?.map((a) => ({
                  id: String(a.id),
                  value: a.value,
                  label: a.label
                })) ?? []
              }
              confirmations={ticketAttributesData?.data?.confirmations ?? []}
              promoDiscountActive={hasPromoDiscount(
                (row._valuesCache as any)?.discount
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%'
            }}
          >
            <MRT_EditActionButtons variant="text" table={table} row={row} />
          </Box>
        </DialogActions>
      </>
    ),
    renderRowActionMenuItems: ({ closeMenu, row }) => [
      <MenuItem
        key="generate"
        onClick={() => {
          setCurrTicketNumber(row.original.ticketNumber || '');
          handleGenerateTicket(
            row.original.ticketId || '',
            String(row.original.passengerId ?? ''),
            closeMenu
          );
        }}
        disabled={
          (Object.values({ ...validationErrors }).some((error) => !!error) ||
            row.original.isPDFExists ||
            generateIsLoading) &&
          !downloadIsError
        }
      >
        {generateIsLoading && <CircularProgress color="inherit" size={18} />}
        Згенерувати PDF квиток
      </MenuItem>,
      <MenuItem
        key="download"
        onClick={async () => {
          setCurrTicketNumber(row.original.ticketNumber || '');
          await downloadTicketFn({
            ticketId: row.original.ticketId,
            passengerId: row.original.passengerId,
            childKey: row.original.childKey,
            filename: `Benz_Express_Ticket_${row.original.ticketNumber}.pdf`
          });
          closeMenu();
        }}
        disabled={!row.original.isPDFExists || downloadIsLoading}
      >
        {/* {downloadIsLoading && <CircularProgress color="inherit" size={18} />} */}
        Завантажити PDF квиток
      </MenuItem>,
      <MenuItem
        key="send"
        onClick={() => {
          closeMenu();
          openSendTicketModal(row);
        }}
        disabled={!row.original.isPDFExists}
      >
        Надіслати PDF квиток на пошту
      </MenuItem>,
      <MenuItem
        key="delete-pdf"
        onClick={async () => {
          setCurrTicketNumber(row.original.ticketNumber || '');
          await handleDeleteTicketPdf(
            row.original.ticketId || '',
            String(row.original.passengerId ?? ''),
            closeMenu
          );
        }}
        disabled={!row.original.isPDFExists || deletePdfIsLoading}
      >
        {deletePdfIsLoading && <CircularProgress color="inherit" size={18} />}
        Видалити PDF квиток
      </MenuItem>,
      <MenuItem
        key="delete"
        onClick={() => {
          closeMenu();
          openDeleteConfirmModal(row);
        }}
        disabled={Object.values({ ...validationErrors }).some(
          (error) => !!error
        )}
      >
        Видалити
      </MenuItem>
    ],
    renderTopToolbarCustomActions: ({ table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', p: '4px' }}>
          <Tooltip arrow title="Перезавантажити">
            <IconButton
              onClick={() => {
                // Discard in-progress edits and any stale validation errors —
                // the refetch brings fresh, server-valid data, and
                // validateDataOnLoad re-applies the authoritative load-time
                // errors (missing payments / return leg) afterwards.
                table.setEditingCell(null);
                setEditedTicket({});
                setValidationErrors({});
                refetch();
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            disabled={
              getTicketsIsLoading ||
              ticketAttributesIsLoading ||
              currenciesIsLoading ||
              citiesIsLoading ||
              discountsIsLoading ||
              Object.values({ ...validationErrors }).some((error) => !!error)
            }
            sx={{ mt: { xs: 2, md: 0 } }}
            variant="contained"
            startIcon={<AddTwoToneIcon fontSize="small" />}
            onClick={() => {
              if (!actionState) setActionState('create');
              table.setCreatingRow(true);
            }}
          >
            Створити квиток
          </Button>
          <TopToolbarMenu
            disabled={
              getTicketsIsLoading ||
              ticketAttributesIsLoading ||
              currenciesIsLoading ||
              citiesIsLoading ||
              discountsIsLoading ||
              Object.values({ ...validationErrors }).some((error) => !!error)
            }
            table={table}
            columns={COLUMNS_DEFINITIONS}
            validationErrors={{ ...validationErrors }}
          />
        </Box>
      );
    },
    // Append the filter/sort reset actions to the built-in internal toolbar
    // buttons (show/hide filters, columns, density, fullscreen) instead of
    // burying them in the export popover.
    renderToolbarInternalActions: ({ table }) => (
      // Render the built-in buttons individually (NOT MRT_ToolbarInternalButtons
      // — that component itself calls renderToolbarInternalActions, so nesting it
      // here would recurse infinitely → out of memory).
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip arrow title="Скинути фільтри">
          <IconButton
            onClick={() => {
              // resetColumnFilters clears every column's filter value; the date
              // pickers read straight off the column filter value, so they
              // follow automatically (no separate scalar state to reset).
              table.resetColumnFilters(true);
            }}
          >
            <RestartAltIcon />
          </IconButton>
        </Tooltip>
        <Tooltip arrow title="Скинути сортування">
          <IconButton
            onClick={() => {
              table.resetSorting();
              // Also clear route-based custom sorting (separate state from MRT's
              // sorting); empty triggers a refetch in default order.
              setCustomSorting([]);
            }}
          >
            <CancelPresentationIcon />
          </IconButton>
        </Tooltip>
        <MRT_ToggleFiltersButton table={table} />
        <MRT_ShowHideColumnsButton table={table} />
        <MRT_ToggleDensePaddingButton table={table} />
        <MRT_ToggleFullScreenButton table={table} />
      </Box>
    ),
    renderBottomToolbarCustomActions: () => (
      <Box sx={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {Object.values(validationErrors).some((error) => !!error) && (
          <Typography color="error">Виправте помилки, будь ласка</Typography>
        )}
      </Box>
    ),
    // renderDetailPanel: ({ row, table }) => {
    //   return (
    //     <div style={{ padding: '16px', width: '100%' }}>
    //       This is a detail panel for ticket with id: {row.original.ticketId}.
    //       You can put any content here, even a nested table! (scroll down to see
    //       more example)
    //     </div>
    //   );
    // },
    positionActionsColumn: 'last',
    rowCount: data?.meta?.totalRowCount ?? 0,
    state: {
      isFullScreen,
      isLoading:
        getTicketsIsLoading ||
        ticketAttributesIsLoading ||
        currenciesIsLoading ||
        citiesIsLoading ||
        discountsIsLoading,
      pagination,
      isSaving: createIsLoading,
      showAlertBanner: getTicketsIsError,
      showProgressBars: getTicketsIsFetching,
      columnFilters,
      columnFilterFns,
      sorting
    },
    muiDetailPanelProps: () => ({
      sx: (theme) => ({
        backgroundColor:
          theme.palette.mode === 'dark'
            ? 'rgba(255,210,244,0.1)'
            : 'rgba(0,0,0,0.1)',
        padding: 0
      })
    }),
    muiExpandButtonProps: ({ row }) => ({
      sx: {
        transform: row.getIsExpanded() ? 'rotate(180deg)' : 'rotate(-90deg)',
        transition: 'transform 0.2s'
      }
    })
  });

  useEffect(() => {
    let queryString: string = `/dashboards/tickets?pageSize=${
      pagination.pageSize
    }&pageIndex=${pagination.pageIndex}&filters=${JSON.stringify(
      columnFilters ?? []
    )}&filterFns=${JSON.stringify(
      columnFilterFns ?? []
    )}&sorting=${JSON.stringify(sorting ?? [])}&customSorting=${JSON.stringify(
      customSorting ?? []
    )}`;

    setValidationErrors((prev) => {
      const entries = Object.entries(prev);
      const filteredEntries = entries.filter((el) =>
        String(el[0]).includes('create')
      );
      return Object.fromEntries(filteredEntries);
    });

    navigate(queryString);

    async function getData() {
      await refetch();
    }

    getData();
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    columnFilters,
    columnFilterFns,
    sorting
  ]);

  useEffect(() => {
    if (
      deleteIsSuccess ||
      updateIsSuccess ||
      createIsSuccess ||
      generateIsSuccess ||
      downloadIsSuccess
    ) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: makeSuccessResultMessage({
          createIsSuccess,
          updateIsSuccess,
          deleteIsSuccess,
          generateIsSuccess,
          downloadIsSuccess,
          type: 'ticket',
          ticketId: currId,
          ticketNumber: currTicketNumber
        }),
        open: true,
        severity: 'success'
      });
      {
        createReset();
        updateReset();
        deleteReset();
        generateReset();
        downloadReset();
      }
      setCurrId('0');
      setCurrTicketNumber('');
      setEditedTicket({});
      if (actionState) setActionState(null);
    }
  }, [
    deleteIsSuccess,
    updateIsSuccess,
    createIsSuccess,
    generateIsSuccess,
    downloadIsSuccess
  ]);

  useEffect(() => {
    if (
      deleteIsError ||
      updateIsError ||
      createIsError ||
      generateIsError ||
      downloadIsError
    ) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `${makeErrorResultMessage({
          createIsError,
          deleteIsError,
          updateIsError,
          generateIsError,
          downloadIsError,
          type: 'ticket',
          ticketId: currId,
          ticketNumber: currTicketNumber
        })} ${JSON.stringify(
          updateError ||
            deleteError ||
            generateError ||
            downloadError ||
            createError ||
            null,
          null,
          2
        )}`,
        open: true,
        severity: 'error'
      });
      {
        createReset();
        updateReset();
        deleteReset();
        generateReset();
        // downloadReset();
      }
      setCurrId('0');
      setCurrTicketNumber('');
      setEditedTicket({});
      if (actionState) setActionState(null);
      setInitialData((prev) => (prev ? [...prev] : prev));
    }
  }, [
    deleteIsError,
    updateIsError,
    createIsError,
    generateIsError,
    downloadIsError
  ]);

  // Delete-PDF has its own snackbar (the templated message helper doesn't have
  // a PDF-delete phrasing). On success the Ticket cache is invalidated, so the
  // row refetches and the generate/delete-PDF actions re-enable accordingly.
  useEffect(() => {
    if (deletePdfIsSuccess) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `PDF квитка з номером ${currTicketNumber} успішно видалений!`,
        open: true,
        severity: 'success'
      });
      deletePdfReset();
      setCurrId('0');
      setCurrTicketNumber('');
    }
  }, [deletePdfIsSuccess]);

  useEffect(() => {
    if (deletePdfIsError) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `Виникла помилка при видаленні PDF квитка${
          currTicketNumber ? ' з номером ' + currTicketNumber : ''
        }! ${JSON.stringify(deletePdfError ?? null, null, 2)}`,
        open: true,
        severity: 'error'
      });
      deletePdfReset();
      setCurrId('0');
      setCurrTicketNumber('');
    }
  }, [deletePdfIsError]);

  useEffect(() => {
    if (isNaN(parseInt(params.get('pageIndex') || 'null', 10))) {
      setPagination((prev) => ({
        pageIndex: data?.meta?.startPage ?? 0,
        pageSize: prev.pageSize
      }));
    }
  }, [data?.meta?.startPage]);

  useEffect(() => {
    if (actionState === 'create') return;
    if (table.getState()?.creatingRow?.id === 'mrt-row-create') return;
    if (!Object.keys(editedTicket).length) return;
    if (isValidationErrorsExist(editedTicket, { ...validationErrors })) return;

    const ticketArr = Object.values(editedTicket);
    const editedRow = ticketArr?.[0] as Ticket | undefined;
    // editedRow comes from the table value cache, which only holds column
    // values (no passengerId, childKey, etc.). Find the full original row by
    // ticketNumber (unique per passenger) and overlay the edits on it, so the
    // body carries every field the backend needs — including passengerId.
    const originalRow = initialData?.find(
      (el) => el.ticketNumber === editedRow?.ticketNumber
    );
    if (!originalRow) return;

    // Reference lists so transformTicket can re-inflate type/status (stored as
    // strings in the row) back into the { id, name } objects the PUT body uses.
    const transformRefs = {
      types: ticketAttributesData?.data?.types,
      statuses: ticketAttributesData?.data?.statuses,
      discounts: discountsData?.data,
      agents: agentsData?.data
    };
    // `price` is read-only (backend-calculated) and its column maps to
    // passengerPrice, so the edit cache's `price` holds the passenger price, not
    // the booking price. Drop it from the overlay so it never drives the diff
    // (which otherwise fires a spurious update on a no-op edit). The body keeps
    // the original booking price.
    const { price: _ignoredPrice, ...editedRowFields } = (editedRow ||
      {}) as Record<string, any>;
    const ticket = transformTicket(
      { ...originalRow, ...editedRowFields } as Ticket,
      transformRefs
    );
    const prevTicket = transformTicket(originalRow, transformRefs);
    if (!ticket || !prevTicket) return;

    const orderedTicket = orderObjectKeys({ ...ticket });
    const orderedPrevTicket = orderObjectKeys({ ...prevTicket });

    const ticketHash = hashCode(JSON.stringify(orderedTicket));
    const prevTicketHash = hashCode(JSON.stringify(orderedPrevTicket));

    if (ticketHash !== prevTicketHash) {
      const { ticketId, ...rest } = ticket as Ticket;

      const body = {
        ...rest
      };

      setCurrTicketNumber(
        editedRow?.ticketNumber || originalRow?.ticketNumber || ''
      );

      async function update() {
        await updateFn({ body, id: String(ticketId) });
      }

      update();
    }
  }, [editedTicket, actionState]);

  useEffect(() => {
    if (data?.data) {
      // const rows = table.getRowModel().rows?.map(el => el._valuesCache);
      // const validationErrorsKeys = Object.keys({...validationErrors });

      // setInitialData(!(validationErrorsKeys.length) ? data.data :
      // [
      //   ...data.data.filter(el => !isValidationErrorsExist({[el.ticketId || ""]: el.ticketId ? el : ({} as Ticket)}, {...validationErrors })),
      //   ...rows.filter(el => isValidationErrorsExist({[el.ticketId || ""]: el.ticketId ? el : ({} as Ticket)}, {...validationErrors }))
      // ]);

      // validateDataOnLoad(!(validationErrorsKeys.length) ? data.data :
      // [
      //   ...data.data.filter(el => !isValidationErrorsExist({[el.ticketId || ""]: el.ticketId ? el : ({} as Ticket)}, {...validationErrors })),
      //   ...rows.filter(el => isValidationErrorsExist({[el.ticketId || ""]: el.ticketId ? el : ({} as Ticket)}, {...validationErrors }))
      // ]);

      // The API returns type/status/passengerType/agent as { id, name } objects
      // and confirmation as `passengerConfirmation`; flatten to the strings the
      // table/validation/edit code consumes (matching the create-form shape).
      const normalized = data.data.map((el: any) =>
        normalizeTicket(el, ticketAttributesData?.data?.confirmations || [])
      );
      setInitialData(normalized);
      validateDataOnLoad(normalized);
    }
  }, [data?.meta?.timestamp, ticketAttributesData?.data?.confirmations]);

  useEffect(() => {
    table.getRowModel().rows.forEach((row) => {
      if (row.id) {
        const isError = isValidationErrorsExist(
          {
            [row.id]: {
              ...row._valuesCache
            }
          },
          { ...validationErrors }
        );

        setValidationErrorsExist((prev) => ({
          ...prev,
          [row.id]: isError
        }));
      }
    });
  }, [validationErrors]);

  useEffect(() => {
    dispatch(setFullScreen(isFullScreen));
  }, [isFullScreen]);

  useEffect(() => {
    console.log('mounted');
    console.log(sendTicketModalRow, 'sendTicketModalRow');
  }, []);

  useEffect(() => {
    tableInstanceRef.current = table;
  }, [table]);

  return (
    <Card style={{ width: '100%' }}>
      <MaterialReactTable table={table} />

      <PositionedSnackbar
        state={snackBarState}
        handleClose={handleSnackBarClose}
      />
      <SendTicketMailModal
        open={sendTicketModalOpen}
        onClose={() => {
          setSendTicketModalOpen(false);
          setSendTicketModalRow(null);
        }}
        row={sendTicketModalRow}
        handleSnackBarOpen={handleSnackBarOpen}
        key={sendTicketModalRow?.id}
      />
    </Card>
  );
};

export default TicketsTable;

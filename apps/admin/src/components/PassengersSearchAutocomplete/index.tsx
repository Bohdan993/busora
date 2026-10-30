import {
  useState,
  useEffect,
  forwardRef,
  type ForwardedRef,
  type KeyboardEvent,
  type MouseEvent,
  type FocusEvent
} from 'react';
import { SearchAutocomplete } from 'src/components/SearchAutocomplete';
import { useDebounce } from 'src/helpers/hooks';
import {
  type MRT_RowData,
  type MRT_Row,
  type MRT_TableInstance
} from 'material-react-table';
import dayjs, { type Dayjs } from 'dayjs';
import { useLazySearchPassengersQuery } from 'src/services/passenger';
import { type PassengerOption } from 'src/types/passengers';

interface PassengersSearchAutocompleteOption extends PassengerOption {}

interface PassengersSearchAutocompleteProps<TData extends MRT_RowData> {
  table: MRT_TableInstance<TData>;
  row: MRT_Row<TData>;
  ticketId: string;
  disabled?: boolean;
  textFieldProps?: any;
}

// forwardRef is required because react-phone-number-input (this component is
// used as its `inputComponent`) forwards a ref to the input and calls
// `.focus()` on it after a country change. Without forwarding, that ref is
// null and the country switch throws "Cannot read properties of null
// (reading 'focus')". We route the ref to the real <input> via the
// TextField's inputRef below.
const PassengersSearchAutocompleteInner = <TData extends MRT_RowData>(
  {
    table,
    row,
    disabled,
    ticketId,
    textFieldProps,
    ...rest
  }: PassengersSearchAutocompleteProps<TData>,
  ref: ForwardedRef<HTMLInputElement>
) => {
  // Guard: bail if rendered without a table instance instead of crashing on
  // the `const { refs } = table` destructure below.
  if (!table) return null;
  const [options, setOptions] = useState<
    PassengersSearchAutocompleteOption[] | []
  >([]);
  // When used as react-phone-number-input's inputComponent, the current phone
  // arrives as a `value` prop (in ...rest). Seed the displayed text from it so
  // the existing value shows in edit mode. (Real passenger-search usages pass
  // no `value`, so this stays empty there.)
  const incomingValue =
    typeof (rest as any).value === 'string' ? (rest as any).value : '';
  // Seed the selected option too: MUI Autocomplete resets the input text to
  // getOptionLabel(value) on mount, so a null option would wipe the seeded
  // text back to "". A synthetic { label } option keeps the phone visible.
  const incomingOption = incomingValue
    ? ({ label: incomingValue } as PassengersSearchAutocompleteOption)
    : null;
  const [option, setOption] =
    useState<PassengersSearchAutocompleteOption | null>(incomingOption);
  const [value, setValue] = useState<string>(incomingValue);
  const debouncedSearchTerm = useDebounce(value, 250);
  const [search, { data, error, isLoading, isFetching }] =
    useLazySearchPassengersQuery();

  const {
    refs: { editInputRefs },
    getState,
    setEditingCell
    // setEditingRow,
    // setCreatingRow
  } = table;
  const { editingRow, creatingRow } = getState();
  const { onChange, ...restTextFieldProps } = textFieldProps;

  // When this component is react-phone-number-input's inputComponent, the
  // library passes its own value/onChange in ...rest ("phone mode"). In that
  // mode we keep the passenger search but also let the user freely type a
  // number: typed text is pushed into react-phone-number-input so the phone
  // value updates/saves even when no passenger is selected.
  const reactPhoneOnChange = (rest as any).onChange;
  const isPhoneMode = typeof reactPhoneOnChange === 'function';

  // Assign the DOM input node to the ref react-phone-number-input forwarded
  // (it may be a callback ref or an object ref), so its focus() call works.
  const assignInputRef = (node: HTMLInputElement | null) => {
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const [open, setOpen] = useState(false);
  // const isCreating = creatingRow?.id === row.id;
  // const isEditing = editingRow?.id === row.id;

  const saveInputValueToRowCache = (
    newValue:
      | (Omit<
          PassengersSearchAutocompleteOption,
          'label' | 'id' | 'dateOfBirth'
        > & { passengerId: string; dateOfBirth?: string | Dayjs })
      | undefined
  ) => {
    //@ts-ignore
    row._valuesCache = newValue;
    // if (isCreating) {
    //   setCreatingRow(row);
    // } else if (isEditing) {
    //   setEditingRow(row);
    // }
  };

  const handleChange = (value: PassengersSearchAutocompleteOption | null) => {
    if (value !== null) {
      setOption(value);
      // Phone mode: selecting a found passenger should autofill the row's
      // passenger data fields (not just the phone). Merge them into the existing
      // cache so the row's identity (ticketNumber, passengerId) and ticket-level
      // fields are preserved — the save onBlur then PUTs the new fields.
      if (isPhoneMode) {
        reactPhoneOnChange({ target: { value: value?.phone || '' } });
        const isCreatingRow = creatingRow?.id === row.id;
        if (isCreatingRow) {
          // Create: there's no existing ticket↔passenger link yet, so autofill
          // the new row's passenger fields from the selected passenger.
          saveInputValueToRowCache({
            passengerId: value?.passengerId || '1',
            passengerType: 'adult',
            name: value?.name || '',
            lastName: value?.lastName || '',
            phone: value?.phone || '',
            additionalPhone: value?.additionalPhone || '-',
            dateOfBirth: dayjs(value?.dateOfBirth).isValid()
              ? dayjs(value?.dateOfBirth).startOf('day').utc(true)
              : '',
            email: value?.email || '',
            passengerDiscount: { id: '0', percentage: 0, name: 'Без знижки' },
            discountCardNumber: null
          });
        } else {
          // Edit: re-link this ticket row to the selected existing passenger.
          // Keep the original passengerId (the backend uses it to LOCATE the
          // junction row) and send newPassengerId as the re-link target. We do
          // NOT overwrite name/dateOfBirth/etc. here: re-linking must not edit
          // the target passenger's record — the row reflects the new passenger
          // after the refetch.
          //@ts-ignore
          row._valuesCache = {
            //@ts-ignore
            ...row._valuesCache,
            newPassengerId: value?.passengerId
          };
        }
        return;
      }
      saveInputValueToRowCache({
        passengerId: value?.passengerId || '1',
        passengerType: 'adult',
        name: value?.name || '',
        lastName: value?.lastName || '',
        phone: value?.phone || '',
        additionalPhone: value?.additionalPhone || '-',
        dateOfBirth: dayjs(value?.dateOfBirth).isValid()
          ? dayjs(value?.dateOfBirth).startOf('day').utc(true)
          : '',
        email: value?.email || '',
        passengerDiscount: { id: '0', percentage: 0, name: 'Без знижки' },
        discountCardNumber: null
      });
    } else {
      saveInputValueToRowCache({
        // passengerId: "",
        // passengerType: undefined,
        // name: "",
        // lastName: "",
        // phone: "",
        // additionalPhone: "",
        // dateOfBirth: "",
        // email: "",
        // passengerDiscount: {id: '0', percentage: 0, name: "Без знижки"},
        // discountCardNumber: null
        passengerId: '',
        passengerType: undefined,
        name: undefined,
        lastName: undefined,
        phone: undefined,
        additionalPhone: undefined,
        dateOfBirth: undefined,
        email: undefined,
        passengerDiscount: undefined,
        discountCardNumber: undefined
      });
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    // editInputRefs.current[column.id]?.blur();
    setOpen(false);
    // In phone mode, don't exit edit mode here: MaskedPhoneInput's click-outside
    // handler both exits AND runs the save onBlur. Exiting on the autocomplete's
    // own blur (which fires on mousedown) would unmount the field before that
    // click-outside save runs, so the typed number wouldn't be persisted.
    if (!isPhoneMode) setEditingCell(null);
  };

  const handleEnterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      // editInputRefs.current[column.id]?.blur();
    }
  };

  // Reflect external value changes (e.g. react-phone-number-input reformatting
  // on a country switch) in both the displayed text and the option that backs
  // it (so MUI's reset-to-option-label doesn't blank the field).
  useEffect(() => {
    setValue(incomingValue);
    setOption(
      incomingValue
        ? ({ label: incomingValue } as PassengersSearchAutocompleteOption)
        : null
    );
  }, [incomingValue]);

  useEffect(() => {
    if (debouncedSearchTerm && debouncedSearchTerm.length > 2) {
      async function makeSearch() {
        await search({
          s: debouncedSearchTerm
        });
      }
      makeSearch();
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (data?.data && debouncedSearchTerm && debouncedSearchTerm.length > 2) {
      setOptions(data.data ?? []);
    } else {
      setOptions([]);
    }
  }, [data?.data, debouncedSearchTerm]);

  return (
    <SearchAutocomplete
      {...rest}
      label={'Пошук пасажира'}
      options={options}
      onChange={(newValue: PassengersSearchAutocompleteOption | null) => {
        if (typeof onChange === 'function') onChange(newValue);
        handleChange(newValue);
      }}
      disabled={disabled}
      inputValue={value}
      //@ts-ignore
      value={option}
      onInputChange={(_, newInputValue, reason) => {
        setValue(newInputValue);
        // Free typing (not MUI's programmatic reset): push the text into
        // react-phone-number-input so a manually typed number updates and saves
        // even when no passenger option is selected.
        if (isPhoneMode && reason === 'input') {
          reactPhoneOnChange({ target: { value: newInputValue } });
        }
      }}
      open={open}
      loading={isLoading || isFetching}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      noOptionsText={'Пасажирів не знайдено'}
      textFieldProps={{
        ...restTextFieldProps,
        inputRef: (inputRef: HTMLInputElement) => {
          // editInputRefs.current[column.id] = inputRef;
          assignInputRef(inputRef || null);
        },
        onClick: (e: MouseEvent<HTMLInputElement>) => {
          e.stopPropagation();
        },
        onKeyDown: handleEnterKeyDown,
        onBlur: handleBlur
      }}
    />
  );
};

// forwardRef drops the generic; re-apply it via a cast so call sites keep
// their TData inference.
export const PassengersSearchAutocomplete = forwardRef(
  PassengersSearchAutocompleteInner
) as <TData extends MRT_RowData>(
  props: PassengersSearchAutocompleteProps<TData> & {
    ref?: ForwardedRef<HTMLInputElement>;
  }
) => ReturnType<typeof PassengersSearchAutocompleteInner>;

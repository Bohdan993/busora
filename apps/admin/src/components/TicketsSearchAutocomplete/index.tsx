import {
  useState,
  useEffect,
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
import { useLazySearchTicketsQuery } from 'src/services/ticket';
import { type TicketOption } from 'src/types/tickets';

interface TicketsSearchAutocompleteOption extends TicketOption {}

interface TicketsSearchAutocompleteProps<TData extends MRT_RowData> {
  table: MRT_TableInstance<TData>;
  row: MRT_Row<TData>;
  passengerId: string;
  ticketsIds: string[];
  disabled?: boolean;
  textFieldProps?: any;
}

export const TicketsSearchAutocomplete = <TData extends MRT_RowData>({
  table,
  row,
  disabled,
  passengerId,
  ticketsIds,
  textFieldProps,
  ...rest
}: TicketsSearchAutocompleteProps<TData>) => {
  const [options, setOptions] = useState<
    TicketsSearchAutocompleteOption[] | []
  >([]);
  const [option, setOption] = useState<TicketsSearchAutocompleteOption | null>(
    null
  );
  const [value, setValue] = useState<string>('');
  const debouncedSearchTerm = useDebounce(value, 250);
  const [search, { data, error, isLoading, isFetching }] =
    useLazySearchTicketsQuery();

  const {
    refs: { editInputRefs },
    getState,
    setEditingCell
    // setEditingRow,
    // setCreatingRow
  } = table;
  const { editingRow, creatingRow } = getState();
  const { onChange, ...restTextFieldProps } = textFieldProps;

  const [open, setOpen] = useState(false);
  // const isCreating = creatingRow?.id === row.id;
  // const isEditing = editingRow?.id === row.id;

  const saveInputValueToRowCache = (
    newValue:
      | (Omit<TicketsSearchAutocompleteOption, 'label' | 'id'> & {
          ticketId: string;
        })
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

  const handleChange = (value: TicketsSearchAutocompleteOption | null) => {
    if (value !== null) {
      setOption(value);
      saveInputValueToRowCache({
        ticketId: value?.ticketId || '1',
        type: value?.type || '',
        dateOfCreature: value?.dateOfCreature || '',
        dateOfDeparture: value?.dateOfDeparture || '',
        dateOfReturn: value?.dateOfReturn || '',
        origin: value?.origin,
        destination: value?.destination,
        busFlightFrom: value?.busFlightFrom,
        busFlightTo: value?.busFlightTo || null,
        price: value?.price || 0,
        currency: value?.currency || '',
        status: value?.status || '',
        discount: value?.discount || 0
      });
    } else {
      saveInputValueToRowCache({
        ticketId: '',
        type: undefined,
        dateOfDeparture: undefined,
        dateOfReturn: undefined,
        origin: undefined,
        destination: undefined,
        busFlightFrom: undefined,
        busFlightTo: undefined,
        price: undefined,
        currency: undefined,
        status: undefined,
        discount: undefined
      });
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    // editInputRefs.current[column.id]?.blur();
    setOpen(false);
    setEditingCell(null);
  };

  const handleEnterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      // editInputRefs.current[column.id]?.blur();
    }
  };

  useEffect(() => {
    if (debouncedSearchTerm) {
      async function makeSearch() {
        await search({
          s: debouncedSearchTerm,
          // passengerId: passengerId,
          ticketsIds: ticketsIds
        });
      }
      makeSearch();
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (data?.data && debouncedSearchTerm) {
      setOptions(data.data ?? []);
    } else {
      setOptions([]);
    }
  }, [data?.data, debouncedSearchTerm]);

  return (
    <SearchAutocomplete
      {...rest}
      label={'Пошук квитка'}
      options={options}
      onChange={(newValue: TicketsSearchAutocompleteOption | null) => {
        if (typeof onChange === 'function') onChange(newValue);
        handleChange(newValue);
      }}
      disabled={disabled}
      inputValue={value}
      //@ts-ignore
      value={option}
      onInputChange={(_, newInputValue) => {
        setValue(newInputValue);
      }}
      open={open}
      loading={isLoading || isFetching}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      noOptionsText={'Квитків не знайдено'}
      textFieldProps={{
        ...restTextFieldProps,
        inputRef: (inputRef: HTMLInputElement) => {
          if (inputRef) {
            // editInputRefs.current[column.id] = inputRef;
          }
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

import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type FocusEvent,
  useEffect,
  useMemo
} from 'react';
import { SearchAutocomplete } from 'src/components/SearchAutocomplete';
import { useDebounce } from 'src/helpers/hooks';
import { useLazySearchBusFlightsQuery } from 'src/services/busFlight';
import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';
import { transformTicketBusFlightToString } from 'src/helpers';

interface EditBusFlightsSearchAutocompleteOption {
  label: string;
  name?: string;
  routeId?: string;
  dateOfDeparture?: string;
  // Persisted/GET identifier read by the backend (busFlightTo?.id). Mirrors
  // `busFlightId` from the search option.
  id?: string;
  readonly busFlightId?: string;
}

interface EditBusFlightsSearchAutocompleteProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
  defaultValue: EditBusFlightsSearchAutocompleteOption | null;
  disabled?: boolean;
  textFieldProps?: any;
  // Dates (DD-MM-YYYY) to preload flights for — the dropdown shows the union
  // of flights for all of them (e.g. the chosen departure date + the date of
  // the currently-selected flight).
  selectedDates?: string[];
}

const dedupeByFlightId = (
  list: EditBusFlightsSearchAutocompleteOption[]
): EditBusFlightsSearchAutocompleteOption[] => {
  const seen = new Set<string>();
  return list.filter((o) => {
    const key = String(o.busFlightId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const EditBusFlightsSearchAutocomplete = <TData extends MRT_RowData>({
  cell,
  table,
  defaultValue,
  disabled,
  textFieldProps,
  selectedDates,
  ...rest
}: EditBusFlightsSearchAutocompleteProps<TData>) => {
  // Guard: this can be rendered without a table instance (e.g. the create
  // dialog's internalEditComponents); bail instead of crashing on destructure.
  if (!table) return null;
  const { column, row } = cell;
  const [option, setOption] =
    useState<EditBusFlightsSearchAutocompleteOption | null>(
      defaultValue || null
    );
  const [value, setValue] = useState<string>(
    () => transformTicketBusFlightToString(row._valuesCache, column.id) || ''
  );
  const debouncedSearchTerm = useDebounce(value, 250);
  const [search] = useLazySearchBusFlightsQuery();
  // Flights preloaded for the relevant date(s), and flights from the typed
  // search — shown merged so both the departure date and the current flight's
  // date are available without typing.
  const [dateOptions, setDateOptions] = useState<
    EditBusFlightsSearchAutocompleteOption[]
  >([]);
  const [typedOptions, setTypedOptions] = useState<
    EditBusFlightsSearchAutocompleteOption[]
  >([]);
  const [loading, setLoading] = useState(false);
  const {
    refs: { editInputRefs },
    getState,
    setEditingCell,
    setEditingRow,
    setCreatingRow
  } = table;

  const { editingRow, creatingRow } = getState();
  const { onChange, ...restTextFieldProps } = textFieldProps;

  const [open, setOpen] = useState(false);
  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;

  // Route-aware search params. The backend filters flights to those whose route
  // connects the ticket's origin→destination pair. `direction` is fixed per
  // column: the return-leg column (busFlightTo) searches backwards, every other
  // (busFlightFrom) forwards. origin/destination ids come from the row's
  // selected cities (live edit cache first, loaded row as fallback). When a city
  // isn't picked yet the ids are omitted and the backend falls back to date-only.
  const cityId = (field: string) => {
    const city =
      (row?._valuesCache as any)?.[field] ?? (row?.original as any)?.[field];
    const id = city?.id;
    return id === undefined || id === null || id === '' ? undefined : id;
  };
  const originId = cityId('origin');
  const destinationId = cityId('destination');
  const direction: 'forwards' | 'backwards' =
    column.id === 'busFlightTo' ? 'backwards' : 'forwards';

  const saveInputValueToRowCache = (
    newValue:
      | Omit<EditBusFlightsSearchAutocompleteOption, 'label'>
      | ''
      | undefined
  ) => {
    //@ts-ignore
    row._valuesCache[column.id] = newValue;
    if (isCreating) {
      setCreatingRow(row);
    } else if (isEditing) {
      setEditingRow(row);
    }
  };

  const handleChange = (
    value: EditBusFlightsSearchAutocompleteOption | null
  ) => {
    if (value !== null) {
      setOption(value);
      saveInputValueToRowCache({
        // The backend (and the GET response) identifies a flight by `id`,
        // while the search option carries it as `busFlightId`. Store both so
        // the PUT body's busFlight object has `id` (backend reads
        // busFlightTo?.id) — otherwise the selection isn't persisted and the
        // field comes back empty/invalid after the refetch.
        id: value?.busFlightId || '1',
        busFlightId: value?.busFlightId || '1',
        name: value?.name || '',
        dateOfDeparture: value?.dateOfDeparture || '',
        routeId: value?.routeId || ''
      });
    } else {
      saveInputValueToRowCache('');
    }
    setEditingCell(null);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    editInputRefs.current[column.id]?.blur();
    setOpen(false);
    setEditingCell(null);
  };

  const handleEnterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      editInputRefs.current[column.id]?.blur();
      setEditingCell(null);
    }
  };

  const datesKey = (selectedDates ?? []).filter(Boolean).join('|');

  // Preload the union of flights for every relevant date.
  useEffect(() => {
    let cancelled = false;
    const dates = Array.from(new Set((selectedDates ?? []).filter(Boolean)));
    if (!dates.length) {
      setDateOptions([]);
      return;
    }
    setLoading(true);
    Promise.all(
      dates.map((d) =>
        search({ s: d, originId, destinationId, direction })
          .unwrap()
          .then((res) => res?.data ?? [])
          .catch(() => [])
      )
    )
      .then((lists) => {
        if (!cancelled) setDateOptions(dedupeByFlightId(lists.flat()));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datesKey, originId, destinationId, direction]);

  // Typed search.
  useEffect(() => {
    let cancelled = false;
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 10) {
      setLoading(true);
      search({ s: debouncedSearchTerm, originId, destinationId, direction })
        .unwrap()
        .then((res) => {
          if (!cancelled) setTypedOptions(res?.data ?? []);
        })
        .catch(() => {
          if (!cancelled) setTypedOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm, originId, destinationId, direction]);

  const options = useMemo(
    () => dedupeByFlightId([...dateOptions, ...typedOptions]),
    [dateOptions, typedOptions]
  );

  return (
    <SearchAutocomplete
      {...rest}
      label={column.columnDef.header}
      options={options}
      onChange={(newValue: EditBusFlightsSearchAutocompleteOption | null) => {
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
      loading={loading}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      noOptionsText={'Рейсів не знайдено'}
      textFieldProps={{
        ...restTextFieldProps,
        inputRef: (inputRef: HTMLInputElement) => {
          if (inputRef) {
            editInputRefs.current[column.id] = inputRef;
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

import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type FocusEvent
} from 'react';
import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';
import { CustomSelect } from '../CustomSelect';
import { type TicketCity } from 'src/types/tickets';

interface EditCustomSelectOption {
  label: string;
  groupBy: string;
  countryId: string;
  id?: string;
}

interface EditCustomSelectProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
  defaultValue: EditCustomSelectOption | null;
  data: EditCustomSelectOption[];
  disabled?: boolean;
  textFieldProps?: any;
}

export const EditCustomSelect = <TData extends MRT_RowData>({
  cell,
  table,
  defaultValue,
  data,
  disabled,
  textFieldProps,
  ...rest
}: EditCustomSelectProps<TData>) => {
  const { column, row } = cell;
  const {
    refs: { editInputRefs },
    getState,
    setEditingCell,
    setEditingRow,
    setCreatingRow
  } = table;
  const { editingRow, creatingRow } = getState();
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<EditCustomSelectOption | null>(
    defaultValue || null
  );
  const [value, setValue] = useState(() => cell.getValue<TicketCity>().name);

  // const [inputValue, setInputValue] = useState(defaultValue?.label || '');
  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;
  const { onChange, ...restTextFieldProps } = textFieldProps;

  const saveInputValueToRowCache = (newValue: TicketCity | undefined) => {
    //@ts-ignore
    row._valuesCache[column.id] = newValue;
    if (isCreating) {
      setCreatingRow(row);
    } else if (isEditing) {
      setEditingRow(row);
    }
  };

  const handleChange = (value: EditCustomSelectOption | null) => {
    if (value !== null) {
      setOption(value);
      saveInputValueToRowCache({
        id: value?.id || '1',
        name: value?.label || '',
        countryId: value?.countryId || ''
      });
    } else {
      saveInputValueToRowCache({
        id: '',
        name: '',
        countryId: ''
      });
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

  return (
    <CustomSelect
      {...rest}
      disabled={disabled}
      label={column.columnDef.header}
      options={data}
      onChange={(newValue: EditCustomSelectOption | null) => {
        if (typeof onChange === 'function') onChange(newValue);
        handleChange(newValue);
      }}
      inputValue={value ?? ''}
      //@ts-ignore
      value={option ?? ''}
      onInputChange={(_, newInputValue) => {
        setValue(newInputValue);
      }}
      noOptionsText={'Місто не знайдено'}
      open={open}
      onOpen={() => {
        setOpen(true);
      }}
      onClose={() => {
        setOpen(false);
      }}
      groupBy={(option) => option.groupBy}
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

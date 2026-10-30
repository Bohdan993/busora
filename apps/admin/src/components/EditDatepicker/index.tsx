import { useState, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';
import dayjs, { type Dayjs } from 'dayjs';
import { Box } from '@mui/material';
import { useHandleClickOutside } from 'src/helpers/hooks';

interface EditDatepickerProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
  disabled: boolean;
  textFieldProps?: any;
  // Forwarded to the underlying DatePicker (via ...rest) to restrict selectable days.
  shouldDisableDate?: (day: Dayjs) => boolean;
}

export const EditDatepicker = <TData extends MRT_RowData>({
  cell,
  table,
  disabled = false,
  textFieldProps,
  ...rest
}: EditDatepickerProps<TData>) => {
  const { column, row } = cell;
  const {
    refs: { actionCellRef, editInputRefs },
    getState,
    setEditingCell,
    setEditingRow,
    setCreatingRow
  } = table;
  const { onChange, ...restTextFieldProps } = textFieldProps;
  const { editingRow, creatingRow, actionCell } = getState();

  const [value, setValue] = useState(() => cell.getValue<Dayjs>());
  const [isOpen, setIsOpen] = useState(false);
  const boxRef = useRef(null);

  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;

  const saveInputValueToRowCache = (newValue: Dayjs) => {
    //@ts-ignore
    row._valuesCache[column.id] = newValue;
    if (isCreating) {
      setCreatingRow(row);
    } else if (isEditing) {
      setEditingRow(row);
    }
  };

  const handleChange = (value: Dayjs) => {
    if (typeof onChange === 'function')
      onChange(value ? dayjs(value).format('YYYY-MM-DD') : '');
    setValue(value);
    saveInputValueToRowCache(value);
    setEditingCell(null);
  };

  const handleEnterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    textFieldProps.onKeyDown?.(event);
    if (event.key === 'Enter' && !event.shiftKey) {
      editInputRefs.current[column.id]?.blur();
      setEditingCell(null);
    }
  };

  const handleClickOutside = () => {
    if (isOpen) return;
    setEditingCell(null);
  };

  useHandleClickOutside(
    boxRef,
    handleClickOutside,
    isCreating || textFieldProps?.disabled || false
  );

  return (
    <Box ref={boxRef} sx={{ width: '100%' }}>
      <DatePicker
        {...rest}
        sx={{ width: '100%' }}
        label={column.columnDef.header}
        //@ts-ignore
        value={dayjs(value).isValid() ? dayjs(value) : null}
        format={'DD-MM-YYYY'}
        disabled={disabled}
        //@ts-ignore
        onChange={(value: Dayjs) => {
          handleChange(value);
        }}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        slotProps={{
          textField: {
            ...restTextFieldProps,
            inputRef: (inputRef: HTMLInputElement) => {
              if (inputRef) {
                editInputRefs.current[column.id] = inputRef;
              }
            },
            onClick: (e: MouseEvent<HTMLInputElement>) => {
              e.stopPropagation();
            },
            onKeyDown: handleEnterKeyDown
            // onBlur: () => setEditingCell(null)
          }
        }}
      />
    </Box>
  );
};

import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  useState,
  useCallback
} from 'react';
//   import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
//   import { type TextFieldProps } from '@mui/material/TextField';
import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';
import { debounce } from 'src/helpers';
//   import { getValueAndLabel, parseFromValuesOrFunc } from '../../utils/utils';

export interface EditTextFieldDebouncedProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
  enabled?: () => boolean;
  textFieldProps?: any;
  debounceMs: number;
}

export const EditTextFieldDebounced = <TData extends MRT_RowData>({
  cell,
  table,
  enabled,
  debounceMs,
  textFieldProps,
  ...rest
}: EditTextFieldDebouncedProps<TData>) => {
  const {
    getState,
    options: { createDisplayMode, editDisplayMode, muiEditTextFieldProps },
    refs: { editInputRefs },
    setCreatingRow,
    setEditingCell,
    setEditingRow
  } = table;
  const { column, row } = cell;
  const { columnDef } = column;
  const { creatingRow, editingRow } = getState();
  // const { editSelectOptions, editVariant } = columnDef;

  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;

  const [value, setValue] = useState(() => cell.getValue<string>());
  const debouncedChangeHandler = useCallback(
    debounce(textFieldProps.onChange, debounceMs),
    []
  );

  // const textFieldProps: TextFieldProps = {
  //   ...parseFromValuesOrFunc(muiEditTextFieldProps, {
  //     cell,
  //     column,
  //     row,
  //     table,
  //   }),
  //   ...parseFromValuesOrFunc(columnDef.muiEditTextFieldProps, {
  //     cell,
  //     column,
  //     row,
  //     table,
  //   }),
  //   ...rest,
  // };

  // const selectOptions = parseFromValuesOrFunc(editSelectOptions, {
  //   cell,
  //   column,
  //   row,
  //   table,
  // });

  // const isSelectEdit = editVariant === 'select' || textFieldProps?.select;

  const saveInputValueToRowCache = (newValue: string) => {
    //@ts-ignore
    row._valuesCache[column.id] = newValue;
    if (isCreating) {
      setCreatingRow(row);
    } else if (isEditing) {
      setEditingRow(row);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    //   textFieldProps.onChange?.(event);
    debouncedChangeHandler(event);
    setValue(event.target.value);
    saveInputValueToRowCache(event.target.value);
    //   if (isSelectEdit) {
    //     saveInputValueToRowCache(event.target.value);
    //   }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    textFieldProps.onBlur?.(event);
    setEditingCell(null);
  };

  const handleEnterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    textFieldProps.onKeyDown?.(event);
    if (event.key === 'Enter' && !event.shiftKey) {
      editInputRefs.current[column.id]?.blur();
    }
  };

  return (
    <TextField
      disabled={enabled ? !enabled() : false}
      fullWidth
      inputRef={(inputRef) => {
        if (inputRef) {
          editInputRefs.current[column.id] = inputRef;
          if (textFieldProps.inputRef) {
            textFieldProps.inputRef = inputRef;
          }
        }
      }}
      label={
        ['custom', 'modal'].includes(
          (isCreating ? createDisplayMode : editDisplayMode) as string
        )
          ? columnDef.header
          : undefined
      }
      margin="none"
      name={column.id}
      placeholder={
        !['custom', 'modal'].includes(
          (isCreating ? createDisplayMode : editDisplayMode) as string
        )
          ? columnDef.header
          : undefined
      }
      size="small"
      value={value ?? ''}
      variant="standard"
      {...rest}
      {...textFieldProps}
      InputProps={{
        ...(textFieldProps.variant !== 'outlined'
          ? { disableUnderline: editDisplayMode === 'table' }
          : {}),
        ...textFieldProps.InputProps,
        sx: (theme) => ({
          mb: 0
        })
      }}
      inputProps={{
        autoComplete: 'off', //disable autocomplete and autofill
        ...textFieldProps.inputProps
      }}
      onBlur={handleBlur}
      onChange={handleChange}
      onClick={(e) => {
        e.stopPropagation();
        textFieldProps?.onClick?.(e);
      }}
      onKeyDown={handleEnterKeyDown}
    ></TextField>
  );
};

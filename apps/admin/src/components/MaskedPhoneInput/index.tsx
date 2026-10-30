import {
  type KeyboardEvent,
  type MouseEvent,
  useState,
  useRef,
  forwardRef
} from 'react';
//   import MenuItem from '@mui/material/MenuItem';
//   import { type TextFieldProps } from '@mui/material/TextField';
import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';
// import InputMask from 'react-input-mask';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Box, TextField } from '@mui/material';
import { useHandleClickOutside } from 'src/helpers/hooks';
import { PassengersSearchAutocomplete } from '../PassengersSearchAutocomplete';

// A plain phone <input> for react-phone-number-input: just the country-code
// select + a text field, no passenger search. The library passes
// value/onChange(event)/ref here; its internal props (country, metadata,
// international, …) must be stripped so they don't leak onto the DOM input.
const PhoneNumberTextField = forwardRef<HTMLInputElement, any>((props, ref) => {
  const {
    value,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    onClick,
    label,
    placeholder,
    disabled,
    name,
    required,
    error,
    helperText,
    className
  } = props;
  return (
    <TextField
      inputRef={ref}
      type="tel"
      className={className}
      value={value ?? ''}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onClick={onClick}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      name={name}
      required={required}
      error={error}
      helperText={helperText}
      variant="standard"
      size="medium"
      fullWidth
      inputProps={{ autoComplete: 'off' }}
    />
  );
});

export interface MaskedPhoneInputProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
  enabled?: () => boolean;
  // When false, render a plain phone input (country select + text field) instead
  // of the passenger-search autocomplete. Defaults to true.
  enableSearch?: boolean;
  textFieldProps?: any;
}

export const MaskedPhoneInput = <TData extends MRT_RowData>({
  cell,
  table,
  enabled,
  enableSearch = true,
  textFieldProps,
  ...rest
}: MaskedPhoneInputProps<TData>) => {
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
  const { creatingRow, editingRow, editingCell } = getState();
  // const { editSelectOptions, editVariant } = columnDef;

  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;

  const [value, setValue] = useState(() =>
    cell.getValue<string>() !== '-' ? cell.getValue<string>() : ''
  );
  const boxRef = useRef(null);

  const { onChange, onBlur, ...restTextFieldProps } = textFieldProps;

  const saveInputValueToRowCache = (newValue: string) => {
    //@ts-ignore
    row._valuesCache[column.id] = newValue;
    if (isCreating) {
      setCreatingRow(row);
    } else if (isEditing) {
      setEditingRow(row);
    }
  };

  const handleChange = (newValue: string) => {
    let next = newValue;
    // react-phone-number-input discards the national number when switching to a
    // country whose calling code differs (it returns just the new calling code,
    // e.g. "+380"/"+49"). Detect that — calling-code-only AND the calling code
    // changed vs the previous value — and re-attach the previous national digits
    // so toggling the country doesn't wipe an existing number. A user deleting
    // all digits also reaches calling-code-only, but with the SAME calling code,
    // so that still clears correctly.
    if (/^\+(380|49)$/.test(newValue || '')) {
      const prevCallingCode = (value || '').match(/^\+(380|49)/)?.[0];
      if (prevCallingCode && prevCallingCode !== newValue) {
        const prevNational = (value || '').replace(/^\+(380|49)/, '');
        if (prevNational) next = newValue + prevNational;
      }
    }
    // Selecting a country on an empty field emits just the calling code with no
    // national number. Treat that as empty so it doesn't persist or trip
    // phone-format validation when nothing was typed.
    const normalized = !next || /^\+(380|49)$/.test(next) ? '' : next;
    if (onChange) onChange(normalized);
    setValue(normalized);
    saveInputValueToRowCache(normalized);
  };

  const handleEnterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    textFieldProps.onKeyDown?.(event);
    if (event.key === 'Enter' && !event.shiftKey) {
      editInputRefs.current[column.id]?.blur();
      setEditingCell(null);
    }
  };

  const handleBlur = (value: string) => {
    if (!isCreating) return;
    if (onBlur) onBlur(value);
    setEditingCell(null);
  };

  const handleClickOutside = () => {
    if (onBlur) onBlur(value);
    setEditingCell(null);
  };

  useHandleClickOutside(
    boxRef,
    handleClickOutside,
    isCreating || textFieldProps?.disabled || false,
    // The passenger-search dropdown is portalled outside boxRef; clicking an
    // option must not count as an outside click (it would save+exit before the
    // selection applies).
    '.MuiAutocomplete-popper'
  );

  return (
    <Box ref={boxRef} sx={{ width: '100%' }}>
      <PhoneInput
        onChange={handleChange}
        value={value ?? ''}
        autoFocus={!isCreating}
        international
        countryCallingCodeEditable={false}
        defaultCountry={value && value?.startsWith('+49') ? 'DE' : 'UA'}
        smartCaret={false}
        limitMaxLength={true}
        countries={['UA', 'DE']}
        // inputComponent={TextField}
        inputComponent={
          enableSearch ? PassengersSearchAutocomplete : PhoneNumberTextField
        }
        {...{
          ...restTextFieldProps,
          onBlur: () => handleBlur(value ?? ''),
          onKeyDown: handleEnterKeyDown,
          onClick: (e: MouseEvent<HTMLInputElement>) => {
            e.stopPropagation();
            textFieldProps?.onClick?.(e);
          },
          inputRef: (inputRef: any) => {
            if (inputRef) {
              editInputRefs.current[column.id] = inputRef;
              if (textFieldProps?.inputRef) {
                textFieldProps.inputRef = inputRef;
              }
            }
          },
          label: ['custom', 'modal'].includes(
            (isCreating ? createDisplayMode : editDisplayMode) as string
          )
            ? columnDef.header
            : undefined,
          size: 'medium',
          name: column.id,
          placeholder: columnDef.header,
          variant: 'standard',
          inputProps: {
            autoComplete: 'off'
          }
        }}
      />
    </Box>
  );
};

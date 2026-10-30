import { FC, forwardRef } from 'react';
import { TextField, Autocomplete } from '@mui/material';
import { styled, lighten, darken } from '@mui/system';
import { type TextFieldProps } from '@mui/material/TextField';

const GroupHeader = styled('div')(({ theme }) => ({
  position: 'sticky',
  top: '-8px',
  padding: '4px 10px',
  color: theme.palette.primary.main,
  backgroundColor:
    theme.palette.mode === 'light'
      ? lighten(theme.palette.primary.light, 0.85)
      : darken(theme.palette.primary.main, 0.8)
}));

const GroupItems = styled('ul')({
  padding: 0
});

interface AutocompleteOption {
  label: string;
  groupBy: string;
  countryId: string;
  id?: string;
}

interface CustomSelectProps {
  options: AutocompleteOption[];
  groupBy?: (option: AutocompleteOption) => string;
  disabled?: boolean;
  label: string;
  onChange: (newValue: AutocompleteOption | null) => void;
  // defaultValue?: AutocompleteOption
  inputValue: string;
  onInputChange: (_: any, newInputValue: string) => void;
  textFieldProps?: TextFieldProps;
}

export const CustomSelect: FC<CustomSelectProps> = forwardRef(
  (
    {
      options,
      groupBy,
      onChange,
      label,
      children,
      disabled,
      inputValue,
      onInputChange,
      textFieldProps,
      ...props
    },
    ref
  ) => {
    //  const {
    //     inputRef = (ref: HTMLDivElement | null) => {},
    //     error,
    //     helperText,
    //     required,
    //     ...restTextFieldProps
    // } = textFieldProps || {};

    return (
      <Autocomplete
        {...props}
        disabled={disabled}
        ref={ref}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          minWidth: 0,
          padding: 0,
          border: 0,
          verticalAlign: 'top',
          width: '100%'
        }}
        id="grouped-autocomplete"
        options={options}
        getOptionLabel={(option) => {
          return typeof option === 'string' ? option : option?.label || '';
        }}
        isOptionEqualToValue={(option, value) => {
          return Number(option.id) === Number(value.id);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            {...(textFieldProps || {})}
            // inputRef={inputRef}
            // error={error}
            // helperText={helperText}
            // required={required}
            label={label}
            fullWidth
            inputProps={{
              ...params.inputProps,
              // ...(restTextFieldProps || {}),
              autoComplete: 'off' // disable autocomplete and autofill
            }}
          />
        )}
        renderGroup={(params) => (
          <li key={params.key}>
            <GroupHeader>{params.group}</GroupHeader>
            <GroupItems>{params.children}</GroupItems>
          </li>
        )}
        inputValue={inputValue}
        onInputChange={onInputChange}
        value={(props as any).value}
        onChange={(_, newValue) => {
          onChange(newValue);
        }}
        {...(groupBy ? { groupBy } : {})}
      />
    );
  }
);

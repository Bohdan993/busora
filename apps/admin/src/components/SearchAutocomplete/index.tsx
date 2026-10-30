import { FC, forwardRef, Fragment } from 'react';
import { TextField, Autocomplete, CircularProgress } from '@mui/material';

import { type BusFlightOption } from 'src/types/busFlights';
import { type PassengerOption } from 'src/types/passengers';
import { type TicketOption } from 'src/types/tickets';

interface OptionsIds {
  readonly busFlightId?: string;
  readonly passengerId?: string;
  readonly ticketId?: string;
}

interface AutocompleteOption
  extends Omit<BusFlightOption, 'busFlightId'>,
    Omit<PassengerOption, 'passengerId'>,
    Omit<TicketOption, 'ticketId'>,
    OptionsIds {}

interface SearchAutocompleteProps {
  options: AutocompleteOption[];
  label: string;
  loading: boolean;
  onChange: (newValue: AutocompleteOption | null) => void;
  inputValue: string;
  onInputChange: (_: any, newInputValue: string, reason?: string) => void;
  disabled?: boolean;
  textFieldProps?: any;
}

export const SearchAutocomplete: FC<SearchAutocompleteProps> = forwardRef(
  (
    {
      children,
      options,
      loading,
      label,
      inputValue,
      disabled,
      textFieldProps,
      onChange,
      onInputChange,
      ...props
    },
    ref
  ) => {
    const { inputRef, error, helperText, required, ...restTextFieldProps } =
      textFieldProps;
    return (
      <Autocomplete
        {...props}
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
        id="search-autocomplete"
        disabled={disabled}
        options={options}
        loading={loading}
        getOptionLabel={(option) => {
          return typeof option === 'string' ? option : option?.label || '';
        }}
        isOptionEqualToValue={(option, value) => {
          return Number(option.id) === Number(value.id);
        }}
        filterOptions={(x) => x}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            label={label}
            error={error}
            required={required}
            helperText={helperText}
            fullWidth
            inputProps={{
              ...params.inputProps,
              ...(restTextFieldProps || {}),
              autoComplete: 'off' // disable autocomplete and autofill
            }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <Fragment>
                  {loading ? (
                    <CircularProgress color="inherit" size={20} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </Fragment>
              )
            }}
          />
        )}
        inputValue={inputValue}
        onInputChange={onInputChange}
        value={(props as any).value}
        onChange={(event: any, newValue: AutocompleteOption | null) => {
          onChange(newValue);
        }}
      />
    );
  }
);

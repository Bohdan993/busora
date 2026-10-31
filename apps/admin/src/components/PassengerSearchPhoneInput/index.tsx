import { useEffect, useRef, useState } from 'react';
import { Box, MenuItem, TextField } from '@mui/material';

import { SearchAutocomplete } from 'src/components/SearchAutocomplete';
import { useDebounce } from 'src/helpers/hooks';
import { useLazySearchPassengersQuery } from 'src/services/passenger';
import { type PassengerOption } from 'src/types/passengers';
import { PHONE_COUNTRIES, type CallingCode } from 'src/helpers/phone';

// Only UA / CZ are supported. The calling code lives in a separate select so it
// can never be typed over or backspaced, and the national part is digits-only.
type Calling = CallingCode;

// Split a stored E.164 value into { calling, national digits }. Defaults to UA.
const splitPhone = (value: string): { calling: Calling; national: string } => {
  const v = value || '';
  const country = PHONE_COUNTRIES.find((c) => v.startsWith(c.calling));
  if (country) {
    return {
      calling: country.calling,
      national: v.slice(country.calling.length)
    };
  }
  return {
    calling: PHONE_COUNTRIES[0].calling,
    national: v.replace(/\D/g, '')
  };
};

export interface PassengerSearchPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectPassenger?: (passenger: PassengerOption) => void;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  label?: string;
  // When false, render a plain digits-only field (no passenger search) — e.g. the
  // additional-phone field.
  enableSearch?: boolean;
  disabled?: boolean;
  // For MRT inline cell editing: called to leave edit mode on outside-click /
  // passenger select. Omit in the create modal (fields stay mounted there).
  onClose?: () => void;
}

// A phone field with a country-code select + a digits-only national input. With
// `enableSearch` (default) the national part doubles as a passenger search and
// selecting a result autofills the row. It keeps its value internally and only
// calls `onChange` on blur / selection, so typing doesn't re-render the parent
// form on every keystroke.
export const PassengerSearchPhoneInput = ({
  value,
  onChange,
  onSelectPassenger,
  error,
  helperText,
  required,
  label = 'Телефон',
  enableSearch = true,
  disabled = false,
  onClose
}: PassengerSearchPhoneInputProps) => {
  const initial = splitPhone(value ?? '');
  const [calling, setCalling] = useState<Calling>(initial.calling);
  const [national, setNational] = useState<string>(initial.national);
  const [options, setOptions] = useState<PassengerOption[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // The last value we pushed to / received from the parent — lets us resync on
  // external changes (prefill, reset) without clobbering local typing.
  const committedRef = useRef<string>(value ?? '');

  const debounced = useDebounce(national, 250);
  const [search, { data, isLoading, isFetching }] =
    useLazySearchPassengersQuery();

  const fullPhone = (c: Calling, n: string) => (n ? `${c}${n}` : '');

  const commit = (c: Calling, n: string) => {
    const next = fullPhone(c, n);
    if (next !== committedRef.current) {
      committedRef.current = next;
      onChange(next);
    }
  };

  // Inline cell editing only: leave edit mode when the user presses outside the
  // field. Uses mousedown (not click) so the press is evaluated while the
  // country menu / search dropdown are still mounted — a click handler can fire
  // after the menu closes and its detached target then reads as "outside". The
  // field itself and any MUI overlay (menu/popover/modal/autocomplete) are
  // ignored so interacting with them doesn't exit.
  useEffect(() => {
    if (!onClose || disabled) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (boxRef.current?.contains(t)) return;
      if (
        t.closest?.(
          '.MuiPopover-root, .MuiMenu-root, .MuiModal-root, .MuiAutocomplete-popper'
        )
      )
        return;
      // Commit the in-progress value BEFORE leaving edit mode — onClose unmounts
      // the field, which would otherwise preempt the input's blur-commit and the
      // typed number would be lost.
      commit(calling, national);
      onClose();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
    // calling/national in deps so the handler always commits the latest value.
  }, [onClose, disabled, calling, national]);

  // Resync when the parent value changes from the outside (e.g. a found-passenger
  // prefill or a form reset), not from our own commit.
  useEffect(() => {
    if ((value ?? '') !== committedRef.current) {
      const s = splitPhone(value ?? '');
      setCalling(s.calling);
      setNational(s.national);
      committedRef.current = value ?? '';
    }
  }, [value]);

  useEffect(() => {
    if (enableSearch && debounced && debounced.length > 2) {
      search({ s: `${calling}${debounced}` });
    }
  }, [debounced, calling, enableSearch]);

  useEffect(() => {
    setOptions(
      enableSearch && debounced && debounced.length > 2 ? data?.data ?? [] : []
    );
  }, [data?.data, debounced, enableSearch]);

  return (
    <Box
      ref={boxRef}
      sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, width: '100%' }}
    >
      <TextField
        select
        variant="standard"
        disabled={disabled}
        value={calling}
        onChange={(e) => {
          const c = e.target.value as Calling;
          setCalling(c);
          commit(c, national);
        }}
        sx={{ width: 110, flexShrink: 0 }}
      >
        {PHONE_COUNTRIES.map((c) => (
          <MenuItem key={c.code} value={c.calling}>
            {c.flag} {c.calling}
          </MenuItem>
        ))}
      </TextField>

      {enableSearch ? (
        <SearchAutocomplete
          label={label}
          options={options}
          disabled={disabled}
          //@ts-ignore - synthetic option keeps the typed digits displayed
          value={national ? { label: national } : null}
          inputValue={national}
          loading={isLoading || isFetching}
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          noOptionsText={'Пасажирів не знайдено'}
          onInputChange={(_, newInputValue, reason) => {
            // Clear button: drop the national part, keep the country code.
            if (reason === 'clear') {
              setNational('');
              commit(calling, '');
              return;
            }
            // Digits only — letters / spaces / symbols are rejected.
            const digits = newInputValue.replace(/\D/g, '');
            setNational(digits);
          }}
          onChange={(val: PassengerOption | null) => {
            if (!val) return;
            const s = splitPhone(val.phone || '');
            const nextCalling = val.phone ? s.calling : calling;
            setCalling(nextCalling);
            setNational(s.national);
            commit(nextCalling, s.national);
            onSelectPassenger?.(val);
            // Selecting a passenger completes the edit (inline cell mode).
            onClose?.();
          }}
          textFieldProps={{
            required,
            error,
            helperText,
            type: 'tel',
            inputMode: 'numeric',
            onBlur: () => {
              setOpen(false);
              commit(calling, national);
            }
          }}
        />
      ) : (
        <TextField
          label={label}
          variant="standard"
          fullWidth
          disabled={disabled}
          required={required}
          error={error}
          helperText={helperText}
          value={national}
          type="tel"
          inputProps={{ inputMode: 'numeric' }}
          onChange={(e) => setNational(e.target.value.replace(/\D/g, ''))}
          onBlur={() => commit(calling, national)}
        />
      )}
    </Box>
  );
};

export default PassengerSearchPhoneInput;

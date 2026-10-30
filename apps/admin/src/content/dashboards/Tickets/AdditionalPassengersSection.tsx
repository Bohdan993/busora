import { type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

import { type Discount } from 'src/types/discounts';
import {
  type PassengerDiscount,
  type PassengerOption
} from 'src/types/passengers';
import { PassengerSearchPhoneInput } from 'src/components/PassengerSearchPhoneInput';
import {
  validateRequired,
  validateEmail,
  validatePhone
} from 'src/helpers/validators';

const REQUIRED_MSG = "Поле обов'язкове";

// A passenger added to a brand-new ticket beyond the main one captured by the
// create row. Adult passengers carry the full field set; children only need
// name / lastName / dateOfBirth / discount (mirrors the passengers[] vs
// children[] split the POST /tickets body expects).
export interface AdditionalPassenger {
  key: string;
  passengerType: 'adult' | 'child';
  name: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD ('' when unset)
  phone: string;
  additionalPhone: string;
  email: string;
  passengerDiscount: PassengerDiscount | null;
  discountCardNumber: string;
  // The backend derives each passenger's price from these, so they're collected
  // per passenger (same "at least one" rule as the main create row).
  paymentOnBus: string;
  paymentAtOffice: string;
  // Stored per PassengerTicket on the backend (status / currency are ticket-level
  // and stay on the main form).
  agent: { id: string; name: string } | null;
  passengerConfirmation: { id: string; name?: string | null } | null;
  busSeat: string;
  note: string;
}

export interface AgentLikeOption {
  id: string;
  value: string;
  label: string;
}

export interface ConfirmationOption {
  id: string;
  value: string;
}

export type AdditionalPassengerErrors = Record<
  string,
  Record<string, string | undefined>
>;

// Stable, render-safe keys for the block list (Math.random / Date.now are
// avoided so the value is deterministic across re-renders within a session).
let uid = 0;
const nextKey = () => `extra-${++uid}`;

export const makeEmptyAdditionalPassenger = (): AdditionalPassenger => ({
  key: nextKey(),
  passengerType: 'adult',
  name: '',
  lastName: '',
  dateOfBirth: '',
  phone: '',
  additionalPhone: '',
  email: '',
  passengerDiscount: null,
  discountCardNumber: '',
  paymentOnBus: '',
  paymentAtOffice: '',
  agent: null,
  passengerConfirmation: null,
  busSeat: '',
  note: ''
});

// Per-passenger validation, mirroring validatePassengerInTicket: name/lastName/
// dateOfBirth always required; adults also need a valid phone + email; the
// discount-card number is required only for a loyalty-card discount.
export const validateAdditionalPassenger = (
  p: AdditionalPassenger,
  discountCardIds: string[]
): Record<string, string | undefined> => {
  const errors: Record<string, string | undefined> = {};

  if (!validateRequired(p.name)) errors.name = REQUIRED_MSG;
  if (!validateRequired(p.lastName)) errors.lastName = REQUIRED_MSG;
  if (!validateRequired(p.dateOfBirth) || !dayjs(p.dateOfBirth).isValid())
    errors.dateOfBirth = REQUIRED_MSG;

  if (p.passengerType === 'adult') {
    if (!validateRequired(p.phone)) errors.phone = REQUIRED_MSG;
    else if (!validatePhone(p.phone))
      errors.phone = 'Введіть коректний номер телефону';

    if (p.additionalPhone && !validatePhone(p.additionalPhone))
      errors.additionalPhone = 'Введіть коректний номер телефону';

    // Email is optional (backend allows null) — only validate the format.
    if (p.email && !validateEmail(p.email))
      errors.email = 'Введіть коректну Email адресу';
  }

  if (
    discountCardIds.includes(String(p.passengerDiscount?.id)) &&
    !validateRequired(p.discountCardNumber)
  )
    errors.discountCardNumber = REQUIRED_MSG;

  // Payment: each is required only when the other is empty (mirrors the main
  // create row / table rule) so every passenger has a price basis.
  const paidOnBus = Number(p.paymentOnBus) > 0;
  const paidAtOffice = Number(p.paymentAtOffice) > 0;
  if (!paidOnBus && !paidAtOffice) {
    errors.paymentOnBus = REQUIRED_MSG;
    errors.paymentAtOffice = REQUIRED_MSG;
  }

  return errors;
};

interface AdditionalPassengersSectionProps {
  passengers: AdditionalPassenger[];
  setPassengers: Dispatch<SetStateAction<AdditionalPassenger[]>>;
  errors: AdditionalPassengerErrors;
  setErrors: Dispatch<SetStateAction<AdditionalPassengerErrors>>;
  discounts: Discount[];
  discountCardIds: string[];
  agents: AgentLikeOption[];
  confirmations: ConfirmationOption[];
  // A ticket-level promo discount (Акційна знижка) overrides every passenger's
  // own discount, so when it's set the per-passenger discount is disabled.
  promoDiscountActive: boolean;
}

export const AdditionalPassengersSection = ({
  passengers,
  setPassengers,
  errors,
  setErrors,
  discounts,
  discountCardIds,
  agents,
  confirmations,
  promoDiscountActive
}: AdditionalPassengersSectionProps) => {
  const update = (key: string, patch: Partial<AdditionalPassenger>) => {
    setPassengers((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p))
    );
  };

  // Clear one field's error as the user fixes it.
  const clearError = (key: string, field: string) => {
    setErrors((prev) => {
      if (!prev[key]?.[field]) return prev;
      const next = { ...prev, [key]: { ...prev[key], [field]: undefined } };
      return next;
    });
  };

  // Selecting a found passenger from the phone search autofills the block's
  // fields (name, lastName, DOB, phones, email, discount), mirroring the main
  // table. Phone itself is already set by the search input's onChange.
  const prefillFromPassenger = (key: string, found: PassengerOption) => {
    update(key, {
      name: found.name || '',
      lastName: found.lastName || '',
      dateOfBirth:
        found.dateOfBirth && dayjs(found.dateOfBirth).isValid()
          ? dayjs(found.dateOfBirth).format('YYYY-MM-DD')
          : '',
      additionalPhone:
        found.additionalPhone && found.additionalPhone !== '-'
          ? found.additionalPhone
          : '',
      email: found.email || '',
      passengerDiscount: found.passengerDiscount ?? null,
      discountCardNumber: found.discountCardNumber || ''
    });
    setErrors((prev) => ({ ...prev, [key]: {} }));
  };

  const remove = (key: string) => {
    setPassengers((prev) => prev.filter((p) => p.key !== key));
    setErrors((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const add = () => {
    setPassengers((prev) => [...prev, makeEmptyAdditionalPassenger()]);
  };

  // Same option set the main form uses (the list includes "Без знижки"), so the
  // dropdowns render identically in both modes.
  const discountOptions = (type: 'adult' | 'child') =>
    type === 'adult'
      ? discounts.filter((d) =>
          ['both', 'adults', 'discount-card'].includes(d.group)
        )
      : discounts.filter((d) => ['both', 'children'].includes(d.group));

  return (
    <Stack sx={{ gap: '12px', width: '100%' }}>
      {passengers.map((p, idx) => {
        const e = errors[p.key] || {};
        const isDiscountCard = discountCardIds.includes(
          String(p.passengerDiscount?.id)
        );
        // At least one payment is required, so both show the asterisk until one
        // is filled (mirrors the main form).
        const paymentRequired =
          !(Number(p.paymentOnBus) > 0) && !(Number(p.paymentAtOffice) > 0);
        return (
          <Accordion key={p.key} defaultExpanded disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  pr: 1
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Пасажир {idx + 2} (
                  {p.passengerType === 'adult' ? 'Дорослий' : 'Дитина'})
                </Typography>
                <Tooltip title="Видалити пасажира">
                  <IconButton
                    size="small"
                    color="error"
                    component="span"
                    onClick={(ev: MouseEvent<HTMLElement>) => {
                      ev.stopPropagation();
                      remove(p.key);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Field order mirrors the main create form (columnOrder):
                  lastName → name → DOB → type → confirmation → payments →
                  discount → card → phone → agent → seat → note → addPhone →
                  email. */}
              <Stack sx={{ gap: '18px', width: '100%' }}>
                <TextField
                  label="Прізвище"
                  variant="standard"
                  required
                  value={p.lastName}
                  error={!!e.lastName}
                  helperText={e.lastName}
                  onChange={(ev) => {
                    update(p.key, { lastName: ev.target.value });
                    clearError(p.key, 'lastName');
                  }}
                />

                <TextField
                  label="Ім'я"
                  variant="standard"
                  required
                  value={p.name}
                  error={!!e.name}
                  helperText={e.name}
                  onChange={(ev) => {
                    update(p.key, { name: ev.target.value });
                    clearError(p.key, 'name');
                  }}
                />

                <DatePicker
                  label="Дата народження"
                  format="DD-MM-YYYY"
                  value={p.dateOfBirth ? dayjs(p.dateOfBirth) : null}
                  onChange={(value) => {
                    update(p.key, {
                      dateOfBirth:
                        value && dayjs(value).isValid()
                          ? dayjs(value).format('YYYY-MM-DD')
                          : ''
                    });
                    clearError(p.key, 'dateOfBirth');
                  }}
                  slotProps={{
                    textField: {
                      variant: 'standard',
                      required: true,
                      fullWidth: true,
                      error: !!e.dateOfBirth,
                      helperText: e.dateOfBirth
                    }
                  }}
                />

                <TextField
                  select
                  label="Тип пасажира"
                  variant="standard"
                  required
                  value={p.passengerType}
                  onChange={(ev) => {
                    const passengerType = ev.target.value as 'adult' | 'child';
                    // Switching type clears type-specific fields + the discount
                    // (its allowed set differs per type).
                    update(p.key, {
                      passengerType,
                      passengerDiscount: null,
                      discountCardNumber: '',
                      ...(passengerType === 'child'
                        ? { phone: '', additionalPhone: '', email: '' }
                        : {})
                    });
                    setErrors((prev) => ({ ...prev, [p.key]: {} }));
                  }}
                >
                  <MenuItem value="adult">Дорослий</MenuItem>
                  <MenuItem value="child">Дитина</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Підтвердження"
                  variant="standard"
                  value={p.passengerConfirmation?.name || ''}
                  onChange={(ev) => {
                    const selected = confirmations.find(
                      (c) => c.value === ev.target.value
                    );
                    update(p.key, {
                      passengerConfirmation: selected
                        ? { id: String(selected.id), name: selected.value }
                        : null
                    });
                  }}
                >
                  {confirmations.map((c) => (
                    <MenuItem key={c.id} value={c.value}>
                      {c.value}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Оплата в автобусі"
                  variant="standard"
                  type="number"
                  required={paymentRequired}
                  value={p.paymentOnBus}
                  error={!!e.paymentOnBus}
                  helperText={e.paymentOnBus}
                  onChange={(ev) => {
                    update(p.key, { paymentOnBus: ev.target.value });
                    clearError(p.key, 'paymentOnBus');
                    clearError(p.key, 'paymentAtOffice');
                  }}
                />

                <TextField
                  label="Оплата в бюро"
                  variant="standard"
                  type="number"
                  required={paymentRequired}
                  value={p.paymentAtOffice}
                  error={!!e.paymentAtOffice}
                  helperText={e.paymentAtOffice}
                  onChange={(ev) => {
                    update(p.key, { paymentAtOffice: ev.target.value });
                    clearError(p.key, 'paymentOnBus');
                    clearError(p.key, 'paymentAtOffice');
                  }}
                />

                <TextField
                  select
                  label="Знижка пасажира"
                  variant="standard"
                  disabled={promoDiscountActive}
                  helperText={
                    promoDiscountActive
                      ? 'Діє акційна знижка на квиток'
                      : undefined
                  }
                  value={
                    promoDiscountActive ? '' : p.passengerDiscount?.name || ''
                  }
                  onChange={(ev) => {
                    const selected = discounts.find(
                      (d) =>
                        d.value.toLowerCase() === ev.target.value.toLowerCase()
                    );
                    const discountValue: PassengerDiscount | null = selected
                      ? {
                          id: String(selected.id),
                          percentage:
                            Math.round(Number(selected.coef) * 100) || 0,
                          name: selected.value
                        }
                      : null;
                    const stillCard = discountCardIds.includes(
                      String(discountValue?.id)
                    );
                    update(p.key, {
                      passengerDiscount: discountValue,
                      ...(stillCard ? {} : { discountCardNumber: '' })
                    });
                    clearError(p.key, 'discountCardNumber');
                  }}
                >
                  {discountOptions(p.passengerType).map((d) => (
                    <MenuItem key={d.id} value={d.value}>
                      {d.value}
                    </MenuItem>
                  ))}
                </TextField>

                {isDiscountCard && (
                  <TextField
                    label="Дисконтна карта"
                    variant="standard"
                    required
                    value={p.discountCardNumber}
                    error={!!e.discountCardNumber}
                    helperText={e.discountCardNumber}
                    onChange={(ev) => {
                      update(p.key, { discountCardNumber: ev.target.value });
                      clearError(p.key, 'discountCardNumber');
                    }}
                  />
                )}

                {p.passengerType === 'adult' && (
                  <PassengerSearchPhoneInput
                    label="Телефон"
                    required
                    value={p.phone}
                    error={!!e.phone}
                    helperText={e.phone}
                    onChange={(phone) => {
                      update(p.key, { phone });
                      clearError(p.key, 'phone');
                    }}
                    onSelectPassenger={(found) =>
                      prefillFromPassenger(p.key, found)
                    }
                  />
                )}

                <TextField
                  select
                  label="Агентство"
                  variant="standard"
                  value={p.agent?.name || ''}
                  onChange={(ev) => {
                    const selected = agents.find(
                      (a) => a.label === ev.target.value
                    );
                    update(p.key, {
                      agent: selected
                        ? { id: String(selected.id), name: selected.label }
                        : null
                    });
                  }}
                >
                  {agents.map((a) => (
                    <MenuItem key={a.id} value={a.label}>
                      {a.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="Місце"
                  variant="standard"
                  value={p.busSeat}
                  onChange={(ev) => update(p.key, { busSeat: ev.target.value })}
                />

                <TextField
                  label="Примітка"
                  variant="standard"
                  value={p.note}
                  onChange={(ev) => update(p.key, { note: ev.target.value })}
                />

                {p.passengerType === 'adult' && (
                  <>
                    <PassengerSearchPhoneInput
                      label="Дод. телефон"
                      enableSearch={false}
                      value={p.additionalPhone}
                      error={!!e.additionalPhone}
                      helperText={e.additionalPhone}
                      onChange={(phone) => {
                        update(p.key, { additionalPhone: phone });
                        clearError(p.key, 'additionalPhone');
                      }}
                    />

                    <TextField
                      label="Email"
                      variant="standard"
                      value={p.email}
                      error={!!e.email}
                      helperText={e.email}
                      onChange={(ev) => {
                        update(p.key, { email: ev.target.value });
                        clearError(p.key, 'email');
                      }}
                    />
                  </>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Box>
        <Button
          onClick={add}
          variant="text"
          startIcon={<AddTwoToneIcon fontSize="small" />}
          sx={{ p: 0 }}
        >
          Додати пасажира
        </Button>
      </Box>
    </Stack>
  );
};

export default AdditionalPassengersSection;

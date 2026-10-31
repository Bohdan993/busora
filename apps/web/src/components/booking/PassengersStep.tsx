'use client';

import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  useForm,
  useWatch,
  type Control,
  type UseFormRegister
} from 'react-hook-form';
import { z } from 'zod';
import { Link, useRouter } from '@/i18n/navigation';
import {
  getPassengerForm,
  validatePassengers,
  type PassengerForm
} from '@/lib/api/booking';
import { ApiError } from '@/lib/api/client';
import { useApiLanguage, useErrorMessage } from '@/lib/api/hooks';
import {
  discountCoef,
  discountGroupsFor,
  emptyPassengers,
  fromPassengersInfo,
  isCardDiscount,
  locateFieldError,
  NO_DISCOUNT,
  toPassengersData,
  type PassengerFields
} from '@/lib/booking/passengers';
import { formatMoney } from '@/lib/format';
import { BookingSteps } from './BookingSteps';
import { SessionTimer } from './SessionTimer';
import { TripSummary } from './TripSummary';

// Mirror the API's rules (config/market.js and passengerService) so most
// mistakes are caught before a round trip; the API still has the last word.
const PHONE = /^\+380[5-9][0-9]\d{7}$|^\+420[67]\d{8}$/;
const LATIN = /^[A-Za-z\s'-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Values = { passengers: PassengerFields[] };
type T = ReturnType<typeof useTranslations<'passengers'>>;

function buildSchema(t: T, groups: PassengerForm['discounts']) {
  const name = (min: number) =>
    z
      .string()
      .trim()
      .min(1, t('required'))
      .regex(LATIN, t('latinOnly'))
      .min(min, t('tooShort', { min }));

  const passenger = z
    .object({
      kind: z.enum(['adult', 'child']),
      name: name(3),
      lastName: name(2),
      phone: z.string(),
      additionalPhone: z.string(),
      email: z.string(),
      dateOfBirth: z.string().regex(ISO_DATE, t('invalidDate')),
      discountId: z.string(),
      cardNumber: z.string()
    })
    .superRefine((p, ctx) => {
      const phone = p.phone.trim();
      if (p.kind === 'adult' && !PHONE.test(phone)) {
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: phone ? t('invalidPhone') : t('required')
        });
      }
      const extra = p.additionalPhone.trim();
      if (extra && !PHONE.test(extra)) {
        ctx.addIssue({
          code: 'custom',
          path: ['additionalPhone'],
          message: t('invalidPhone')
        });
      }
      if (isCardDiscount(p.discountId, groups) && !p.cardNumber.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['cardNumber'],
          message: t('required')
        });
      }
    });

  return z.object({ passengers: z.array(passenger) }).superRefine((v, ctx) => {
    // The first passenger's email receives the tickets
    if (!z.email().safeParse(v.passengers[0]?.email.trim()).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['passengers', 0, 'email'],
        message: t('invalidEmail')
      });
    }
  });
}

export function PassengersStep() {
  const t = useTranslations();
  const languageCode = useApiLanguage();
  const errorMessage = useErrorMessage();
  const form = useQuery({
    queryKey: ['passenger-form', languageCode],
    queryFn: () => getPassengerForm(languageCode),
    staleTime: 0,
    gcTime: 0
  });

  return (
    <>
      <BookingSteps current="passengers" />
      <h1>{t('passengers.title')}</h1>
      <SessionTimer />
      <TripSummary />
      {form.isPending && <p>{t('common.loading')}</p>}
      {form.isError && (
        <p role="alert" className="error">
          {errorMessage(form.error)}{' '}
          <Link href="/">{t('session.restart')}</Link>
        </p>
      )}
      {form.isSuccess && <PassengersForm data={form.data} />}
    </>
  );
}

function PassengersForm({ data }: { data: PassengerForm }) {
  const t = useTranslations('passengers');
  const locale = useLocale();
  const router = useRouter();
  const languageCode = useApiLanguage();
  const errorMessage = useErrorMessage();
  const groups = useMemo(
    () => (data.showDiscounts ? data.discounts : []),
    [data]
  );
  const schema = useMemo(() => buildSchema(t, groups), [t, groups]);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      passengers: data.passengersInfo
        ? fromPassengersInfo(data.passengersInfo)
        : emptyPassengers(data.adults, data.children)
    }
  });

  const submit = useMutation({
    mutationFn: (values: Values) =>
      validatePassengers(
        toPassengersData(values.passengers, groups),
        languageCode
      ),
    onSuccess: () => router.push('/booking/review'),
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      for (const [key, messages] of Object.entries(error.fieldErrors)) {
        const place = locateFieldError(key);
        if (place) {
          setError(`passengers.${place.index}.${place.field}`, {
            type: 'server',
            message: messages[0]
          });
        }
      }
    }
  });

  const passengers = useWatch({ control, name: 'passengers' });
  const price = (discountId: string) =>
    Math.round(data.ticketPrice * (1 - discountCoef(discountId, groups)));
  const money = (amount: number) =>
    formatMoney(amount, data.currency.abbr ?? 'UAH', locale);
  const total = (passengers ?? []).reduce(
    (sum, p) => sum + price(p.discountId),
    0
  );

  let adultNo = 0;
  let childNo = 0;
  return (
    <form noValidate onSubmit={handleSubmit((values) => submit.mutate(values))}>
      <p className="muted">{t('passportNote')}</p>
      {!data.showDiscounts && <p>{t('promoNote')}</p>}
      {(passengers ?? []).map((p, index) => (
        <PassengerFieldset
          key={index}
          index={index}
          title={
            p.kind === 'adult'
              ? t('adult', { n: ++adultNo })
              : t('child', { n: ++childNo })
          }
          kind={p.kind}
          groups={groups}
          register={register}
          control={control}
          errors={errors.passengers?.[index]}
          price={money(price(p.discountId))}
        />
      ))}
      <p>
        <strong>{money(total)}</strong>
      </p>
      {submit.isError &&
        !(
          submit.error instanceof ApiError &&
          submit.error.code === 'VALIDATION_FAILED'
        ) && (
          <p role="alert" className="error">
            {errorMessage(submit.error)}
          </p>
        )}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="error">
          {errorMessage(new ApiError('VALIDATION_FAILED', 422, ''))}
        </p>
      )}
      <button type="submit" disabled={isSubmitting || submit.isPending}>
        {t('submit')}
      </button>
    </form>
  );
}

type FieldErrors = Partial<Record<keyof PassengerFields, { message?: string }>>;

function PassengerFieldset({
  index,
  title,
  kind,
  groups,
  register,
  control,
  errors,
  price
}: {
  index: number;
  title: string;
  kind: PassengerFields['kind'];
  groups: PassengerForm['discounts'];
  register: UseFormRegister<Values>;
  control: Control<Values>;
  errors?: FieldErrors;
  price: string;
}) {
  const t = useTranslations('passengers');
  const discountId = useWatch({
    control,
    name: `passengers.${index}.discountId`
  });
  const field = (name: keyof PassengerFields) =>
    `passengers.${index}.${name}` as const;
  const id = (name: string) => `p${index}-${name}`;

  const input = (
    name: keyof PassengerFields,
    label: string,
    props: {
      type?: string;
      autoComplete?: string;
      hint?: string;
      required?: boolean;
    } = {}
  ) => {
    const error = errors?.[name]?.message;
    return (
      <label htmlFor={id(name)}>
        {label}
        <br />
        <input
          id={id(name)}
          type={props.type ?? 'text'}
          autoComplete={props.autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [props.hint && id(`${name}-hint`), error && id(`${name}-error`)]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-required={props.required ?? true}
          {...register(field(name))}
        />
        {props.hint && (
          <span id={id(`${name}-hint`)} className="muted">
            <br />
            {props.hint}
          </span>
        )}
        {error && (
          <span id={id(`${name}-error`)} className="field-error" role="alert">
            <br />
            {error}
          </span>
        )}
      </label>
    );
  };

  const available = groups.length ? discountGroupsFor(kind, groups) : [];

  return (
    <fieldset>
      <legend>
        {title} — {t('pricePerPassenger', { price })}
      </legend>
      <div className="form-row">
        {input('name', t('firstName'), {
          autoComplete: index === 0 ? 'given-name' : 'off'
        })}
        {input('lastName', t('lastName'), {
          autoComplete: index === 0 ? 'family-name' : 'off'
        })}
        {input('dateOfBirth', t('dateOfBirth'), { type: 'date' })}
      </div>
      {kind === 'adult' && (
        <div className="form-row">
          {input('phone', t('phone'), {
            type: 'tel',
            hint: t('phoneHint'),
            autoComplete: index === 0 ? 'tel' : 'off'
          })}
          {input('additionalPhone', t('additionalPhone'), {
            type: 'tel',
            required: false
          })}
        </div>
      )}
      {index === 0 &&
        input('email', t('email'), {
          type: 'email',
          hint: t('emailHint'),
          autoComplete: 'email'
        })}
      {available.length > 0 && (
        <div className="form-row">
          <label htmlFor={id('discountId')}>
            {t('discount')}
            <br />
            <select id={id('discountId')} {...register(field('discountId'))}>
              <option value={NO_DISCOUNT}>{t('noDiscount')}</option>
              {available.flatMap((group) =>
                group.items.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
            {errors?.discountId?.message && (
              <span className="field-error" role="alert">
                <br />
                {errors.discountId.message}
              </span>
            )}
          </label>
          {isCardDiscount(discountId, groups) &&
            input('cardNumber', t('cardNumber'))}
        </div>
      )}
    </fieldset>
  );
}

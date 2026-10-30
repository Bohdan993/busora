import type { Ticket } from 'src/types/tickets';

export const validateRequired = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  return !!value;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10;
};

export const isValidationErrorsExist = (
  elem: Record<string, Ticket>,
  validationErrors: Record<string, string | undefined>
): boolean => {
  const ticketId = Object.keys(elem)?.[0];
  const errorsKeys = Object.keys(validationErrors);
  const transformedErrorsKeys = errorsKeys.map((el) => [
    String(el).split('_')?.[0],
    el
  ]);
  return transformedErrorsKeys.some(
    (el) => String(el[0]) === String(ticketId) && !!validationErrors[el[1]]
  );
};

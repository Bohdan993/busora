import { useState, useCallback } from 'react';
import type { Ticket } from 'src/types/tickets';
import { isValidationErrorsExist as checkValidationErrorsExist } from '../utils/ticketValidators';

export const useTicketsValidation = () => {
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string | undefined>
  >({});

  const [validationErrorsExist, setValidationErrorsExist] = useState<
    Record<string, boolean>
  >({});

  const updateValidationError = useCallback(
    (key: string, error: string | undefined) => {
      setValidationErrors((prev) => ({
        ...prev,
        [key]: error
      }));
    },
    []
  );

  const clearValidationErrors = useCallback(() => {
    setValidationErrors({});
    setValidationErrorsExist({});
  }, []);

  const checkErrorsExist = useCallback(
    (elem: Record<string, Ticket>): boolean => {
      return checkValidationErrorsExist(elem, validationErrors);
    },
    [validationErrors]
  );

  return {
    validationErrors,
    setValidationErrors,
    validationErrorsExist,
    setValidationErrorsExist,
    updateValidationError,
    clearValidationErrors,
    checkErrorsExist
  };
};

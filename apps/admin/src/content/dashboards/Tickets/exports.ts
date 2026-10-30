/**
 * Tickets Module - Refactored Entry Point
 *
 * This module exports all the refactored components, hooks, and utilities
 * for the Tickets table feature.
 *
 * Usage:
 * ```typescript
 * import {
 *   useTicketsData,
 *   useTicketsState,
 *   VALID_PAGE_SIZES,
 *   validateRequired
 * } from 'src/content/dashboards/Tickets';
 * ```
 */

// Main component
export { default as TicketsTable } from './TicketsTable';

// Hooks
export {
  useTicketsData,
  useTicketsMutations,
  useTicketsState,
  useTicketsValidation
} from './hooks';

// Constants
export {
  VALID_PAGE_SIZES,
  COLUMNS_DEFINITIONS,
  type ColumnDefinitionItem,
  type ColumnsDefinition,
  type CustomOrder,
  type CustomSortingState
} from './constants';

// Utilities
export {
  transformTicket,
  transformTicketBusFlightToString,
  validateRequired,
  validateEmail,
  validatePhone,
  isValidationErrorsExist
} from './utils';

// Column helpers
export {
  checkIfCellIsDisabled,
  getCellBackgroundColor,
  type ColumnHelpers
} from './columns/columnHelpers';

# Migration Guide: Refactoring TicketsTable.tsx

## 🎯 Overview

This guide helps you migrate the existing TicketsTable.tsx (~3500 lines) to use the newly extracted modules following SOLID principles and React best practices.

## 📋 Prerequisites

All new modules have been created in:

- ✅ `constants.ts` - Constants and type definitions
- ✅ `hooks/` - Custom hooks for data, mutations, state, and validation
- ✅ `utils/` - Utility functions for transformations and validation
- ✅ `columns/` - Column helper utilities

## 🔄 Step-by-Step Migration

### Step 1: Update Imports

Replace existing imports with the new modular structure.

**Before:**

```typescript
import {
  validateRequired,
  validateEmail,
  validatePhone
} from 'src/helpers/validators';
import { isOneWayTicket, transformTicketBusFlightToString } from 'src/helpers';

const validPageSizes = [5, 10, 15, 20, 30, 50, 100, 500];
const columnsDefinitions = {
  /* ... */
};
```

**After:**

```typescript
// Import from local modules
import {
  useTicketsData,
  useTicketsMutations,
  useTicketsState,
  useTicketsValidation
} from './hooks';
import { VALID_PAGE_SIZES, COLUMNS_DEFINITIONS } from './constants';
import {
  validateRequired,
  validateEmail,
  validatePhone,
  isOneWayTicket,
  transformTicket,
  transformTicketBusFlightToString
} from './utils';
```

### Step 2: Replace State Hooks

**Before:**

```typescript
const [pagination, setPagination] = useState<MRT_PaginationState>({
  /* ... */
});
const [sorting, setSorting] = useState<MRT_SortingState>(/* ... */);
const [columnFilters, setColumnFilters] =
  useState<MRT_ColumnFiltersState>(/* ... */);
const [validationErrors, setValidationErrors] = useState<
  Record<string, string | undefined>
>({});
const [validationErrorsExist, setValidationErrorsExist] = useState<
  Record<string, boolean>
>({});
const [snackBarState, setSnackBarState] = useState<SnackbarState>({
  /* ... */
});
// ... 15+ more useState hooks
```

**After:**

```typescript
// Single hook call for all state management
const state = useTicketsState(initialData);

// Destructure only what you need
const {
  pagination,
  setPagination,
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters
  // ... all other state
} = state;

// Validation state
const validation = useTicketsValidation();
const {
  validationErrors,
  validationErrorsExist,
  updateValidationError,
  clearValidationErrors
} = validation;
```

### Step 3: Replace Data Fetching

**Before:**

```typescript
const {
  data: ticketAttributesData,
  error: ticketAttributesError,
  isError: ticketAttributesIsError,
  isLoading: ticketAttributesIsLoading,
  refetch: refetchAttributes
} = useGetTicketAttributesQuery(undefined, {
  refetchOnFocus: false,
  refetchOnReconnect: false
});

// Repeat for currencies, cities, discounts...
```

**After:**

```typescript
const { ticketAttributes, currencies, cities, discounts } = useTicketsData();

// Access data like this:
// ticketAttributes.data
// ticketAttributes.isLoading
// ticketAttributes.isError
// ticketAttributes.refetch()
```

### Step 4: Replace Mutation Hooks

**Before:**

```typescript
const [deleteFn, deleteResult] = useDeleteTicketMutation();
const [updateFn, updateResult] = useUpdateTicketMutation();
const [createFn, createResult] = useCreateTicketMutation();
const [generateFn, generateResult] = useGenerateTicketMutation();

const {
  isError: createIsError,
  isSuccess: createIsSuccess,
  isLoading: createIsLoading,
  error: createError,
  reset: createReset
} = createResult;
// ... repeat for other mutations
```

**After:**

```typescript
const mutations = useTicketsMutations();

// Access like this:
// mutations.create.mutate(data)
// mutations.create.isLoading
// mutations.update.mutate(data)
// mutations.delete.mutate(id)
// mutations.generate.mutate(id)
```

### Step 5: Update Validation Logic

**Before:**

```typescript
const validationError = !validateRequired(event.target.value)
  ? "Поле обов'язкове"
  : undefined;

setValidationErrors((prev) => ({
  ...prev,
  [cell.id]: validationError
}));
```

**After:**

```typescript
const validationError = !validateRequired(event.target.value)
  ? "Поле обов'язкове"
  : undefined;

// Use the dedicated update function
updateValidationError(cell.id, validationError);
```

### Step 6: Update Column Definitions

The column definitions remain inline for now (Phase 3 will extract them).

**Current approach:**

```typescript
const columns = useMemo<MRT_ColumnDef<Ticket>[]>(
  () => [
    // ... existing column definitions
  ],
  [
    initialData,
    ticketAttributes.data, // Changed from ticketAttributesData
    currencies.data, // Changed from currenciesData
    cities.data, // Changed from citiesData
    discounts.data, // Changed from discountsData
    editedTicket,
    validationErrors,
    validationErrorsExist,
    actionState
  ]
);
```

### Step 7: Update Helper Function Calls

**Before:**

```typescript
import { isOneWayTicket } from 'src/helpers';
```

**After:**

```typescript
import { isOneWayTicket } from './utils';
```

### Step 8: Clean Up Module-Level Definitions

**Remove these from TicketsTable.tsx:**

```typescript
// ❌ Remove - now in constants.ts
const validPageSizes = [5, 10, 15, 20, 30, 50, 100, 500];
export interface ColumnDefinitionItem {
  /* ... */
}
export interface ColumnsDefinition {
  /* ... */
}
type CustomOrder = 'KP' | 'PK' | 'TP' | 'PT';
interface CustomSortingState {
  /* ... */
}
const columnsDefinitions: ColumnsDefinition = {
  /* ... */
};

// ❌ Remove - now in utils/ticketValidators.ts
export const isValidationErrorsExist = (/* ... */) => {
  /* ... */
};

// ❌ Remove - now in utils/ticketTransformers.ts
export const transformTicket = (/* ... */) => {
  /* ... */
};

// ❌ Remove - now in columns/columnHelpers.ts
const checkIfMaskedPhoneInputIsDisabled = (/* ... */) => {
  /* ... */
};
```

## 🧪 Testing After Migration

### 1. Verify All Imports

```bash
# Check for any broken imports
npm run build
# or
yarn build
```

### 2. Test Core Functionality

- [ ] Table loads with data
- [ ] Pagination works
- [ ] Sorting works
- [ ] Filtering works
- [ ] Creating tickets works
- [ ] Editing tickets works
- [ ] Deleting tickets works
- [ ] Validation works
- [ ] Modals open/close correctly

### 3. Check Developer Console

- No TypeScript errors
- No runtime errors
- No missing import warnings

## 🐛 Common Issues & Solutions

### Issue 1: TypeScript errors on imports

**Problem:** `Cannot find module './hooks'`

**Solution:**

```typescript
// Make sure the path is correct
import { useTicketsData } from './hooks'; // ✅ Correct
import { useTicketsData } from 'src/content/dashboards/Tickets/hooks'; // ✅ Also works
```

### Issue 2: Data properties undefined

**Problem:** `ticketAttributesData is undefined`

**Solution:**

```typescript
// Old way
const data = ticketAttributesData?.data;

// New way
const data = ticketAttributes.data?.data; // Note the extra .data
```

### Issue 3: State updates not working

**Problem:** Calling `setPagination` doesn't update state

**Solution:** Make sure you destructured it from the state object:

```typescript
const state = useTicketsState(initialData);
const { pagination, setPagination } = state; // ✅ Destructure
```

## 📊 Before & After Comparison

### File Size

- **Before:** 3,508 lines in single file
- **After:** ~300 lines in main component + ~500 lines across modules

### Responsibilities

- **Before:** One component doing everything
- **After:**
  - TicketsTable.tsx: Composition and rendering
  - hooks/: 4 focused hooks
  - utils/: Pure utility functions
  - constants.ts: Configuration
  - columns/: Column utilities

### Testability

- **Before:** Difficult to test individual pieces
- **After:** Each module can be tested in isolation

### Maintainability

- **Before:** Hard to find specific logic
- **After:** Clear file/folder organization

## ✅ Verification Checklist

- [ ] All imports updated to use local modules
- [ ] `validPageSizes` replaced with `VALID_PAGE_SIZES`
- [ ] `columnsDefinitions` replaced with `COLUMNS_DEFINITIONS`
- [ ] State management using `useTicketsState`
- [ ] Data fetching using `useTicketsData`
- [ ] Mutations using `useTicketsMutations`
- [ ] Validation using `useTicketsValidation`
- [ ] Utility functions imported from `./utils`
- [ ] No duplicate code between main file and extracted modules
- [ ] All TypeScript errors resolved
- [ ] Application builds successfully
- [ ] All features work as before

## 🎓 Learning Resources

- [React Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [SOLID Principles in React](https://dmitripavlutin.com/solid-principles-in-react/)
- [Component Composition](https://react.dev/learn/thinking-in-react)

## 🚀 Next Phase

After completing this migration:

1. Extract cell components (Phase 2)
2. Extract column definitions into hook (Phase 3)
3. Add unit tests for each module
4. Consider adding integration tests

## 📞 Need Help?

Refer to:

- [REFACTORING.md](./REFACTORING.md) - Overview of refactoring structure
- [TicketsTable.refactored.example.tsx](./TicketsTable.refactored.example.tsx) - Example implementation

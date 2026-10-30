# Quick Reference Card - TicketsTable Refactoring

## 🚀 Quick Start

```typescript
// Import hooks
import {
  useTicketsData,
  useTicketsMutations,
  useTicketsState,
  useTicketsValidation
} from './hooks';

// In your component
const MyComponent = () => {
  const [data, setData] = useState<Ticket[]>([]);

  // Get all data queries
  const { ticketAttributes, currencies, cities, discounts } = useTicketsData();

  // Get all mutations
  const mutations = useTicketsMutations();

  // Get all state
  const state = useTicketsState(data);

  // Get validation
  const validation = useTicketsValidation();

  // Use them!
  const handleCreate = async (ticket: Ticket) => {
    await mutations.create.mutate(ticket);
  };

  return <div>...</div>;
};
```

## 📦 Available Hooks

### useTicketsData()

```typescript
const {
  ticketAttributes, // { data, error, isError, isLoading, refetch }
  currencies, // { data, error, isError, isLoading, refetch }
  cities, // { data, error, isError, isLoading, refetch }
  discounts // { data, error, isError, isLoading, refetch }
} = useTicketsData();
```

### useTicketsMutations()

```typescript
const {
  create,   // { mutate, isError, isSuccess, isLoading, error, reset }
  update,   // { mutate, isError, isSuccess, isLoading, error, reset }
  delete,   // { mutate, isError, isSuccess, isLoading, error, data, reset }
  generate  // { mutate, isError, isSuccess, isLoading, error, data, reset }
} = useTicketsMutations();
```

### useTicketsState(initialData)

```typescript
const {
  // Pagination
  pagination,
  setPagination,

  // Sorting
  sorting,
  setSorting,
  customSorting,
  setCustomSorting,

  // Filtering
  columnFilters,
  setColumnFilters,
  dateOfBirthValue,
  setDateOfBirthValue,
  dateOfCreatureValue,
  setDateOfCreatureValue,
  dateOfDepartureValue,
  setDateOfDepartureValue,
  dateOfReturnValue,
  setDateOfReturnValue,

  // UI State
  isFullScreen,
  setIsFullScreen,
  sendTicketModalOpen,
  setSendTicketModalOpen,
  sendTicketModalRow,
  setSendTicketModalRow,
  actionState,
  setActionState,
  snackBarState,
  setSnackBarState,

  // Editing
  currId,
  setCurrId,
  editedTicket,
  setEditedTicket,
  passengersDiscountValues,
  setPassengersDiscountValues,
  numOfFreeSeats,
  setNumOfFreeSeats
} = useTicketsState(initialData);
```

### useTicketsValidation()

```typescript
const {
  validationErrors,
  setValidationErrors,
  validationErrorsExist,
  setValidationErrorsExist,
  updateValidationError, // (key, error) => void
  clearValidationErrors, // () => void
  checkErrorsExist // (ticket) => boolean
} = useTicketsValidation();
```

## 🛠️ Available Utilities

### Transformers

```typescript
import {
  isOneWayTicket, // (type: string) => boolean
  transformTicket, // (ticket: Ticket) => TransformedTicket
  transformTicketBusFlightToString // (ticket, flightType) => string
} from './utils';
```

### Validators

```typescript
import {
  validateRequired, // (value: any) => boolean
  validateEmail, // (email: string) => boolean
  validatePhone, // (phone: string) => boolean
  isValidationErrorsExist // (elem, errors) => boolean
} from './utils';
```

### Column Helpers

```typescript
import {
  checkIfCellIsDisabled, // (row, errors, columnName) => boolean
  getCellBackgroundColor // (row, columnName, errors, theme) => string
} from './columns/columnHelpers';
```

## 📋 Constants

```typescript
import {
  VALID_PAGE_SIZES, // [5, 10, 15, 20, 30, 50, 100, 500]
  COLUMNS_DEFINITIONS // Column visibility config
} from './constants';
```

## 💡 Common Patterns

### Creating a Ticket

```typescript
const mutations = useTicketsMutations();

const handleCreate = async (values: Ticket) => {
  const transformed = transformTicket(values);
  await mutations.create.mutate(transformed);

  if (mutations.create.isSuccess) {
    console.log('Ticket created!');
  }
};
```

### Validating Fields

```typescript
const validation = useTicketsValidation();

const handleFieldBlur = (field: string, value: any) => {
  const error = !validateRequired(value) ? "Поле обов'язкове" : undefined;

  validation.updateValidationError(field, error);
};
```

### Checking Loading State

```typescript
const { ticketAttributes, currencies, cities, discounts } = useTicketsData();

const isLoading =
  ticketAttributes.isLoading ||
  currencies.isLoading ||
  cities.isLoading ||
  discounts.isLoading;

if (isLoading) return <CircularProgress />;
```

### Updating State

```typescript
const state = useTicketsState(initialData);

// Update pagination
state.setPagination({ pageIndex: 0, pageSize: 20 });

// Update filter
state.setColumnFilters([{ id: 'lastName', value: 'Smith' }]);

// Show modal
state.setSendTicketModalOpen(true);
```

## 🎯 Migration Steps

1. **Update imports**

   ```typescript
   // From
   import { validateRequired } from 'src/helpers/validators';

   // To
   import { validateRequired } from './utils';
   ```

2. **Replace state hooks**

   ```typescript
   // From
   const [pagination, setPagination] = useState(...);

   // To
   const state = useTicketsState(initialData);
   const { pagination, setPagination } = state;
   ```

3. **Replace data queries**

   ```typescript
   // From
   const { data: citiesData } = useGetCitiesQuery();

   // To
   const { cities } = useTicketsData();
   const citiesData = cities.data;
   ```

## 📚 Documentation

- **REFACTORING.md** - Complete overview and architecture
- **MIGRATION_GUIDE.md** - Detailed migration instructions
- **SUMMARY.md** - Project summary and achievements
- **TicketsTable.refactored.example.tsx** - Working example

## ⚡ Tips

- Import from `'./hooks'` instead of individual files
- Use destructuring to get only what you need
- All hooks are memoization-friendly
- Pure functions (utils) are fully testable
- Keep main component focused on composition

## 🐛 Troubleshooting

**Can't find module './hooks'?**

- Check file path is correct
- Make sure index.ts exists in hooks/

**TypeScript errors on data access?**

- Remember: `ticketAttributes.data?.data` (nested data)
- Old: `ticketAttributesData?.data`
- New: `ticketAttributes.data?.data`

**State not updating?**

- Make sure you destructured the setter
- Check you're calling the right function

## 🎉 That's It!

You now have a clean, maintainable, SOLID-compliant codebase!

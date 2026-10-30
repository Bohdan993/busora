# Tickets Module Refactoring

## 📁 New Structure

```
src/content/dashboards/Tickets/
├── TicketsTable.tsx          # Main component (refactored)
├── TopToolbarMenu.tsx         # Existing toolbar component
├── constants.ts               # Constants and type definitions
├── hooks/
│   ├── index.ts
│   ├── useTicketsData.ts      # Data fetching hook
│   ├── useTicketsMutations.ts # Mutation operations hook
│   ├── useTicketsState.ts     # State management hook
│   └── useTicketsValidation.ts # Validation logic hook
├── utils/
│   ├── index.ts
│   ├── ticketTransformers.ts  # Data transformation functions
│   └── ticketValidators.ts    # Validation functions
├── columns/
│   └── columnHelpers.ts       # Column utility functions
└── components/                # Future: Reusable cell components
```

## 🎯 Refactoring Benefits

### 1. **Single Responsibility Principle (SRP)**

- Each file/module has one clear purpose
- `useTicketsData.ts` - Only handles data fetching
- `useTicketsValidation.ts` - Only handles validation
- `ticketTransformers.ts` - Only handles data transformations

### 2. **Open/Closed Principle (OCP)**

- Easy to extend functionality without modifying existing code
- Add new hooks without touching the main component
- Add new validators without modifying existing ones

### 3. **Dependency Inversion Principle (DIP)**

- Main component depends on abstractions (hooks) not implementations
- Easy to swap implementations or add caching layers

### 4. **Better Testability**

- Each hook and utility can be tested in isolation
- Mock dependencies easily in tests
- Clear input/output contracts

### 5. **Improved Maintainability**

- Easy to locate specific functionality
- Reduced cognitive load - smaller files to understand
- Better code organization and discoverability

## 📦 Module Descriptions

### `constants.ts`

Contains all constant values and type definitions:

- `VALID_PAGE_SIZES` - Allowed pagination sizes
- `COLUMNS_DEFINITIONS` - Column visibility configuration
- `CustomOrder`, `CustomSortingState` types

### `hooks/useTicketsData.ts`

Manages all data fetching operations:

- Ticket attributes (types, statuses, etc.)
- Currencies list
- Cities list
- Discounts list
- Returns organized data with loading/error states

**Usage:**

```typescript
const { ticketAttributes, currencies, cities, discounts } = useTicketsData();
```

### `hooks/useTicketsMutations.ts`

Handles all mutation operations:

- Create ticket
- Update ticket
- Delete ticket
- Generate ticket PDF

**Usage:**

```typescript
const {
  create,
  update,
  delete: deleteTicket,
  generate
} = useTicketsMutations();
```

### `hooks/useTicketsState.ts`

Manages all component state:

- Pagination, sorting, filtering
- Date filter values
- Modal states
- Editing state
- Passenger discount values

**Usage:**

```typescript
const {
  pagination,
  setPagination,
  sorting,
  setSorting
  // ... all other state
} = useTicketsState(initialData);
```

### `hooks/useTicketsValidation.ts`

Handles validation logic:

- Validation errors tracking
- Error state management
- Helper functions for validation

**Usage:**

```typescript
const { validationErrors, updateValidationError, clearValidationErrors } =
  useTicketsValidation();
```

### `utils/ticketTransformers.ts`

Pure transformation functions:

- `isOneWayTicket(type)` - Check if ticket is one-way
- `transformTicket(ticket)` - Transform ticket for API
- `transformTicketBusFlightToString(ticket, type)` - Format flight display

### `utils/ticketValidators.ts`

Pure validation functions:

- `validateRequired(value)` - Check if value exists
- `validateEmail(email)` - Email format validation
- `validatePhone(phone)` - Phone number validation
- `isValidationErrorsExist(elem, errors)` - Check for validation errors

### `columns/columnHelpers.ts`

Column-related utilities:

- `checkIfCellIsDisabled()` - Determine if cell should be disabled
- `getCellBackgroundColor()` - Get cell background color based on state

## 🔄 Next Steps for Complete Refactoring

### Phase 2: Extract Cell Components

Create reusable cell components in `components/cells/`:

- `EditableTextCell.tsx`
- `EditableDateCell.tsx`
- `EditableSelectCell.tsx`
- `EditableCityCell.tsx`
- `EditableBusFlightCell.tsx`
- `EditablePhoneCell.tsx`

### Phase 3: Extract Column Definitions

Move the massive column definitions array to:

- `columns/useTicketsColumns.tsx` - Hook that returns column definitions
- Break down into smaller column factory functions
- Use the cell components created in Phase 2

### Phase 4: Simplify Main Component

- Main component becomes a composition of hooks and components
- Reduced from ~3500 lines to ~200-300 lines
- Clear separation of concerns

## 🧪 Testing Strategy

Each module can now be tested independently:

```typescript
// Example: Testing validation
import { validateEmail, validatePhone } from './utils/ticketValidators';

test('validates email correctly', () => {
  expect(validateEmail('test@example.com')).toBe(true);
  expect(validateEmail('invalid')).toBe(false);
});

// Example: Testing transformers
import { transformTicket } from './utils/ticketTransformers';

test('transforms ticket correctly', () => {
  const ticket = {
    /* mock ticket */
  };
  const result = transformTicket(ticket);
  expect(result).toMatchObject({
    /* expected shape */
  });
});
```

## 📖 Usage in Main Component

After refactoring, the main component will look like:

```typescript
const TicketsTable: FC = () => {
  const [initialData, setInitialData] = useState<Ticket[]>([]);

  // Data fetching
  const { ticketAttributes, currencies, cities, discounts } = useTicketsData();

  // Mutations
  const mutations = useTicketsMutations();

  // State management
  const state = useTicketsState(initialData);

  // Validation
  const validation = useTicketsValidation();

  // Column definitions (Phase 3)
  const columns = useTicketsColumns({
    ...state,
    ...validation,
    ticketAttributes: ticketAttributes.data,
    currencies: currencies.data,
    cities: cities.data,
    discounts: discounts.data
  });

  // ... rest of the component logic
};
```

## 🎨 Benefits Achieved

1. **Reduced Complexity**: Each file is small and focused
2. **Better Reusability**: Hooks can be used in other components
3. **Easier Debugging**: Clear separation makes bugs easier to trace
4. **Improved Performance**: Can optimize individual hooks with React.memo
5. **Team Collaboration**: Multiple developers can work on different modules
6. **Better Documentation**: Each module has clear responsibility
7. **Easier Onboarding**: New developers can understand one module at a time

## 🚀 Migration Guide

To use the refactored version in TicketsTable.tsx:

1. Replace imports from `src/helpers` with imports from local `utils`
2. Replace `validPageSizes` with `VALID_PAGE_SIZES` from `constants`
3. Replace `columnsDefinitions` with `COLUMNS_DEFINITIONS` from `constants`
4. Replace individual state hooks with `useTicketsState(initialData)`
5. Replace individual query hooks with `useTicketsData()`
6. Replace mutation hooks with `useTicketsMutations()`
7. Replace validation state with `useTicketsValidation()`

## 📚 Additional Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [SOLID Principles in React](https://react.dev/learn/thinking-in-react)
- [Custom Hooks Best Practices](https://react.dev/learn/reusing-logic-with-custom-hooks)

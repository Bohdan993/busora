# TicketsTable Architecture Diagram

## 📊 Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TicketsTable.tsx                         │
│                   (Main Component)                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Component Composition                   │  │
│  │  • Renders MaterialReactTable                       │  │
│  │  • Composes hooks together                          │  │
│  │  • Handles user interactions                        │  │
│  │  • Manages component lifecycle                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Custom Hooks                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│useTicketsData │  │useTickets    │  │useTickets    │
│               │  │Mutations     │  │State         │
│               │  │              │  │              │
│ • Attributes  │  │ • Create     │  │ • Pagination │
│ • Currencies  │  │ • Update     │  │ • Sorting    │
│ • Cities      │  │ • Delete     │  │ • Filtering  │
│ • Discounts   │  │ • Generate   │  │ • UI State   │
└───────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────┐
│ RTK Query API │  │ RTK Query    │  │ useState     │
│ Hooks         │  │ Mutations    │  │ Hooks        │
└───────────────┘  └──────────────┘  └──────────────┘

        ┌─────────────────┐
        │useTickets       │
        │Validation       │
        │                 │
        │ • Errors        │
        │ • Validators    │
        └─────────────────┘
                │
                ▼
        ┌─────────────────┐
        │ Validation Utils│
        └─────────────────┘
```

## 🔄 Data Flow

```
┌──────────────┐
│     User     │
│  Interaction │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Event Handler   │
│  in Component    │
└──────┬───────────┘
       │
       ├─────────────────────────────┐
       │                             │
       ▼                             ▼
┌──────────────┐            ┌──────────────┐
│ State Update │            │  Validation  │
│  via Hook    │            │  via Utils   │
└──────┬───────┘            └──────┬───────┘
       │                           │
       │         ┌─────────────────┘
       │         │
       ▼         ▼
┌─────────────────────┐
│   API Call via      │
│   Mutation Hook     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Backend API       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Response          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Update UI State   │
│   & Show Feedback   │
└─────────────────────┘
```

## 📁 File Dependency Graph

```
TicketsTable.tsx
├── hooks/
│   ├── useTicketsData.ts
│   │   └── services/ (external)
│   │       ├── cities
│   │       ├── currencies
│   │       ├── discounts
│   │       └── ticket
│   │
│   ├── useTicketsMutations.ts
│   │   └── services/ticket (external)
│   │
│   ├── useTicketsState.ts
│   │   └── constants.ts
│   │
│   └── useTicketsValidation.ts
│       └── utils/ticketValidators.ts
│
├── utils/
│   ├── ticketTransformers.ts
│   │   └── types/tickets (external)
│   │
│   └── ticketValidators.ts
│       └── types/tickets (external)
│
├── columns/
│   └── columnHelpers.ts
│       └── types/tickets (external)
│
└── constants.ts
```

## 🎯 Responsibility Layers

```
┌─────────────────────────────────────────────────┐
│            Presentation Layer                   │
│  • TicketsTable.tsx                            │
│  • Renders UI                                   │
│  • Composes hooks                              │
│  • Handles events                              │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────┐
│           Business Logic Layer                  │
│  • Custom Hooks                                │
│  • State Management                            │
│  • Data Fetching                               │
│  • Mutations                                   │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────┐
│             Utility Layer                       │
│  • Pure Functions                              │
│  • Transformers                                │
│  • Validators                                  │
│  • Constants                                   │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────┴────────────────────────────────┐
│              Data Layer                         │
│  • RTK Query                                   │
│  • API Calls                                   │
│  • Backend Communication                       │
└─────────────────────────────────────────────────┘
```

## 🔐 SOLID Principles Mapping

```
Single Responsibility Principle (SRP)
├── useTicketsData.ts      → Only data fetching
├── useTicketsMutations.ts → Only mutations
├── useTicketsState.ts     → Only state management
├── useTicketsValidation.ts→ Only validation
├── ticketTransformers.ts  → Only transformations
└── ticketValidators.ts    → Only validation logic

Open/Closed Principle (OCP)
├── Add new hook          → Without modifying existing
├── Add new validator     → Without changing others
└── Extend functionality  → By composition

Liskov Substitution Principle (LSP)
├── All hooks follow same pattern
└── Can be mocked/swapped easily

Interface Segregation Principle (ISP)
├── Each hook exposes only needed properties
└── No "god objects"

Dependency Inversion Principle (DIP)
├── Component depends on hook abstractions
└── Not on concrete implementations
```

## 🧩 Module Interaction

```
┌────────────────────────────────────────────────┐
│                                                │
│           TicketsTable Component               │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  │  const data = useTicketsData();         │ │
│  │  const mutations = useTicketsMutations();│ │
│  │  const state = useTicketsState(initial);│ │
│  │  const validation = useTicketsValidation();│ │
│  │                                          │ │
│  │  return (                                │ │
│  │    <MaterialReactTable                  │ │
│  │      columns={columns}                  │ │
│  │      data={data.ticketAttributes.data} │ │
│  │      state={{                           │ │
│  │        pagination: state.pagination,    │ │
│  │        sorting: state.sorting           │ │
│  │      }}                                  │ │
│  │      onPaginationChange={               │ │
│  │        state.setPagination              │ │
│  │      }                                   │ │
│  │    />                                    │ │
│  │  );                                      │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```

## 📊 Before vs After Structure

### Before (Monolithic)

```
TicketsTable.tsx (3,508 lines)
├── Imports (50 lines)
├── Constants (200 lines)
├── Types (50 lines)
├── Helper Functions (200 lines)
├── Component Declaration (50 lines)
├── State Hooks (100 lines)
├── Query Hooks (150 lines)
├── Mutation Hooks (100 lines)
├── Column Definitions (2,000 lines)
├── Event Handlers (300 lines)
├── Effects (100 lines)
└── Render (208 lines)
```

### After (Modular)

```
Tickets Module
├── TicketsTable.tsx (~300 lines)
│   ├── Imports
│   ├── Component
│   └── Render
│
├── hooks/ (4 files, ~400 lines total)
│   ├── useTicketsData.ts (~80 lines)
│   ├── useTicketsMutations.ts (~50 lines)
│   ├── useTicketsState.ts (~150 lines)
│   └── useTicketsValidation.ts (~40 lines)
│
├── utils/ (2 files, ~100 lines total)
│   ├── ticketTransformers.ts (~60 lines)
│   └── ticketValidators.ts (~40 lines)
│
├── columns/ (1 file, ~50 lines)
│   └── columnHelpers.ts (~50 lines)
│
├── constants.ts (~180 lines)
│
└── Documentation (4 files)
    ├── REFACTORING.md
    ├── MIGRATION_GUIDE.md
    ├── SUMMARY.md
    └── QUICK_REFERENCE.md
```

## 🎨 Benefits Visualization

```
                    BEFORE
    ┌───────────────────────────────┐
    │      One Large File           │
    │    (3,508 lines)              │
    │                               │
    │  Everything Mixed Together:   │
    │  • Data Fetching              │
    │  • State Management           │
    │  • Business Logic             │
    │  • Validation                 │
    │  • Rendering                  │
    │  • Constants                  │
    │  • Utilities                  │
    │                               │
    │  Hard to:                     │
    │  ✗ Navigate                   │
    │  ✗ Test                       │
    │  ✗ Maintain                   │
    │  ✗ Understand                 │
    │  ✗ Extend                     │
    └───────────────────────────────┘

                    AFTER
    ┌───────────────────────────────┐
    │    Well-Organized Modules     │
    │    (~1,000 lines total)       │
    │                               │
    │  Separated by Concern:        │
    │  📁 hooks/                    │
    │  📁 utils/                    │
    │  📁 columns/                  │
    │  📄 constants.ts              │
    │  📄 TicketsTable.tsx          │
    │                               │
    │  Easy to:                     │
    │  ✓ Navigate                   │
    │  ✓ Test                       │
    │  ✓ Maintain                   │
    │  ✓ Understand                 │
    │  ✓ Extend                     │
    └───────────────────────────────┘
```

## 🚀 Import Graph

```
External Dependencies
        ↓
┌───────────────┐
│  React/MUI    │
│  RTK Query    │
│  Day.js       │
└───────┬───────┘
        │
        ▼
┌───────────────────────┐
│  constants.ts         │
│  • VALID_PAGE_SIZES   │
│  • COLUMNS_DEFINITIONS│
└───────┬───────────────┘
        │
        ├──────────────┬──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐
│ utils/       │ │ columns/ │ │ hooks/   │
│ • Transform  │ │ • Helpers│ │ • Data   │
│ • Validate   │ └──────────┘ │ • State  │
└──────────────┘              │ • Mutation│
                              │ • Validate│
                              └─────┬─────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │TicketsTable   │
                            │   .tsx        │
                            └───────────────┘
```

This architecture follows the **dependency rule**: outer layers depend on inner layers, never the reverse.

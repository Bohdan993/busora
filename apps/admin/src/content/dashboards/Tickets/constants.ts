export const VALID_PAGE_SIZES = [10, 20, 50, 100];

export type ValidPageSize = 10 | 20 | 50 | 100;

export interface ColumnDefinitionItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface ColumnsDefinition {
  ticketsTable?: ColumnDefinitionItem[];
}

// Directions of the bus lines, by routecityorders.routeKey (see the API's
// seed data). Sorting by one orders tickets by the city's stop on that line.
export const ROUTE_SORT_OPTIONS = [
  { key: 'KP', label: 'Київ - Прага' },
  { key: 'PK', label: 'Прага - Київ' },
  { key: 'TP', label: 'Тернопіль - Пльзень' },
  { key: 'PT', label: 'Пльзень - Тернопіль' }
] as const;

export type CustomOrder = typeof ROUTE_SORT_OPTIONS[number]['key'];

export interface CustomSortingState {
  id: string;
  order: CustomOrder;
}

export const COLUMNS_DEFINITIONS: ColumnsDefinition = {
  ticketsTable: [
    {
      id: 'ticketId',
      name: 'ID квитка',
      checked: false
    },
    {
      id: 'lastName',
      name: 'Прізвище',
      checked: true
    },
    {
      id: 'name',
      name: "Ім'я",
      checked: true
    },
    {
      id: 'confirmation',
      name: 'Підтвердження',
      checked: false
    },
    {
      id: 'ticketNumber',
      name: '№ квитка',
      checked: true
    },
    {
      id: 'type',
      name: 'Тип квитка',
      checked: true
    },
    {
      id: 'paymentOnBus',
      name: 'Оплата в автобусі',
      checked: true
    },
    {
      id: 'paymentAtOffice',
      name: 'Оплата в бюро',
      checked: true
    },
    {
      id: 'price',
      name: 'Ціна квитка',
      checked: true
    },
    {
      id: 'currency',
      name: 'Валюта',
      checked: false
    },
    {
      id: 'passengerDiscount',
      name: 'Знижка пасажира',
      checked: true
    },
    {
      id: 'discountCardNumber',
      name: 'Дисконтна карта',
      checked: false
    },
    {
      id: 'discount',
      name: 'Акційна знижка',
      checked: false
    },
    {
      id: 'origin',
      name: 'Пункт відправлення',
      checked: true
    },
    {
      id: 'destination',
      name: 'Пункт прибуття',
      checked: false
    },
    {
      id: 'busFlightFrom',
      name: 'Рейс відправлення',
      checked: false
    },
    {
      id: 'busFlightTo',
      name: 'Рейс повернення',
      checked: false
    },
    {
      id: 'dateOfCreature',
      name: 'Дата створення',
      checked: false
    },
    {
      id: 'dateOfDeparture',
      name: 'Дата відправлення',
      checked: true
    },
    {
      id: 'dateOfReturn',
      name: 'Дата повернення',
      checked: false
    },
    {
      id: 'phone',
      name: 'Телефон',
      checked: false
    },
    {
      id: 'additionalPhone',
      name: 'Дод. телефон',
      checked: false
    },
    {
      id: 'email',
      name: 'Email',
      checked: false
    },
    {
      id: 'dateOfBirth',
      name: 'Дата народження',
      checked: true
    },
    {
      id: 'passengerType',
      name: 'Тип пасажира',
      checked: false
    },
    {
      id: 'agent',
      name: 'Агентство',
      checked: false
    },
    {
      id: 'busSeat',
      name: 'Місце',
      checked: false
    },
    {
      id: 'status',
      name: 'Статус',
      checked: false
    },
    {
      id: 'note',
      name: 'Примітка',
      checked: false
    }
  ]
};

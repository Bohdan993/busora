import { useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance
} from 'material-react-table';
import { EditDatepicker } from 'src/components/EditDatepicker';
import { useGetAvailableDatesQuery } from 'src/services/busFlight';

interface AvailableDatesDatepickerProps<TData extends MRT_RowData> {
  cell: MRT_Cell<TData>;
  table: MRT_TableInstance<TData>;
  // 'forwards' = departure leg (origin→destination), 'backwards' = return leg.
  direction: 'forwards' | 'backwards';
  disabled?: boolean;
  textFieldProps?: any;
}

const getId = (value: any): string | undefined =>
  value && typeof value === 'object' ? value.id : undefined;

// Wraps EditDatepicker and restricts the calendar to dates the backend reports
// as available for the row's city pair + direction (GET /bus-flights/available-dates).
export const AvailableDatesDatepicker = <TData extends MRT_RowData>({
  cell,
  table,
  direction,
  disabled = false,
  textFieldProps
}: AvailableDatesDatepickerProps<TData>) => {
  const row = cell.row;
  const cache = (row._valuesCache || {}) as Record<string, any>;
  const original = (row.original || {}) as Record<string, any>;

  const originId = getId(cache.origin) ?? getId(original.origin);
  const destinationId = getId(cache.destination) ?? getId(original.destination);

  // The return leg can't depart before the outbound date.
  const departure = cache.dateOfDeparture ?? original.dateOfDeparture;
  const startDate =
    direction === 'backwards' && departure && dayjs(departure).isValid()
      ? dayjs(departure).format('YYYY-MM-DD')
      : undefined;

  const { data, isFetching, isUninitialized } = useGetAvailableDatesQuery(
    {
      originId: String(originId),
      destinationId: String(destinationId),
      direction,
      startDate
    },
    { skip: !originId || !destinationId }
  );

  const availableSet = useMemo(
    () => new Set((data?.data || []).map((d) => String(d))),
    [data]
  );

  // Only restrict once we actually have a response; while loading / before a
  // city pair is chosen, leave every date selectable.
  const ready =
    !!originId && !!destinationId && !isUninitialized && !isFetching;

  const shouldDisableDate = (day: Dayjs) =>
    ready ? !availableSet.has(dayjs(day).format('YYYY-MM-DD')) : false;

  return (
    <EditDatepicker
      cell={cell}
      table={table}
      disabled={disabled}
      textFieldProps={textFieldProps}
      shouldDisableDate={shouldDisableDate}
    />
  );
};

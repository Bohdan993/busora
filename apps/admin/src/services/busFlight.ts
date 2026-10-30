import { type ApiResponse } from 'src/types/apiResponse';
import { type BusFlight, type BusFlightOption } from 'src/types/busFlights';
import { mainApi } from './index';

const busFlightApiWithTag = mainApi.enhanceEndpoints({
  addTagTypes: ['BusFlight']
});

// Define a service using a base URL and expected endpoints
export const busFlightApi = busFlightApiWithTag.injectEndpoints({
  endpoints: (builder) => ({
    getBusFlights: builder.query<
      ApiResponse<BusFlight[]>,
      {
        start: number;
        size: number;
        filters: string;
        filtersFns: string;
        sorting: string;
      }
    >({
      query: ({ start, size, filters, filtersFns, sorting }) => ({
        url: `/bus-flights?start=${start}&size=${size}&filters=${filters}&filtersFns=${filtersFns}&sorting=${sorting}`
      }),
      providesTags: (result) => {
        return result?.data
          ? [
              ...result?.data.map(({ busFlightId }) => ({
                type: 'BusFlight' as const,
                id: busFlightId
              })),
              { type: 'BusFlight', id: 'LIST' }
            ]
          : [{ type: 'BusFlight', id: 'LIST' }];
      }
    }),
    // Optional originId/destinationId/direction filter flights to those whose
    // route actually connects the city pair in that direction (forwards =
    // departure dropdown, backwards = return dropdown). Omitting them keeps the
    // legacy date-only behavior.
    searchBusFlights: builder.query<
      ApiResponse<BusFlightOption[]>,
      {
        s: string;
        originId?: string | number;
        destinationId?: string | number;
        direction?: 'forwards' | 'backwards';
      }
    >({
      query: ({ s, originId, destinationId, direction }) => {
        const params = new URLSearchParams({ s });
        if (originId != null && originId !== '')
          params.set('originId', String(originId));
        if (destinationId != null && destinationId !== '')
          params.set('destinationId', String(destinationId));
        if (direction) params.set('direction', direction);
        return { url: `/search/bus-flights?${params.toString()}` };
      }
    }),
    // Dates (YYYY-MM-DD) that have at least one flight with free seats for the
    // given city pair + direction — used to restrict the ticket-form date pickers.
    getAvailableDates: builder.query<
      ApiResponse<string[]>,
      {
        originId: string;
        destinationId: string;
        direction: 'forwards' | 'backwards';
        startDate?: string;
      }
    >({
      query: ({ originId, destinationId, direction, startDate }) => ({
        url: `/bus-flights/available-dates?originId=${originId}&destinationId=${destinationId}&direction=${direction}${
          startDate ? `&startDate=${startDate}` : ''
        }`
      }),
      keepUnusedDataFor: 300
    }),
    getBusFlight: builder.query<ApiResponse<BusFlight>, string>({
      query: (id) => ({
        url: `/bus-flights/${id}`
      }),
      providesTags: (result) => [
        { type: 'BusFlight', id: result?.data?.busFlightId }
      ]
    }),
    createBusFlight: builder.mutation<
      ApiResponse<BusFlight>,
      Omit<BusFlight, 'id'>
    >({
      query: (body) => ({
        url: `/bus-flights`,
        method: 'POST',
        body
      }),
      invalidatesTags: [{ type: 'BusFlight', id: 'LIST' }]
    }),
    updateBusFlight: builder.mutation<
      ApiResponse<BusFlight>,
      { body: BusFlight; id: string }
    >({
      query: ({ body, id }) => ({
        url: `/bus-flights/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'BusFlight', id: arg.id }
      ]
    }),
    deleteBusFlight: builder.mutation<
      ApiResponse<Pick<BusFlight, 'busFlightId'>>,
      string
    >({
      query: (id) => ({
        url: `/bus-flights/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'BusFlight', id: arg }]
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const {
  useGetBusFlightQuery,
  useGetBusFlightsQuery,
  useLazySearchBusFlightsQuery,
  useGetAvailableDatesQuery,
  useCreateBusFlightMutation,
  useUpdateBusFlightMutation,
  useDeleteBusFlightMutation
} = busFlightApi;

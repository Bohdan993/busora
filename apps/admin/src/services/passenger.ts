import { type ApiResponse } from 'src/types/apiResponse';
import {
  type Child,
  type Passenger,
  type PassengerOption,
  type ChildTicket,
  type PassengerTicket
} from 'src/types/passengers';
import { type TicketPassenger } from 'src/types/tickets';
// Need to use the React-specific entry point to import createApi
import { mainApi } from './index';

const passengerApiWithTag = mainApi.enhanceEndpoints({
  addTagTypes: ['Passenger']
});

export interface AddPassengerTicket {
  passengerId: string;
  id?: string;
  data: TicketPassenger | null;
}

export const passengerApi = passengerApiWithTag.injectEndpoints({
  //   reducerPath: 'authApi',
  //   tagTypes: ['Auth'],
  endpoints: (builder) => ({
    getPassengers: builder.query<
      ApiResponse<Passenger[]>,
      {
        start: number;
        size: number;
        filters: string;
        filtersFns: string;
        sorting: string;
      }
    >({
      query: ({ start, size, filters, filtersFns, sorting }) => ({
        url: `/passengers?start=${start}&size=${size}&filters=${filters}&filtersFns=${filtersFns}&sorting=${sorting}`
      }),
      providesTags: (result) => {
        return result?.data
          ? [
              ...result?.data.map(({ passengerId }) => ({
                type: 'Passenger' as const,
                id: passengerId
              })),
              { type: 'Passenger', id: 'LIST' }
            ]
          : [{ type: 'Passenger', id: 'LIST' }];
      }
    }),
    getPassenger: builder.query<ApiResponse<Passenger>, string>({
      query: (id) => ({
        url: `/passengers/${id}`
      }),
      providesTags: (result) => [
        { type: 'Passenger', id: result?.data?.passengerId }
      ]
    }),
    createPassenger: builder.mutation<
      ApiResponse<{ passengerId: string }>,
      Omit<Passenger, 'passengerId'> | Omit<Child, 'passengerId'>
    >({
      query: (body) => ({
        url: `/passengers`,
        method: 'POST',
        body
      }),
      invalidatesTags: [{ type: 'Passenger', id: 'LIST' }]
    }),
    addPassengerTicket: builder.mutation<
      ApiResponse<{ passengerId: string }>,
      AddPassengerTicket
    >({
      query: (body) => ({
        url: `/passengers/tickets`,
        method: 'POST',
        body
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Passenger', id: arg.passengerId }
      ]
    }),
    updatePassenger: builder.mutation<
      ApiResponse<{ passengerId: string }>,
      {
        body:
          | Omit<Passenger, 'passengerId'>
          | Omit<PassengerTicket, 'passengerId'>
          | Omit<ChildTicket, 'passengerId'>;
        id: string;
      }
    >({
      query: ({ body, id }) => ({
        url: `/passengers/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Passenger', id: arg.id }
      ]
    }),
    deletePassenger: builder.mutation<
      ApiResponse<{ passengerId: string }>,
      string
    >({
      query: (id) => ({
        url: `/passengers/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Passenger', id: arg }]
    }),
    deletePassengerTicket: builder.mutation<
      ApiResponse<{ passengerId: string }>,
      { passengerId: string; id: string }
    >({
      query: ({ passengerId, id }) => ({
        url: `/passengers/tickets/${passengerId}?ticketId=${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Passenger', id: arg.passengerId }
      ]
    }),
    searchPassengers: builder.query<
      ApiResponse<PassengerOption[]>,
      { s: string }
    >({
      query: ({ s }) => ({
        url: `/search/passengers?s=${s}`
      })
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const {
  useCreatePassengerMutation,
  useDeletePassengerMutation,
  useGetPassengerQuery,
  useGetPassengersQuery,
  useUpdatePassengerMutation,
  useAddPassengerTicketMutation,
  useDeletePassengerTicketMutation,
  useLazySearchPassengersQuery
} = passengerApi;

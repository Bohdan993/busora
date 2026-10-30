import { type ApiResponse } from 'src/types/apiResponse';
import {
  type TicketPassenger,
  type Ticket,
  type TicketAttributes,
  type TicketOption,
  type CreateTicketBody
} from 'src/types/tickets';
// Need to use the React-specific entry point to import createApi
import { mainApi } from './index';
import { type PassengerTicket, type ChildTicket } from 'src/types/passengers';
import $api from 'src/http';

const ticketApiWithTag = mainApi.enhanceEndpoints({
  addTagTypes: ['Ticket' /*, 'Passenger'*/]
});

export interface AddTicketPassenger {
  ticketId: string;
  id?: string;
  // busFlightFromId: string | null;
  // busFlightToId: string | null;
  type: 'adult' | 'child';
  data: ChildTicket | PassengerTicket | null;
}

export interface DownloadTicketParams {
  ticketId: string;
  passengerId?: number | string | null;
  childKey?: string | null;
  filename: string;
}

export const ticketApi = ticketApiWithTag.injectEndpoints({
  //   reducerPath: 'authApi',
  //   tagTypes: ['Auth'],
  endpoints: (builder) => ({
    getTickets: builder.query<
      ApiResponse<Ticket[]>,
      {
        start: number;
        size: number;
        filters: string;
        filtersFns: string;
        sorting: string;
        customSorting?: string;
      }
    >({
      query: ({
        start,
        size,
        filters,
        filtersFns,
        sorting,
        customSorting
      }) => ({
        url: `/tickets?start=${start}&size=${size}&filters=${filters}&filtersFns=${filtersFns}&sorting=${sorting}&customSorting=${
          customSorting ?? '[]'
        }`
      }),
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ ticketId }) => ({
                type: 'Ticket' as const,
                id: ticketId
              })),
              { type: 'Ticket', id: 'LIST' }
            ]
          : [{ type: 'Ticket', id: 'LIST' }]
    }),
    getTicket: builder.query<ApiResponse<Ticket>, string>({
      query: (id) => ({
        url: `/tickets/${id}`
      }),
      providesTags: (result) =>
        result?.data?.ticketId
          ? [{ type: 'Ticket', id: result.data.ticketId }]
          : []
    }),
    getTicketAttributes: builder.query<ApiResponse<TicketAttributes>, void>({
      query: () => ({
        url: `/tickets/attributes`
      }),
      keepUnusedDataFor: 3600
    }),
    createTicket: builder.mutation<
      ApiResponse<{ ticketId: string }>,
      CreateTicketBody
    >({
      query: (body) => ({
        url: `/tickets`,
        method: 'POST',
        body
      }),
      invalidatesTags: [{ type: 'Ticket', id: 'LIST' }]
    }),
    addTicketPassenger: builder.mutation<
      ApiResponse<{ ticketId: string }>,
      AddTicketPassenger
    >({
      query: (body) => ({
        url: `/tickets/passengers`,
        method: 'POST',
        body
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Ticket', id: arg.ticketId }
      ]
    }),
    updateTicket: builder.mutation<
      ApiResponse<{ ticketId: string }>,
      {
        body: Omit<Ticket, 'ticketId'> | Omit<TicketPassenger, 'ticketId'>;
        id: string;
      }
    >({
      query: ({ body, id }) => ({
        url: `/tickets/${id}`,
        method: 'PUT',
        body
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Ticket', id: arg.id }]
    }),
    deleteTicket: builder.mutation<ApiResponse<{ ticketId: string }>, string>({
      query: (id) => ({
        url: `/tickets/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Ticket', id: arg },
        { type: 'Ticket', id: 'LIST' }
      ]
      // onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
      //   try {
      //     const result = await queryFulfilled;
      //     // Handle the result if needed
      //   } catch (error) {
      //     // Handle errors if needed
      //   }
      // },
    }),
    deleteTicketPassenger: builder.mutation<
      ApiResponse<{ ticketId: string }>,
      { type: 'adult' | 'child'; ticketId: string; id: string }
    >({
      query: ({ type, ticketId, id }) => ({
        url: `/tickets/passengers/${ticketId}?passengerId=${id}&type=${type}`,
        method: 'DELETE'
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Ticket', id: arg.ticketId }
      ]
      // onQueryStarted: async (_, { dispatch, queryFulfilled }) => {
      //   try {
      //     const result = await queryFulfilled;
      //     // Handle the result if needed
      //   } catch (error) {
      //     // Handle errors if needed
      //   }
      // },
    }),
    generateTicket: builder.mutation<
      ApiResponse<{ ticketId: string }>,
      // `passengerId` (re)generates only that passenger's PDF; omit it to
      // regenerate every passenger on the ticket.
      { id: string; passengerId?: string }
    >({
      query: (body) => ({
        url: `/tickets/generate-pdf`,
        method: 'POST',
        body
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Ticket', id: arg.id }
        // { type: 'Passenger', id: 'LIST' }
      ]
    }),
    deleteTicketPdf: builder.mutation<
      ApiResponse<{ ticketId: string; deleted: number }>,
      // `passengerId` deletes only that passenger's PDF; omit it to remove
      // every per-passenger PDF plus the ticket-level PDF.
      { id: string; passengerId?: string }
    >({
      query: (body) => ({
        url: `/tickets/delete-pdf`,
        method: 'POST',
        body
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Ticket', id: arg.id }]
    }),
    sendTicket: builder.mutation<
      ApiResponse<{ ticketId: string }>,
      // `passengerId` emails only that passenger's PDF (same value download-pdf
      // uses); omit it to send the ticket-level PDF for all passengers.
      { id: string; email: string; passengerId?: string }
    >({
      query: (body) => ({
        url: `/tickets/send-pdf`,
        method: 'POST',
        body
      })
      // invalidatesTags: (result, error, arg) => [{ type: 'Ticket', id: arg.id }],
    }),
    searchTickets: builder.query<
      ApiResponse<TicketOption[]>,
      { s: string; ticketsIds: string[] }
    >({
      query: ({ s, ticketsIds }) => ({
        url: `/search/tickets?s=${s}&ticketsIds=${encodeURIComponent(
          JSON.stringify(ticketsIds)
        )}`
      })
    }),
    downloadTicket: builder.mutation<void, DownloadTicketParams>({
      queryFn: async ({ ticketId, passengerId, childKey, filename }) => {
        try {
          let url = `/tickets/download-pdf?id=${ticketId}`;
          if (passengerId != null) {
            url += `&passengerId=${passengerId}`;
          }
          if (childKey) {
            url += `&childKey=${childKey}`;
          }

          const response = await $api.get(url, {
            headers: {
              'Content-Type': 'application/json; charset=UTF-8',
              Accept: 'application/pdf'
            },
            responseType: 'blob'
          });

          const blobUrl = window.URL.createObjectURL(response.data);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename || 'file.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);

          return { data: undefined };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      }
    })
  }),
  overrideExisting: false
});

export const {
  useCreateTicketMutation,
  useAddTicketPassengerMutation,
  useDeleteTicketMutation,
  useDeleteTicketPassengerMutation,
  useGetTicketQuery,
  useGetTicketsQuery,
  useGetTicketAttributesQuery,
  useUpdateTicketMutation,
  useGenerateTicketMutation,
  useDeleteTicketPdfMutation,
  useSendTicketMutation,
  useLazySearchTicketsQuery,
  useDownloadTicketMutation
} = ticketApi;

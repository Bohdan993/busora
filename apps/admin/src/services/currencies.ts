import { type ApiResponse } from 'src/types/apiResponse';
import { type Currency } from 'src/types/currencies';
import { mainApi } from './index';

const currencyApiWithTag = mainApi.enhanceEndpoints({
  addTagTypes: ['Currency']
});

// Define a service using a base URL and expected endpoints
export const currencyApi = currencyApiWithTag.injectEndpoints({
  endpoints: (builder) => ({
    getCurrencies: builder.query<ApiResponse<Currency[]>, void>({
      query: () => ({
        url: `/currencies`
      }),
      providesTags: (result) => {
        return result?.data
          ? [
              ...result?.data.map(({ id }) => ({
                type: 'Currency' as const,
                id
              })),
              { type: 'Currency', id: 'LIST' }
            ]
          : [{ type: 'Currency', id: 'LIST' }];
      }
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetCurrenciesQuery } = currencyApi;

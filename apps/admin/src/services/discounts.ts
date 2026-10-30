import { type ApiResponse } from 'src/types/apiResponse';
import { type Discount } from 'src/types/discounts';
import { mainApi } from './index';

const discountApiWithTag = mainApi.enhanceEndpoints({
  addTagTypes: ['Discount']
});

// Define a service using a base URL and expected endpoints
export const discountApi = discountApiWithTag.injectEndpoints({
  endpoints: (builder) => ({
    getDiscounts: builder.query<ApiResponse<Discount[]>, void>({
      query: () => ({
        url: `/discounts`
      }),
      providesTags: (result) => {
        return result?.data
          ? [
              ...result?.data.map(({ id }) => ({
                type: 'Discount' as const,
                id
              })),
              { type: 'Discount', id: 'LIST' }
            ]
          : [{ type: 'Discount', id: 'LIST' }];
      }
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetDiscountsQuery } = discountApi;

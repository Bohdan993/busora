import { type ApiResponse } from 'src/types/apiResponse';
import { type City } from 'src/types/cities';
import { mainApi } from './index';

const cityApiWithTag = mainApi.enhanceEndpoints({ addTagTypes: ['City'] });

// Define a service using a base URL and expected endpoints
export const cityApi = cityApiWithTag.injectEndpoints({
  endpoints: (builder) => ({
    getCities: builder.query<ApiResponse<City[]>, void>({
      query: () => ({
        url: `/cities`
      }),
      providesTags: (result) => {
        return result?.data
          ? [
              ...result?.data.map(({ id }) => ({ type: 'City' as const, id })),
              { type: 'City', id: 'LIST' }
            ]
          : [{ type: 'City', id: 'LIST' }];
      }
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetCitiesQuery } = cityApi;

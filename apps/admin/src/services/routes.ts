import { type ApiResponse } from 'src/types/apiResponse';
import { type Route } from 'src/types/routes';
import { mainApi } from './index';

const routeApiWithTag = mainApi.enhanceEndpoints({ addTagTypes: ['Route'] });

// Define a service using a base URL and expected endpoints
export const routeApi = routeApiWithTag.injectEndpoints({
  endpoints: (builder) => ({
    getRoutes: builder.query<ApiResponse<Route[]>, void>({
      query: () => ({
        url: `/routes`
      })
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetRoutesQuery } = routeApi;

// export const { endpoints } = routeApi;

import { type ApiResponse } from 'src/types/apiResponse';
import { type AuthResponse, type AuthRequest } from 'src/types/auth';
import { mainApi, API_URL } from './index';

// Define a service using a base URL and expected endpoints
export const authApi = mainApi.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<ApiResponse<AuthResponse>, AuthRequest>({
      query: (body) => ({
        url: `/auth/register`,
        method: 'POST',
        body
      })
    }),
    login: builder.mutation<ApiResponse<AuthResponse>, AuthRequest>({
      query: (body) => ({
        url: `/auth/login`,
        method: 'POST',
        body
      })
    }),
    logout: builder.query<ApiResponse, void>({
      query: () => ({
        url: `/auth/logout`
      })
    }),
    checkAuth: builder.query<ApiResponse<AuthResponse>, void>({
      queryFn: async () => {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          const data = await response.json();
          return data;
        } catch (error) {
          // Catch any errors and return them as an object with an `error` field
          return { error };
        }
      }
    })
  }),
  overrideExisting: false
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const {
  useLoginMutation,
  useLogoutQuery,
  useLazyLogoutQuery,
  useRegisterMutation,
  useCheckAuthQuery,
  useLazyCheckAuthQuery
} = authApi;

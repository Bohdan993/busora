import { type AuthResponse } from 'src/types/auth';
import { type ApiResponse } from 'src/types/apiResponse';
// Or from '@reduxjs/toolkit/query' if not using the auto-generated hooks
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
// API base URL. Defaults to the local dev backend; set REACT_APP_API_URL at
// build time for other environments (CRA inlines it). See .env.example.
export const API_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api/admin';
// initialize an empty api service that we'll inject endpoints into later as needed
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError
} from '@reduxjs/toolkit/query';
import { setAuth, setUser } from 'src/slices/userSlice';
import { Mutex } from 'async-mutex';
import { type User } from 'src/types/users';

const mutex = new Mutex();
const baseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers) => {
    const accessToken = JSON.parse(localStorage.getItem('token') || '""');

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return headers;
  },
  credentials: 'include'
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  // wait until the mutex is available without locking it
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);
  if (result.error && result.error.status === 401) {
    // checking whether the mutex is locked
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const refreshResult = await baseQuery(
          '/auth/refresh',
          api,
          extraOptions
        );
        if (refreshResult.data) {
          localStorage.setItem(
            'token',
            JSON.stringify(
              (refreshResult.data as unknown as ApiResponse<AuthResponse>)?.data
                ?.accessToken
            )
          );
          api.dispatch(setAuth(true));
          api.dispatch(
            setUser(
              (refreshResult.data as unknown as ApiResponse<AuthResponse>)?.data
                ?.user || ({} as User)
            )
          );
          //retry the initial query
          result = await baseQuery(args, api, extraOptions);
        } else {
          localStorage.removeItem('token');
          api.dispatch(setAuth(false));
          api.dispatch(setUser({} as User));
          //TODO: check if current route is not /login
          window?.location.replace(
            `/login?redirect=${window.location.pathname}`
          );
        }
      } finally {
        // release must be called once the mutex should be released again.
        release();
      }
    } else {
      // wait until the mutex is available without locking it
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }

  if (
    result.error &&
    result.error.status === 403 &&
    (result.error.data as any)?.error?.includes('Користувача заблоковано')
  ) {
    // checking whether the mutex is locked
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        localStorage.removeItem('token');
        api.dispatch(setAuth(false));
        api.dispatch(setUser({} as User));
        window?.location.replace(`/login?redirect=${window.location.pathname}`);
      } finally {
        // release must be called once the mutex should be released again.
        release();
      }
    } else {
      // wait until the mutex is available without locking it
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }
  return result;
};

export const mainApi = createApi({
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
  keepUnusedDataFor: 30,
  refetchOnFocus: true,
  refetchOnReconnect: true
});

export const { endpoints } = mainApi;

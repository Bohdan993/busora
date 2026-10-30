import axios from 'axios';
import { setAuth, setUser } from 'src/slices/userSlice';
import { API_URL } from 'src/services/index';
import { store } from 'src/store';
import { type AuthResponse } from 'src/types/auth';
import { type ApiResponse } from 'src/types/apiResponse';
import { type User } from 'src/types/users';

const $api = axios.create({
  withCredentials: true,
  baseURL: API_URL
});

$api.interceptors.request.use((config) => {
  const accessToken = JSON.parse(localStorage.getItem('token') || '""');
  config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

$api.interceptors.response.use(
  (config) => {
    return config;
  },
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response.status === 401 &&
      error.config &&
      !error.config._isRetry
    ) {
      originalRequest._isRetry = true;
      try {
        const refreshResult = await axios.get<ApiResponse<AuthResponse>>(
          `${API_URL}/auth/refresh`,
          { withCredentials: true }
        );
        localStorage.setItem(
          'token',
          JSON.stringify(
            (refreshResult.data as unknown as ApiResponse<AuthResponse>)?.data
              ?.accessToken
          )
        );
        store.dispatch(setAuth(true));
        store.dispatch(
          setUser(
            (refreshResult.data as unknown as ApiResponse<AuthResponse>)?.data
              ?.user || ({} as User)
          )
        );
        //retry the initial query
        return await $api.request(originalRequest);
      } catch (err) {
        localStorage.removeItem('token');
        store.dispatch(setAuth(false));
        store.dispatch(setUser({} as User));
        window?.location.replace(`/login?redirect=${window.location.pathname}`);
        return;
      }
    }

    if (
      error.response.status === 403 &&
      (error.response.data as any)?.error?.includes(
        'Користувача заблоковано'
      ) &&
      error.config &&
      !error.config._isRetry
    ) {
      originalRequest._isRetry = true;
      localStorage.removeItem('token');
      store.dispatch(setAuth(false));
      store.dispatch(setUser({} as User));
      window?.location.replace(`/login?redirect=${window.location.pathname}`);
      return;
    }

    throw error;
  }
);

export default $api;

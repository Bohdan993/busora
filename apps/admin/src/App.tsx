import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useLocation, useNavigate, useRoutes } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { CssBaseline } from '@mui/material';
import { useEffect } from 'react';
import { useLazyCheckAuthQuery } from 'src/services/auth';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { setAuth, setUser } from 'src/slices/userSlice';
import { selectIsLoading, setLoading } from 'src/slices/appSlice';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import SuspenseLoader from 'src/components/SuspenseLoader';
import ThemeProvider from 'src/theme/ThemeProvider';
import router from 'src/router';
import 'dayjs/locale/uk';

import { type User } from 'src/types/users';
import { type AuthResponse } from 'src/types/auth';

dayjs.extend(utc);

function App() {
  const content = useRoutes(router);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectIsLoading);
  const [check, { data: loginData, isSuccess, isError, isFetching }] =
    useLazyCheckAuthQuery({
      refetchOnFocus: false,
      refetchOnReconnect: false
    });

  useEffect(() => {
    async function start() {
      dispatch(setLoading(true));
      await check();
    }
    start();
  }, []);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      if (isSuccess) {
        localStorage.setItem(
          'token',
          JSON.stringify((loginData as unknown as AuthResponse)?.accessToken)
        );
        if ((loginData as unknown as AuthResponse).user) {
          dispatch(setAuth(true));
          dispatch(setUser((loginData as unknown as AuthResponse).user));
          dispatch(setLoading(false));
        }
      }
    } else {
      if (location.pathname !== '/login') {
        navigate('/login');
      }
      dispatch(setLoading(false));
    }
  }, [isSuccess]);

  useEffect(() => {
    if (isError && !isFetching) {
      localStorage.removeItem('token');
      dispatch(setAuth(false));
      dispatch(setUser({} as User));
      dispatch(setLoading(false));
      if (location.pathname !== '/login') {
        navigate('/login');
      }
    }
  }, [isError, isFetching]);

  if (isLoading) {
    return <SuspenseLoader />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="uk">
          <CssBaseline />
          {content}
        </LocalizationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;

import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLoginMutation } from 'src/services/auth';
import { Link as RouterLink, useNavigate, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { setUser, setAuth } from 'src/slices/userSlice';
import { useAppDispatch } from 'src/store/hooks';
import { selectIsAuth } from 'src/slices/userSlice';
import { useAppSelector } from 'src/store/hooks';

function Copyright(props: any) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      {'Copyright © '}
      <Link color="inherit" href="https://busreisen.com.ua">
        Busreisen
      </Link>{' '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const validationSchema = z.object({
  email: z
    .string({ required_error: "Поле обов'язкове" })
    .min(1, { message: "Поле обов'язкове" })
    .email({ message: 'Некоректний Email' }),
  password: z
    .string({ required_error: "Поле обов'язкове" })
    .min(1, { message: "Поле обов'язкове" })
    .min(6, { message: 'Пароль має бути мінімум 6 символів' })
    .max(32, { message: 'Пароль має бути максимум 32 символи' })
});

type ValidationSchema = z.infer<typeof validationSchema>;

// TODO remove, this demo shouldn't need to reset the theme.
const defaultTheme = createTheme();

export default function SignIn() {
  // const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuth);
  // let redirect = (location.state as LocationState)?.redirect;
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ValidationSchema>({
    resolver: zodResolver(validationSchema)
  });
  const [login, loginResult] = useLoginMutation();
  const { isError, isSuccess, isLoading, error, data: loginData } = loginResult;
  const onSubmit: SubmitHandler<ValidationSchema> = async (data) => {
    await login(data);
  };

  useEffect(() => {
    if (isSuccess) {
      localStorage.setItem(
        'token',
        JSON.stringify(loginData?.data?.accessToken)
      );
      if (loginData.data?.user) {
        dispatch(setAuth(true));
        dispatch(setUser(loginData.data?.user));
      }
      navigate('/home');
    }
  }, [isSuccess]);

  if (isAuthenticated) {
    return (
      <Navigate
        to="/home"
        replace
        // state={{redirect}}
      />
    );
  }

  return (
    <ThemeProvider theme={defaultTheme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {isError &&
            ('status' in error ? (
              <Alert severity="error">
                {'error' in error ? (
                  <>
                    <AlertTitle>{error.error}</AlertTitle>
                  </>
                ) : error.data &&
                  'status' in (error.data as any) &&
                  'error' in (error.data as any) ? (
                  <>
                    <AlertTitle>{(error.data as any).status}</AlertTitle>
                    {(error.data as any)?.error?.map(
                      (el: string, ind: number) => {
                        return <p key={ind}>{el}</p>;
                      }
                    )}
                  </>
                ) : (
                  <>
                    <p>{JSON.stringify(error.data)}</p>
                  </>
                )}
              </Alert>
            ) : (
              <Alert severity="error">
                <AlertTitle>{error.message}</AlertTitle>
              </Alert>
            ))}
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Вхід
          </Typography>
          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ mt: 1, width: '100%' }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              autoComplete="email"
              autoFocus
              {...register('email')}
            />
            {errors.email && (
              <p
                style={{
                  color: 'red',
                  fontSize: '12px',
                  marginTop: 0
                }}
              >
                {' '}
                {errors.email?.message}
              </p>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              label="Пароль"
              type="password"
              id="password"
              {...register('password')}
            />
            {errors.password && (
              <p
                style={{
                  color: 'red',
                  fontSize: '12px',
                  marginTop: 0
                }}
              >
                {' '}
                {errors.password?.message}
              </p>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Вхід
            </Button>
            <Grid container>
              <Grid item xs>
                <Link href="#" variant="body2">
                  Забули пароль?
                </Link>
              </Grid>
              <Grid item>
                <Link variant="body2" component={RouterLink} to="/registration">
                  {'Реєстрація'}
                </Link>
              </Grid>
            </Grid>
          </Box>
        </Box>
        <Copyright sx={{ mt: 8, mb: 4 }} />
      </Container>
    </ThemeProvider>
  );
}

import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useRegisterMutation } from 'src/services/auth';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { selectIsAuth } from 'src/slices/userSlice';
import { useAppSelector } from 'src/store/hooks';
import { useEffect } from 'react';

function Copyright(props: any) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      align="center"
      {...props}
    >
      {'Copyright © '}
      {'Busora '}
      {new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}

const validationSchema = z
  .object({
    name: z
      .string({ required_error: "Поле обов'язкове" })
      .min(1, { message: "Поле обов'язкове" })
      .min(2, { message: "Ім'я має бути мінімум 2 символи" })
      .max(30, { message: "Ім'я має бути максимум 30 символів" }),
    email: z
      .string({ required_error: "Поле обов'язкове" })
      .min(1, { message: "Поле обов'язкове" })
      .email({ message: 'Некоректний Email' }),
    password: z
      .string({ required_error: "Поле обов'язкове" })
      .min(1, { message: "Поле обов'язкове" })
      .min(6, { message: 'Пароль має бути мінімум 6 символів' })
      .max(32, { message: 'Пароль має бути максимум 32 символи' }),
    passwordConfirm: z
      .string({ required_error: "Поле обов'язкове" })
      .min(1, { message: "Поле обов'язкове" })
      .min(6, { message: 'Пароль має бути мінімум 6 символів' })
      .max(32, { message: 'Пароль має бути максимум 32 символи' })
  })
  .superRefine(({ passwordConfirm, password }, ctx) => {
    if (passwordConfirm !== password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Паролі не співпадають',
        path: ['passwordConfirm']
      });
    }
  });

type ValidationSchema = z.infer<typeof validationSchema>;

// TODO remove, this demo shouldn't need to reset the theme.
const defaultTheme = createTheme();

export default function SignIn() {
  const isAuthenticated = useAppSelector(selectIsAuth);
  const [registration, registrationResult] = useRegisterMutation();
  const {
    isError,
    isSuccess,
    isLoading,
    error,
    data: registrationData
  } = registrationResult;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ValidationSchema>({
    resolver: zodResolver(validationSchema)
  });

  const onSubmit: SubmitHandler<ValidationSchema> = async (data) => {
    await registration(data);
  };

  useEffect(() => {
    if (isSuccess) {
      reset();
    }
  }, [isSuccess]);

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
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
          {isSuccess &&
            ('status' in registrationData ? (
              <Alert severity="success">
                {'data' in registrationData ? (
                  <>
                    <AlertTitle>Дякуємо за реєстрацію!</AlertTitle>
                    <p>
                      Посилання для активації акаунту надіслано на Emai адресу{' '}
                      <strong>{registrationData.data?.user.email}</strong>
                    </p>
                  </>
                ) : (
                  <Alert severity="error">
                    <AlertTitle>Помилка</AlertTitle>
                    <p>Щось пішло не так. Сробуйте, будь ласка, ще раз.</p>
                  </Alert>
                )}
              </Alert>
            ) : (
              <Alert severity="error">
                <AlertTitle>Помилка</AlertTitle>
                <p>Щось пішло не так. Сробуйте, будь ласка, ще раз.</p>
              </Alert>
            ))}
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
          <Avatar
            alt="Busora"
            src={`${process.env.PUBLIC_URL}/static/images/logo/logo_busora.png`}
            sx={{ m: 1, width: 56, height: 56 }}
          />
          <Typography component="h1" variant="h5">
            Реєстрація
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
              id="name"
              label="Ім'я"
              autoComplete="name"
              autoFocus={true}
              {...register('name')}
            />
            {errors.name && (
              <p
                style={{
                  color: 'red',
                  fontSize: '12px',
                  marginTop: 0
                }}
              >
                {' '}
                {errors.name?.message}
              </p>
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              autoComplete="email"
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
            <TextField
              margin="normal"
              required
              fullWidth
              label="Підтвердіть пароль"
              type="password"
              id="passwordConfirm"
              {...register('passwordConfirm')}
            />
            {errors.passwordConfirm && (
              <p
                style={{
                  color: 'red',
                  fontSize: '12px',
                  marginTop: 0
                }}
              >
                {' '}
                {errors.passwordConfirm?.message}
              </p>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Зареєструватися
            </Button>
            <Grid container>
              <Grid item>
                <Link variant="body2" component={RouterLink} to="/login">
                  {'Уже зареєстровані? Увійти'}
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

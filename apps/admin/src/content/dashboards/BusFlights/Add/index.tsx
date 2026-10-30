import { Helmet } from 'react-helmet-async';
import PageHeader from './PageHeader';
import PageTitleWrapper from 'src/components/PageTitleWrapper';
import {
  Grid,
  Container,
  Box,
  TextField,
  Card,
  CardHeader,
  CardContent,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Footer from 'src/components/Footer';

import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zodInputStringPipe } from 'src/helpers';
import { useCreateBusFlightMutation } from 'src/services/busFlight';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useGetRoutesQuery } from 'src/services/routes';
import SuspenseLoader from 'src/components/SuspenseLoader';
import { type BusFlight } from 'src/types/busFlights';
import { CustomSelect } from 'src/components/CustomSelect';
import dayjs, { type Dayjs } from 'dayjs';

const validationSchema = z
  .object({
    allSeats: zodInputStringPipe(
      z
        .number({ required_error: "Поле обов'язкове" })
        .min(0, { message: "Поле обов'язкове" })
        .nonnegative({ message: "Поле має бути невід'ємним числом" })
        .int({ message: 'Поле має бути цілим числом' })
    ),
    freeSeats: zodInputStringPipe(
      z
        .number({ required_error: "Поле обов'язкове" })
        .min(0, { message: "Поле обов'язкове" })
        .nonnegative({ message: "Поле має бути невід'ємним числом" })
        .int({ message: 'Поле має бути цілим числом' })
    ),
    routeId: z
      .object(
        {
          groupBy: z.string(),
          id: z.string({ required_error: "Поле обов'язкове" }),
          label: z.string()
        },
        {
          invalid_type_error: "Поле обов'язкове",
          required_error: "Поле обов'язкове"
        }
      )
      .transform((val) => String(val.id))
      .pipe(
        z.string({ required_error: "Поле обов'язкове" })
        /*.min(0, {message: "Поле обов'язкове"})
      .nonnegative({message: "Поле має бути невід'ємним числом"})
      .int({message: "Поле має бути цілим числом"})*/
      ),
    dateOfDeparture: z.custom<Dayjs>(
      (val) => val instanceof dayjs && dayjs(val as any).isValid(),
      'Некоректна дата'
    ),
    discount: zodInputStringPipe(
      z
        .number({ required_error: "Поле обов'язкове" })
        .nonnegative({ message: "Поле має бути невід'ємним числом" })
        .int({ message: 'Поле має бути цілим числом' })
        .lte(100, { message: 'Поле має бути менше або рівне 100' })
    )
  })
  .required();

type ValidationSchema = z.infer<typeof validationSchema>;

function DashboardsBusFlightsEdit() {
  const { id } = useParams();
  const [inputValue, setInputValue] = useState('');
  const [createBusFlight, busFlightResult] = useCreateBusFlightMutation();
  const { isError, isSuccess, isLoading, error } = busFlightResult;
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const {
    data: routesData,
    isLoading: routesIsLoading,
    isSuccess: routesIsSuccess,
    isError: routesIsError,
    isFetching: routesIsFetching,
    error: routesError
  } = useGetRoutesQuery();

  const navigate = useNavigate();
  const { register, control, handleSubmit, formState, getValues } =
    useForm<ValidationSchema>({
      resolver: zodResolver(validationSchema)
    });

  const onSubmit: SubmitHandler<ValidationSchema> = async (data) => {
    const newData = {
      ...data,
      dateOfDeparture: dayjs(data?.dateOfDeparture).format('YYYY-MM-DD')
    };
    await createBusFlight(newData as Omit<BusFlight, 'id'>);
  };

  useEffect(() => {
    if (isSuccess) {
      navigate(
        `${
          params.get('redirect')
            ? decodeURIComponent(params.get('redirect') || '')
            : '/dashboards/bus-flights'
        }`,
        {
          state: {
            notification: `Рейс успішно створено!`,
            notificationSeverity: 'success'
          }
        }
      );
    }
  }, [isSuccess]);

  useEffect(() => {
    if (isError) {
      navigate(
        `${
          params.get('redirect')
            ? decodeURIComponent(params.get('redirect') || '')
            : '/dashboards/bus-flights'
        }`,
        {
          state: {
            notification: `Виникла помилка при створенні рейсу! ${JSON.stringify(
              error,
              null,
              2
            )}`,
            notificationSeverity: 'error'
          }
        }
      );
    }
  }, [isError]);

  if (routesIsLoading) {
    return <SuspenseLoader />;
  }

  return (
    <>
      <Helmet>
        <title>Сторінка додавання рейсу</title>
      </Helmet>
      <PageTitleWrapper>
        <PageHeader />
      </PageTitleWrapper>
      <Container
        maxWidth="lg"
        id="bus-flight-add-form"
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <Grid
          container
          direction="row"
          justifyContent="center"
          alignItems="stretch"
          spacing={3}
        >
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Поля рейсу" />
              <Divider />
              <CardContent>
                <Box
                  sx={{
                    '& .MuiTextField-root': { m: 1, width: '31ch' }
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column'
                      }}
                    >
                      <TextField
                        required
                        type="number"
                        id="allSeats"
                        label="Кількість місць"
                        InputProps={{
                          inputProps: { min: 0 }
                        }}
                        {...register('allSeats')}
                      />
                      {formState.errors.allSeats && (
                        <p
                          style={{
                            color: 'red',
                            fontSize: '12px',
                            margin: '9px',
                            marginTop: 0,
                            width: '31ch'
                          }}
                        >
                          {' '}
                          {formState.errors.allSeats?.message}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column'
                      }}
                    >
                      <TextField
                        required
                        type="number"
                        id="freeSeats"
                        label="Кількість вільних місць"
                        InputProps={{
                          inputProps: { min: 0 }
                        }}
                        {...register('freeSeats')}
                      />
                      {formState.errors.freeSeats && (
                        <p
                          style={{
                            color: 'red',
                            fontSize: '12px',
                            margin: '9px',
                            marginTop: 0,
                            width: '31ch'
                          }}
                        >
                          {' '}
                          {formState.errors.freeSeats?.message}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Controller
                        control={control}
                        defaultValue={''}
                        render={({ field: { onChange, ...props } }) => (
                          <CustomSelect
                            options={[
                              ...(routesData?.data ?? [
                                {
                                  id: '1',
                                  label: 'test',
                                  groupBy: 'test',
                                  countryId: '1'
                                },
                                {
                                  id: '2',
                                  label: 'test',
                                  groupBy: 'test',
                                  countryId: '2'
                                }
                              ])
                            ].sort(
                              (a, b) => -b.groupBy.localeCompare(a.groupBy)
                            )}
                            groupBy={(option) => option.groupBy}
                            label={'Маршрут'}
                            onChange={(data) => onChange(data)}
                            inputValue={inputValue}
                            onInputChange={(_, newInputValue) => {
                              setInputValue(newInputValue);
                            }}
                            {...props}
                          />
                        )}
                        name="routeId"
                      />
                      {formState.errors.routeId && (
                        <p
                          style={{
                            color: 'red',
                            fontSize: '12px',
                            margin: '9px',
                            marginTop: 0,
                            width: '31ch'
                          }}
                        >
                          {' '}
                          {formState.errors.routeId?.message}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column'
                      }}
                    >
                      <Controller
                        defaultValue={dayjs('')}
                        control={control}
                        render={({
                          field: { onChange, value, ref, ...props }
                        }) => {
                          return (
                            <DatePicker
                              label="Дата відправлення"
                              value={
                                dayjs(value).isValid() ? dayjs(value) : null
                              }
                              format={'DD-MM-YYYY'}
                              onChange={onChange}
                              inputRef={ref}
                              {...props}
                            />
                          );
                        }}
                        name="dateOfDeparture"
                      />
                      {formState.errors.dateOfDeparture && (
                        <p
                          style={{
                            color: 'red',
                            fontSize: '12px',
                            margin: '9px',
                            marginTop: 0,
                            width: '31ch'
                          }}
                        >
                          {' '}
                          {formState.errors.dateOfDeparture?.message}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        flexDirection: 'column'
                      }}
                    >
                      <TextField
                        type="number"
                        id="discount"
                        label="Знижка, %"
                        InputProps={{
                          inputProps: { min: 0 }
                        }}
                        defaultValue={'0'}
                        {...register('discount')}
                      />
                      {formState.errors.discount && (
                        <p
                          style={{
                            color: 'red',
                            fontSize: '12px',
                            margin: '9px',
                            marginTop: 0,
                            width: '31ch'
                          }}
                        >
                          {' '}
                          {formState.errors.discount?.message}
                        </p>
                      )}
                    </div>
                  </div>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}></Grid>
        </Grid>
      </Container>
      <Footer />
    </>
  );
}

export default DashboardsBusFlightsEdit;

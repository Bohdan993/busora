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
import Footer from 'src/components/Footer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { zodInputStringPipe } from 'src/helpers';
import {
  useGetBusFlightQuery,
  useUpdateBusFlightMutation
} from 'src/services/busFlight';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGetRoutesQuery } from 'src/services/routes';
import SuspenseLoader from 'src/components/SuspenseLoader';
import { type BusFlight } from 'src/types/busFlights';
import dayjs, { type Dayjs } from 'dayjs';
import { CustomSelect } from 'src/components/CustomSelect';

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
  const [serverError, setServerError] = useState<null | string>(null);
  const [inputValue, setInputValue] = useState('');
  const [updateBusFlight, busFlightResult] = useUpdateBusFlightMutation();
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

  const {
    data: busFlightData,
    isLoading: busFlightIsLoading,
    isSuccess: busFlightIsSuccess,
    isError: busFlightIsError,
    isFetching: busFlightIsFetching,
    error: busFlightError
  } = useGetBusFlightQuery(String(id));

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
    await updateBusFlight({ body: newData as BusFlight, id: String(id) });
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
            notification: `Рейс з id ${id} успішно відредаговано!`,
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
            notification: `Виникла помилка при редагуванні рейсу з id ${id}! ${JSON.stringify(
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

  useEffect(() => {
    if (busFlightError && 'status' in busFlightError) {
      setServerError(String(busFlightError.status));
      return;
    }

    if (routesError && 'status' in routesError) {
      setServerError(String(routesError.status));
      return;
    }
  }, [busFlightError, routesError]);

  if (serverError) {
    throw new Error(serverError);
  }

  if (routesIsLoading || busFlightIsLoading) {
    return <SuspenseLoader />;
  }

  return (
    <>
      <Helmet>
        <title>Сторінка редагування рейсу</title>
      </Helmet>
      <PageTitleWrapper>
        <PageHeader />
      </PageTitleWrapper>
      <Container
        maxWidth="lg"
        id="bus-flight-edit-form"
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
                        defaultValue={busFlightData?.data?.allSeats || '0'}
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
                        defaultValue={busFlightData?.data?.freeSeats || '0'}
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
                        defaultValue={
                          {
                            id: String(busFlightData?.data?.route?.id) ?? 0,
                            label:
                              String(busFlightData?.data?.route?.label) ??
                              'test',
                            groupBy:
                              String(busFlightData?.data?.route?.groupBy) ??
                              'test'
                          } as any
                        }
                        control={control}
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
                            // defaultValue={{
                            //   id: String(busFlightData?.data?.route?.id) ?? "0",
                            //   label: String(busFlightData?.data?.route?.label) ?? "test",
                            //   groupBy: String(busFlightData?.data?.route?.groupBy) ?? "test",
                            // }}
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
                        defaultValue={dayjs(
                          busFlightData?.data?.dateOfDeparture || ''
                        )}
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
                        defaultValue={
                          (busFlightData?.data?.discount as number | string) ===
                          'Без знижки'
                            ? '0'
                            : busFlightData?.data?.discount
                        }
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

import { Typography, Button, Grid } from '@mui/material';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useDeleteBusFlightMutation } from 'src/services/busFlight';
import { useEffect } from 'react';

function PageHeader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [deleteFn, deleteResult] = useDeleteBusFlightMutation();
  const {
    isError: deleteIsError,
    isSuccess: deleteIsSuccess,
    isLoading: deleteIsLoading,
    error: deleteError,
    data: deleteData
  } = deleteResult;

  // useEffect(()=>{
  //     if(currId) {

  //     }
  //   }, [currId]);

  const handleDelete = () => {
    async function deleteBusFlight() {
      if (window.confirm(`Ви впевнені, що хочете видалити рейс з id ${id}?`)) {
        await deleteFn(String(id) || '0');
      }
    }
    deleteBusFlight();
  };

  useEffect(() => {
    if (deleteIsSuccess) {
      navigate(
        `${
          params.get('redirect')
            ? decodeURIComponent(params.get('redirect') || '')
            : '/dashboards/bus-flights'
        }`,
        {
          state: {
            notification: `Рейс з id ${id} успішно видалено!`,
            notificationSeverity: 'success'
          }
        }
      );
    }
  }, [deleteIsSuccess]);

  useEffect(() => {
    if (deleteIsError) {
      navigate(
        `${
          params.get('redirect')
            ? decodeURIComponent(params.get('redirect') || '')
            : '/dashboards/bus-flights'
        }`,
        {
          state: {
            notification: `Виникла помилка при видаленні рейсу з id ${id}! ${JSON.stringify(
              deleteError,
              null,
              2
            )}`,
            notificationSeverity: 'error'
          }
        }
      );
    }
  }, [deleteIsError]);

  return (
    <Grid container justifyContent="space-between" alignItems="center">
      <Grid item>
        <Typography variant="h3" component="h3" gutterBottom>
          Редагувати рейс з id {id}
        </Typography>
      </Grid>
      <Grid item>
        <Button
          sx={{ mt: { xs: 2, md: 0 }, mr: 2 }}
          variant="contained"
          startIcon={<ArrowBackIosIcon fontSize="small" />}
          component={NavLink}
          color="info"
          to={`${
            params.get('redirect')
              ? decodeURIComponent(params.get('redirect') || '')
              : '/dashboards/bus-flights'
          }`}
        >
          Назад
        </Button>
        <Button
          sx={{ mt: { xs: 2, md: 0 }, mr: 2 }}
          variant="contained"
          startIcon={<SaveIcon fontSize="small" />}
          type="submit"
          form="bus-flight-edit-form"
        >
          Зберегти
        </Button>
        <Button
          sx={{ mt: { xs: 2, md: 0 } }}
          variant="contained"
          startIcon={<DeleteForeverIcon fontSize="small" />}
          color="error"
          onClick={(e) => handleDelete()}
        >
          Видалити
        </Button>
      </Grid>
    </Grid>
  );
}

export default PageHeader;

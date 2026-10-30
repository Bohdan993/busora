import { Typography, Button, Grid } from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
// import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

function PageHeader() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  return (
    <Grid container justifyContent="space-between" alignItems="center">
      <Grid item>
        <Typography variant="h3" component="h3" gutterBottom>
          Додати рейс
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
          form="bus-flight-add-form"
        >
          Зберегти
        </Button>
      </Grid>
    </Grid>
  );
}

export default PageHeader;

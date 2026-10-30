import { Typography, Button, Grid } from '@mui/material';
import { NavLink, useLocation } from 'react-router-dom';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import { useAppSelector } from 'src/store/hooks';
import { selectUser } from 'src/slices/userSlice';

function PageHeader() {
  const user = useAppSelector(selectUser);
  const location = useLocation();
  // const user = {
  //   name: 'Catherine Pike',
  //   avatar: '/static/images/avatars/1.jpg'
  // };
  return (
    <Grid container justifyContent="space-between" alignItems="center">
      <Grid item>
        <Typography variant="h3" component="h3" gutterBottom>
          Рейси
        </Typography>
        <Typography variant="subtitle2">
          {user?.name!}, тут відображатимуться рейси
        </Typography>
      </Grid>
      <Grid item>
        <Button
          sx={{ mt: { xs: 2, md: 0 } }}
          variant="contained"
          startIcon={<AddTwoToneIcon fontSize="small" />}
          component={NavLink}
          to={`/dashboards/bus-flights/add?redirect=${encodeURIComponent(
            location.pathname + location.search
          )}`}
        >
          Додати рейс
        </Button>
      </Grid>
    </Grid>
  );
}

export default PageHeader;

import { Typography, Grid } from '@mui/material';

import { useAppSelector } from 'src/store/hooks';
import { selectUser } from 'src/slices/userSlice';

function PageHeader() {
  const user = useAppSelector(selectUser);
  // const user = {
  //   name: 'Catherine Pike',
  //   avatar: '/static/images/avatars/1.jpg'
  // };
  return (
    <Grid container justifyContent="space-between" alignItems="center">
      <Grid item>
        <Typography variant="h3" component="h3" gutterBottom>
          Квитки
        </Typography>
        <Typography variant="subtitle2">
          {user?.name!}, тут відображатимуться квитки
        </Typography>
      </Grid>
      {/* <Grid item>
        <Button
          sx={{ mt: { xs: 2, md: 0 } }}
          variant="contained"
          startIcon={<AddTwoToneIcon fontSize="small" />}
          component={NavLink}
          to="/dashboards/tickets/add"
        >
          Додати квиток
        </Button>
      </Grid> */}
    </Grid>
  );
}

export default PageHeader;

import { Typography } from '@mui/material';
import { useAppSelector } from 'src/store/hooks';
import { selectUser } from 'src/slices/userSlice';

function PageHeader() {
  const user = useAppSelector(selectUser);
  // const user = {
  //   name: 'Catherine Pike',
  //   avatar: '/static/images/avatars/1.jpg'
  // };

  return (
    <>
      <Typography variant="h3" component="h3" gutterBottom>
        User Settings
      </Typography>
      <Typography variant="subtitle2">
        {user?.name}, this could be your user settings panel.
      </Typography>
    </>
  );
}

export default PageHeader;

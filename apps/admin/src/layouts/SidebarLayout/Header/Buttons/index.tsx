import { Box } from '@mui/material';
import HeaderSearch from './Search';
import { showDemoPages } from 'src/config';
// import HeaderNotifications from './Notifications';

function HeaderButtons() {
  return (
    <Box sx={{ mr: 1 }}>
      {/* Template demo search — hidden in the deployed build to match prod. */}
      {showDemoPages && <HeaderSearch />}
      {/* <Box sx={{ mx: 0.5 }} component="span">
        <HeaderNotifications />
      </Box> */}
    </Box>
  );
}

export default HeaderButtons;

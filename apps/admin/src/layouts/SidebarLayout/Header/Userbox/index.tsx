import { useEffect, useRef, useState } from 'react';

import { NavLink, useNavigate } from 'react-router-dom';

import {
  Avatar,
  Box,
  Button,
  Divider,
  Hidden,
  lighten,
  List,
  ListItem,
  ListItemText,
  Popover,
  Typography
} from '@mui/material';

import { styled } from '@mui/material/styles';
import ExpandMoreTwoToneIcon from '@mui/icons-material/ExpandMoreTwoTone';
import LockOpenTwoToneIcon from '@mui/icons-material/LockOpenTwoTone';
import AccountTreeTwoToneIcon from '@mui/icons-material/AccountTreeTwoTone';
import { useAppDispatch, useAppSelector } from 'src/store/hooks';
import { selectUser, setAuth, setUser } from 'src/slices/userSlice';
import { useLazyLogoutQuery } from 'src/services/auth';
import { type User } from 'src/types/users';
const UserBoxButton = styled(Button)(
  ({ theme }) => `
        padding-left: ${theme.spacing(1)};
        padding-right: ${theme.spacing(1)};
`
);

const MenuUserBox = styled(Box)(
  ({ theme }) => `
        background: ${theme.colors.alpha.black[5]};
        padding: ${theme.spacing(2)};
`
);

const UserBoxText = styled(Box)(
  ({ theme }) => `
        text-align: left;
        padding-left: ${theme.spacing(1)};
`
);

const UserBoxLabel = styled(Typography)(
  ({ theme }) => `
        font-weight: ${theme.typography.fontWeightBold};
        color: ${theme.palette.secondary.main};
        display: block;
`
);

const UserBoxDescription = styled(Typography)(
  ({ theme }) => `
        color: ${lighten(theme.palette.secondary.main, 0.5)}
`
);

function HeaderUserbox() {
  const user = useAppSelector(selectUser);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [getLogout, { data, isLoading, isSuccess, isError }] =
    useLazyLogoutQuery();
  // const user = {
  //   name: 'Catherine Pike',
  //   avatar: '/static/images/avatars/1.jpg',
  //   jobtitle: 'Project Manager'
  // };

  const ref = useRef<any>(null);
  const [isOpen, setOpen] = useState<boolean>(false);

  const handleOpen = (): void => {
    setOpen(true);
  };

  const handleClose = (): void => {
    setOpen(false);
  };

  const handleClick = async () => {
    await getLogout();
  };

  useEffect(() => {
    if (isSuccess) {
      localStorage.removeItem('token');
      dispatch(setAuth(false));
      dispatch(setUser({} as User));
      navigate('/login');
    }
  }, [isSuccess]);

  return (
    <>
      <UserBoxButton color="secondary" ref={ref} onClick={handleOpen}>
        {/* <Avatar variant="rounded" alt={user?.name!} src={user.avatar} /> */}
        <Avatar variant="rounded" alt={user?.name!} />
        <Hidden mdDown>
          <UserBoxText>
            <UserBoxLabel variant="body1">{user?.name!}</UserBoxLabel>
            {/* <UserBoxDescription variant="body2">
              {user.jobtitle}
            </UserBoxDescription> */}
          </UserBoxText>
        </Hidden>
        <Hidden smDown>
          <ExpandMoreTwoToneIcon sx={{ ml: 1 }} />
        </Hidden>
      </UserBoxButton>
      <Popover
        anchorEl={ref.current}
        onClose={handleClose}
        open={isOpen}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
      >
        <MenuUserBox sx={{ minWidth: 210 }} display="flex">
          {/* <Avatar variant="rounded" alt={user.name} src={user.avatar} /> */}
          <Avatar variant="rounded" alt={user?.name!} />
          <UserBoxText>
            <UserBoxLabel variant="body1">{user?.name!}</UserBoxLabel>
            {/* <UserBoxDescription variant="body2">
              {user.jobtitle}
            </UserBoxDescription> */}
          </UserBoxText>
        </MenuUserBox>
        <Divider sx={{ mb: 0 }} />
        <List sx={{ p: 1 }} component="nav">
          {/* <ListItem button to="/management/profile/details" component={NavLink}>
            <AccountBoxTwoToneIcon fontSize="small" />
            <ListItemText primary="My Profile" />
          </ListItem>
          <ListItem button to="/dashboards/messenger" component={NavLink}>
            <InboxTwoToneIcon fontSize="small" />
            <ListItemText primary="Messenger" />
          </ListItem> */}
          <ListItem
            button
            to="/management/profile/settings"
            component={NavLink}
          >
            <AccountTreeTwoToneIcon fontSize="small" />
            <ListItemText primary="Налаштування облікового запису" />
          </ListItem>
        </List>
        <Divider />
        <Box sx={{ m: 1 }}>
          <Button color="primary" fullWidth onClick={handleClick}>
            <LockOpenTwoToneIcon sx={{ mr: 1 }} />
            Вихід
          </Button>
        </Box>
      </Popover>
    </>
  );
}

export default HeaderUserbox;

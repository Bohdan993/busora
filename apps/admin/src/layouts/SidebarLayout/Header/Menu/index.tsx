import {
  Box,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem
} from '@mui/material';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import ExpandMoreTwoToneIcon from '@mui/icons-material/ExpandMoreTwoTone';

const ListWrapper = styled(Box)(
  ({ theme }) => `
        .MuiTouchRipple-root {
            display: none;
        }
        
        .MuiListItem-root {
            transition: ${theme.transitions.create(['color', 'fill'])};
            
            &.MuiListItem-indicators {
                padding: ${theme.spacing(1, 2)};
            
                .MuiListItemText-root {
                    .MuiTypography-root {
                        &:before {
                            height: 4px;
                            width: 22px;
                            opacity: 0;
                            visibility: hidden;
                            display: block;
                            position: absolute;
                            bottom: -10px;
                            transition: all .2s;
                            border-radius: ${theme.general.borderRadiusLg};
                            content: "";
                            background: ${theme.colors.primary.main};
                        }
                    }
                }

                &.active,
                &:active,
                &:hover {
                
                    background: transparent;
                
                    .MuiListItemText-root {
                        .MuiTypography-root {
                            &:before {
                                opacity: 1;
                                visibility: visible;
                                bottom: 0px;
                            }
                        }
                    }
                }
            }
        }
`
);

function HeaderMenu() {
  const passengersRef = useRef<any>(null);
  const ticketsRef = useRef<any>(null);
  const busFlightsRef = useRef<any>(null);
  const [isPassengersOpen, setPassengersOpen] = useState<boolean>(false);
  const [isTicketsOpen, setTicketsOpen] = useState<boolean>(false);
  const [isBusFlightsOpen, setBusFlightsOpen] = useState<boolean>(false);

  const handleTicketsOpen = (): void => {
    setTicketsOpen(true);
  };

  const handleTicketsClose = (): void => {
    setTicketsOpen(false);
  };

  const handleBusFlightsOpen = (): void => {
    setBusFlightsOpen(true);
  };

  const handleBusFlightsClose = (): void => {
    setBusFlightsOpen(false);
  };

  return (
    <>
      <ListWrapper
        sx={{
          display: {
            xs: 'none',
            md: 'block'
          }
        }}
      >
        <List disablePadding component={Box} display="flex">
          <ListItem
            classes={{ root: 'MuiListItem-indicators' }}
            button
            ref={ticketsRef}
            onClick={handleTicketsOpen}
          >
            <ListItemText
              primaryTypographyProps={{ noWrap: true }}
              primary={
                <Box display="flex" alignItems="center">
                  Квитки
                  <Box display="flex" alignItems="center" pl={0.3}>
                    <ExpandMoreTwoToneIcon fontSize="small" />
                  </Box>
                </Box>
              }
            />
          </ListItem>
          <ListItem
            classes={{ root: 'MuiListItem-indicators' }}
            button
            ref={busFlightsRef}
            onClick={handleBusFlightsOpen}
          >
            <ListItemText
              primaryTypographyProps={{ noWrap: true }}
              primary={
                <Box display="flex" alignItems="center">
                  Рейси
                  <Box display="flex" alignItems="center" pl={0.3}>
                    <ExpandMoreTwoToneIcon fontSize="small" />
                  </Box>
                </Box>
              }
            />
          </ListItem>
        </List>
      </ListWrapper>
      <Menu
        anchorEl={ticketsRef.current}
        onClose={handleTicketsClose}
        open={isTicketsOpen}
      >
        <MenuItem
          sx={{ px: 3 }}
          component={NavLink}
          to="/dashboards/tickets"
          onClick={handleTicketsClose}
        >
          Список квитків
        </MenuItem>
        {/* <MenuItem
          sx={{ px: 3 }}
          component={NavLink}
          to="/dashboards/tickets/add"
          onClick={handleTicketsClose}
        >
          Додати квиток
        </MenuItem> */}
      </Menu>

      <Menu
        anchorEl={busFlightsRef.current}
        onClose={handleBusFlightsClose}
        open={isBusFlightsOpen}
      >
        <MenuItem
          sx={{ px: 3 }}
          component={NavLink}
          to="/dashboards/bus-flights"
          onClick={handleBusFlightsClose}
        >
          Список рейсів
        </MenuItem>
        <MenuItem
          sx={{ px: 3 }}
          component={NavLink}
          to="/dashboards/bus-flights/add"
          onClick={handleBusFlightsClose}
        >
          Додати рейс
        </MenuItem>
      </Menu>
    </>
  );
}

export default HeaderMenu;

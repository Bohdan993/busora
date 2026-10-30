import React, {
  FC,
  useState,
  ReactElement,
  ReactNode,
  Dispatch,
  SetStateAction
} from 'react';
import { Menu, MenuItem, IconButton, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

const ITEM_HEIGHT = 48;

interface ToolbarMenuProps {
  children: ReactNode;
  disabled: boolean;
  setExternalAnchor?: Dispatch<SetStateAction<HTMLElement | null>>;
}

interface ToolbarMenuItemProps {
  handleClose?: () => void;
  children: ReactNode;
  disableRipple: boolean;
}

export const ToolbarMenuItem: FC<ToolbarMenuItemProps> = ({
  handleClose,
  children,
  ...props
}) => {
  // Use handleClose function as needed
  return (
    <MenuItem {...props} onClick={handleClose}>
      {children}
    </MenuItem>
  );
};

export const ToolbarMenu: FC<ToolbarMenuProps> = ({
  children,
  disabled,
  setExternalAnchor
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setExternalAnchor?.(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const menuChildren = React.Children.map(children, (child) => {
    // Pass handleClose function to each child
    if (React.isValidElement(child)) {
      return React.cloneElement(child as ReactElement<ToolbarMenuItemProps>, {
        handleClose: handleClose
      });
    }
    return child;
  });

  return (
    <div>
      <Tooltip arrow title="Меню">
        <IconButton
          disabled={disabled}
          aria-label="more"
          id="toolbar-button"
          aria-controls={open ? 'toolbar-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="true"
          onClick={handleClick}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="toolbar-menu"
        MenuListProps={{
          'aria-labelledby': 'toolbar-button'
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5
          }
        }}
      >
        {menuChildren}
      </Menu>
    </div>
  );
};

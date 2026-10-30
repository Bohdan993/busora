import { FC, useRef, Dispatch, SetStateAction } from 'react';
import {
  Menu,
  MenuItem,
  Typography,
  Divider,
  Tooltip,
  Switch,
  FormControlLabel,
  Box
} from '@mui/material';
import { type MenuProps } from '@mui/material/Menu';
import { type ColumnDefinitionItem } from 'src/content/dashboards/Tickets/constants';

interface ColumnsSelectMenuProps extends Partial<MenuProps> {
  anchorEl: HTMLElement | null;
  columns: ColumnDefinitionItem[];
  isOpen: boolean;
  setAnchorEl: Dispatch<SetStateAction<HTMLElement | null>>;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  setColumns: Dispatch<SetStateAction<ColumnDefinitionItem[]>>;
  render?: () => JSX.Element;
}

interface ColumnsSelectMenuItemProps {
  checked: boolean;
  column: ColumnDefinitionItem;
  setChecked: Dispatch<SetStateAction<ColumnDefinitionItem[]>>;
}

export const ColumnsSelectMenuItem: FC<ColumnsSelectMenuItemProps> = ({
  // handleClose,
  // children,
  column,
  checked,
  setChecked,
  ...props
}) => {
  // Use handleClose function as needed
  const menuItemRef = useRef<HTMLElement>(null);
  return (
    <MenuItem
      disableRipple
      ref={menuItemRef as any}
      {...props}
      sx={(theme) => ({
        alignItems: 'center',
        justifyContent: 'flex-start',
        my: 0,
        outlineOffset: '-2px',
        py: '6px'
      })}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          gap: '8px'
        }}
      >
        <FormControlLabel
          checked={checked}
          componentsProps={{
            typography: {
              sx: {
                mb: 0
              }
            }
          }}
          control={
            <Tooltip
              arrow
              title={checked ? 'Виключити колонку' : 'Включити колонку'}
            >
              <Switch />
            </Tooltip>
          }
          label={column.name}
          onChange={() =>
            setChecked((prev) => {
              const index = prev.findIndex((item) => item.id === column.id);
              const el = prev.find((item) => item.id === column.id);
              const prevPart = prev.slice(0, index);
              const nextPart = prev.slice(index + 1);
              if (el) {
                return [
                  ...prevPart,
                  { id: el.id, name: el.name, checked: !el.checked },
                  ...nextPart
                ];
              }
              return [...prev];
            })
          }
        />
      </Box>
    </MenuItem>
  );
};

export const ColumnsSelectMenu = ({
  anchorEl,
  columns,
  isOpen,
  setAnchorEl,
  setColumns,
  setIsOpen,
  render,
  ...props
}: ColumnsSelectMenuProps) => {
  const open = Boolean(anchorEl && isOpen);

  const handleClose = () => {
    setAnchorEl(null);
    setIsOpen(false);
  };

  return (
    <div>
      <Menu
        id="columns-select-menu"
        MenuListProps={{
          dense: false
        }}
        anchorEl={anchorEl}
        disableScrollLock
        open={open}
        onClose={handleClose}
        {...props}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            p: '0.5rem',
            pt: 0
          }}
        >
          <Typography variant="h4" component="h4" gutterBottom>
            Оберіть необхідні колонки
          </Typography>
        </Box>
        <Divider />
        {columns.map((column, index) => (
          <ColumnsSelectMenuItem
            column={column}
            key={`${index}-${column.id}`}
            checked={column.checked}
            setChecked={setColumns}
          />
        ))}
        <Divider />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            p: '0.5rem',
            pt: 0
          }}
        >
          {render && render()}
        </Box>
      </Menu>
    </div>
  );
};

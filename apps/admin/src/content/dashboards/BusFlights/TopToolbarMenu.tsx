import { FC, useState } from 'react';
import { type MRT_TableInstance } from 'material-react-table';
import { type BusFlight } from 'src/types/busFlights';
import { ToolbarMenu, ToolbarMenuItem } from 'src/components/ToolbarMenu';
import { Button } from '@mui/material';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';

interface TopToolbarMenuProps {
  table: MRT_TableInstance<BusFlight>;
  disabled: boolean;
}

export const TopToolbarMenu: FC<TopToolbarMenuProps> = ({
  table,
  disabled
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <ToolbarMenu setExternalAnchor={setAnchorEl} disabled={false}>
        <ToolbarMenuItem disableRipple>
          <Button
            // disabled={disabled}
            variant="text"
            onClick={() => {
              table.resetColumnFilters(true);
            }}
            startIcon={<FilterListOffIcon />}
          >
            Скинути фільтри
          </Button>
        </ToolbarMenuItem>
        <ToolbarMenuItem disableRipple>
          <Button
            // disabled={disabled}
            variant="text"
            onClick={() => {
              table.resetSorting();
            }}
            startIcon={<CancelPresentationIcon />}
          >
            Скинути сортування
          </Button>
        </ToolbarMenuItem>
      </ToolbarMenu>
    </>
  );
};

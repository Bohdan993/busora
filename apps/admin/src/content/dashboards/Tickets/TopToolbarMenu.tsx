import { FC, useState } from 'react';
import { type MRT_TableInstance } from 'material-react-table';
import dayjs from 'dayjs';
import { type Ticket } from 'src/types/tickets';
import { ToolbarMenu, ToolbarMenuItem } from 'src/components/ToolbarMenu';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Button } from '@mui/material';
import {
  mkConfig,
  generateCsv,
  download,
  type ConfigOptions
} from 'export-to-csv';
import { jsPDF } from 'jspdf'; //or use your library of choice here
import autoTable, { RowInput } from 'jspdf-autotable';
import { ColumnsSelectMenu } from 'src/components/ColumnsSelectMenu';
import { type ColumnsDefinition, type ColumnDefinitionItem } from './constants';
import { transformTicketBusFlightToString } from 'src/helpers';

import 'src/helpers/Roboto-Regular-normal.js';

interface TopToolbarMenuProps {
  table: MRT_TableInstance<Ticket>;
  columns: ColumnsDefinition;
  validationErrors: Record<string, string | undefined>;
  disabled: boolean;
}

function createColumnHeaders(
  map: Map<any, any>
): { key: string; displayLabel: string }[] {
  const mapIter = map?.keys();
  const result = [];
  for (const key of mapIter) {
    const obj: { key: string; displayLabel: string } = {
      key: '',
      displayLabel: ''
    };
    //@ts-ignore
    obj['key'] = key;
    //@ts-ignore
    obj['displayLabel'] = map.get(key)?.[1];
    result.push(obj);
  }

  return result;
}

function createColumnData(ticketColsData: Map<any, any>[]) {
  // Each row is a Map of colId -> [value, displayLabel]; flatten to a plain
  // { colId: value } object so export-to-csv / jspdf get actual row data
  // (matching the keys produced by createColumnHeaders).
  return ticketColsData.map((rowMap) => {
    const result: Record<string, any> = {};
    for (const key of rowMap.keys()) {
      result[key] = rowMap.get(key)?.[0];
    }
    return result;
  });
}
const exportObj = {
  exportRowsCSV(rowData: Object[], csvConfig: Required<ConfigOptions>) {
    //@ts-ignore
    const csv = generateCsv(csvConfig)(rowData);
    download(csvConfig)(csv);
  },
  exportRowsPDF(rowData: Object[], tableHeaders: RowInput, fileName: string) {
    //@ts-ignore
    const doc = new jsPDF({
      orientation: 'landscape'
    });
    doc.setFont('Roboto-Regular');
    // const tableData = rows.map((row) => Object.values(row.original));
    // const tableHeaders = columns.map((c) => c.header);
    autoTable(doc, {
      styles: { font: 'Roboto-Regular', fontSize: 8 },
      head: [tableHeaders],
      body: rowData.map((row: Object) => Object.values(row))
    });

    doc.save(fileName + '.pdf');
  }
};

const handleExport = ({
  columnsCheckedState,
  table,
  columns,
  exportFnName
}: {
  columnsCheckedState: ColumnDefinitionItem[];
  table: MRT_TableInstance<Ticket>;
  columns: ColumnsDefinition;
  exportFnName: string;
}) => {
  const checkedCols: (ColumnDefinitionItem | null)[] = columnsCheckedState
    ?.map((el) => {
      if (el?.checked) {
        return el;
      }

      return null;
    })
    .filter(Boolean);
  const checkedColsMap: {
    ticketCols: ColumnDefinitionItem[];
    passengersCols: ColumnDefinitionItem[];
  } = checkedCols.reduce(
    (acc, curr) => {
      if (
        columns.ticketsTable?.some((el: ColumnDefinitionItem) => {
          return el.id === curr?.id;
        })
      ) {
        if (!acc['ticketCols']) {
          acc['ticketCols'] = [];
        }
        if (curr) acc['ticketCols'].push(curr);
        return acc;
      }

      return acc;
    },
    {} as {
      ticketCols: ColumnDefinitionItem[];
      passengersCols: ColumnDefinitionItem[];
    }
  );
  const tableData = table.getRowModel().rows.map((row) => row.original);
  const checkedTicketsColsIds = checkedColsMap.ticketCols.map((el) => el.id);
  const selectedTicketColsData = tableData.map((el) => {
    const result = new Map();
    for (let i = 0; i < checkedTicketsColsIds.length; i++) {
      if (
        checkedTicketsColsIds[i] === 'dateOfReturn' ||
        checkedTicketsColsIds[i] === 'dateOfDeparture'
      ) {
        //@ts-ignore
        result.set(checkedTicketsColsIds[i], [
          //@ts-ignore
          dayjs(el[checkedTicketsColsIds[i]]).format('DD-MM-YYYY'),
          columns.ticketsTable?.find(
            (col: ColumnDefinitionItem) => col.id === checkedTicketsColsIds[i]
          )?.name
        ]);
        continue;
      }
      if (checkedTicketsColsIds[i] === 'busFlightFrom') {
        //@ts-ignore
        result.set(checkedTicketsColsIds[i], [
          transformTicketBusFlightToString(el, 'busFlightFrom'),
          columns.ticketsTable?.find(
            (col: ColumnDefinitionItem) => col.id === checkedTicketsColsIds[i]
          )?.name
        ]);
        continue;
      }

      if (checkedTicketsColsIds[i] === 'busFlightTo') {
        //@ts-ignore
        result.set(checkedTicketsColsIds[i], [
          transformTicketBusFlightToString(el, 'busFlightTo'),
          columns.ticketsTable?.find(
            (col: ColumnDefinitionItem) => col.id === checkedTicketsColsIds[i]
          )?.name
        ]);
        continue;
      }

      if (
        checkedTicketsColsIds[i] === 'origin' ||
        checkedTicketsColsIds[i] === 'destination'
      ) {
        //@ts-ignore
        result.set(checkedTicketsColsIds[i], [
          //@ts-ignore
          el[checkedTicketsColsIds[i]]?.name,
          columns.ticketsTable?.find(
            (col: ColumnDefinitionItem) => col.id === checkedTicketsColsIds[i]
          )?.name
        ]);
        continue;
      }

      if (checkedTicketsColsIds[i] === 'agent') {
        //@ts-ignore
        const agentVal = el['agent'];
        result.set(checkedTicketsColsIds[i], [
          typeof agentVal === 'string' ? agentVal : agentVal?.name || '',
          columns.ticketsTable?.find(
            (col: ColumnDefinitionItem) => col.id === checkedTicketsColsIds[i]
          )?.name
        ]);
        continue;
      }
      //@ts-ignore
      const rawValue = el[checkedTicketsColsIds[i]];
      // Generic fallback: some columns (e.g. passengerDiscount) hold an
      // { id, name, ... } object — export its display field instead of
      // "[object Object]".
      const cellValue =
        rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
          ? rawValue.name ?? rawValue.value ?? rawValue.label ?? ''
          : rawValue;
      result.set(checkedTicketsColsIds[i], [
        cellValue,
        columns.ticketsTable?.find(
          (col: ColumnDefinitionItem) => col.id === checkedTicketsColsIds[i]
        )?.name
      ]);
    }

    return result;
  });

  //@ts-ignore
  switch (exportFnName) {
    case 'exportRowsCSV': {
      exportObj[exportFnName](
        createColumnData(selectedTicketColsData),
        mkConfig({
          fieldSeparator: ',',
          decimalSeparator: '.',
          columnHeaders: [...createColumnHeaders(selectedTicketColsData?.[0])]
        })
      );
      break;
    }

    case 'exportRowsPDF': {
      exportObj[exportFnName](
        createColumnData(selectedTicketColsData),
        [
          ...createColumnHeaders(selectedTicketColsData?.[0]).map(
            (el) => el.displayLabel
          )
        ],
        'data'
      );
      break;
    }

    default: {
      break;
    }
  }
};

export const TopToolbarMenu: FC<TopToolbarMenuProps> = ({
  table,
  columns,
  validationErrors,
  disabled
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [columnsCheckedState, setColumnsCheckedState] = useState(() => [
    ...(columns?.ticketsTable || [])
  ]);
  const [exportState, setExportState] = useState('');
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOpen(false);
  };

  return (
    <>
      <ToolbarMenu setExternalAnchor={setAnchorEl} disabled={false}>
        <ToolbarMenuItem disableRipple>
          <Button
            variant="text"
            disabled={
              disabled ||
              table.getRowModel().rows.length === 0 ||
              Object.values(validationErrors).some((error) => !!error)
            }
            onClick={() => {
              handleClick();
              setExportState('exportRowsCSV');
            }}
            startIcon={<FileDownloadIcon />}
          >
            Вивантажити пасажирів з поточної сторінки у CSV
          </Button>
        </ToolbarMenuItem>
        <ToolbarMenuItem disableRipple>
          <Button
            variant="text"
            disabled={
              disabled ||
              table.getRowModel().rows.length === 0 ||
              Object.values(validationErrors).some((error) => !!error)
            }
            onClick={() => {
              handleClick();
              setExportState('exportRowsPDF');
            }}
            startIcon={<FileDownloadIcon />}
          >
            Вивантажити пасажирів з поточної сторінки у PDF
          </Button>
        </ToolbarMenuItem>
      </ToolbarMenu>
      <ColumnsSelectMenu
        anchorEl={anchorEl}
        setAnchorEl={setAnchorEl}
        columns={columnsCheckedState}
        setColumns={setColumnsCheckedState}
        isOpen={open}
        setIsOpen={setOpen}
        render={() => {
          return (
            <>
              <Button
                sx={{ mt: { xs: 2, md: 0 } }}
                variant="contained"
                onClick={() => {
                  handleExport({
                    columnsCheckedState,
                    table,
                    columns,
                    exportFnName: exportState
                  });
                  handleClose();
                }}
              >
                Вивантажити
              </Button>
            </>
          );
        }}
      />
    </>
  );
};

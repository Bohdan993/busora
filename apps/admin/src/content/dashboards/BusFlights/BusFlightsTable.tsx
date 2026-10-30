import { useState, useMemo, FC, useEffect, useRef } from 'react';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_PaginationState,
  type MRT_ColumnFiltersState,
  type MRT_SortingState,
  type MRT_Row
} from 'material-react-table';
import dayjs from 'dayjs';
//Import Material React Table Translations
import { MRT_Localization_UK } from 'material-react-table/locales/uk';
import { Card, IconButton, Tooltip, Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { type BusFlight } from 'src/types/busFlights';
import {
  useDeleteBusFlightMutation,
  useGetBusFlightsQuery
} from 'src/services/busFlight';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  PositionedSnackbar,
  SnackbarState
} from 'src/components/PositionedSnackbar';
import { type LocationState } from 'src/types/router';
import { useRendersCount } from 'src/helpers/hooks';
import { setFullScreen } from 'src/slices/appSlice';
import { useAppDispatch } from 'src/store/hooks';
import { TopToolbarMenu } from './TopToolbarMenu';
import { debounce } from 'src/helpers';

const validPageSizes = [10, 20, 50, 100];

const BusFlightsTable: FC = () => {
  const dispatch = useAppDispatch();
  const renderCount = useRendersCount();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  let notification = (location.state as LocationState)?.notification;
  const notificationSeverity = (location.state as LocationState)
    ?.notificationSeverity;
  const navigate = useNavigate();
  const columns = useMemo<MRT_ColumnDef<BusFlight>[]>(
    () => [
      {
        accessorKey: 'busFlightId',
        //enableColumnFilterModes: false, //disable changing filter mode for this column
        //filterFn: 'equals', //set filter mode to equals
        header: 'ID',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        // enablePinning: false
        enableColumnPinning: false,
        enableRowPinning: false
      },
      {
        accessorKey: 'allSeats', //normal, all filter modes are enabled
        header: 'Всі місця',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        // enablePinning: false
        enableColumnPinning: false,
        enableRowPinning: false
      },
      {
        accessorKey: 'freeSeats',
        // enableColumnFilterModes: false, //disable changing filter mode for this column
        //filterFn: 'startsWith', //even though changing the mode is disabled, you can still set the default filter mode
        header: 'Вільні місця',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        // enablePinning: false
        enableColumnPinning: false,
        enableRowPinning: false
      },
      {
        accessorKey: 'route',
        header: 'Маршрут',
        columnFilterModeOptions: [
          'contains',
          'equals',
          'endsWith',
          'startsWith'
        ], //only allow these filter modes
        // enablePinning: false
        enableColumnPinning: false,
        enableRowPinning: false
        //if you do not want to use the default filter modes, you can provide your own and render your own menu
        // renderColumnFilterModeMenuItems: ({ onSelectFilterMode }) => [
        //   <MenuItem key="0" onClick={() => onSelectFilterMode('contains')}>
        //     <div>Contains</div>
        //   </MenuItem>,
        //   <MenuItem
        //     key="1"
        //     onClick={() => onSelectFilterMode('customFilterFn')}
        //   >
        //     <div>Custom Filter Fn</div>
        //   </MenuItem>
        // ]
      },
      {
        accessorFn: (originalRow) => {
          return new Date(originalRow.dateOfDeparture);
        },
        id: 'dateOfDeparture',
        filterVariant: 'date',
        columnFilterModeOptions: [
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        //filterFn: 'between',
        header: 'Дата відправлення',
        // header: 'Date of departure',
        // enablePinning: false,
        enableColumnPinning: false,
        enableRowPinning: false,
        Cell: ({ cell }) => {
          return dayjs(cell.getValue<Date>()).format('DD-MM-YYYY');
        },
        muiFilterDatePickerProps: {
          slotProps: {
            textField: {
              placeholder: 'ДД-ММ-РРРР'
            }
          }
        }
      },
      {
        accessorKey: 'discount',
        //columnFilterModeOptions: ['between', 'greaterThan', 'lessThan'], //only allow these filter modes
        columnFilterModeOptions: [
          'contains',
          'equals',
          'between',
          'greaterThan',
          'lessThan',
          'greaterThanOrEqualTo',
          'lessThanOrEqualTo'
        ], //only allow these filter modes
        //filterFn: 'between',
        header: 'Знижка, %',
        // enablePinning: false
        enableColumnPinning: false,
        enableRowPinning: false
      }
    ],
    []
  );
  const [snackBarState, setSnackBarState] = useState<SnackbarState>({
    open: false,
    vertical: 'bottom',
    horizontal: 'right',
    message: '',
    severity: 'info'
  });
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [currId, setCurrId] = useState('0');
  const [columnFilters, setColumnFilters] = useState<MRT_ColumnFiltersState>(
    JSON.parse(params.get('filters') || 'null')?.map(
      (el: { id: string; value: any }) => {
        if (el?.id === 'dateOfDeparture') {
          return {
            id: 'dateOfDeparture',
            value: dayjs(dayjs(el?.value).format('YYYY-MM-DD'))
          };
        }

        return el;
      }
    ) || [
      {
        id: 'dateOfDeparture',
        value: dayjs(dayjs().format('YYYY-MM-DD'))
      }
    ]
  );
  const setColumnFiltersDebounced = debounce(setColumnFilters, 250);
  const [columnFilterFns, setColumnFilterFns] = useState(
    JSON.parse(params.get('filterFns') || 'null') ||
      Object.fromEntries(
        columns.map(({ accessorKey, id }) => {
          if (id === 'dateOfDeparture') {
            return [id, 'greaterThanOrEqualTo'];
          }

          return [accessorKey, 'contains'];
        })
      )
  );
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: parseInt(params.get('pageIndex') || 'null', 10),
    pageSize: validPageSizes.includes(
      parseInt(params.get('pageSize') || '20', 10)
    )
      ? parseInt(params.get('pageSize') || '20', 10)
      : 20
  });
  const [sorting, setSorting] = useState<MRT_SortingState>(
    JSON.parse(params.get('sorting') || 'null') || [
      {
        id: 'dateOfDeparture', //sort by age by default on page load
        desc: false
      },
      {
        id: 'id', //then sort by lastName if age is the same
        desc: false
      }
    ]
  );
  const pageIndexRef = useRef(pagination.pageIndex);
  const [deleteFn, deleteResult] = useDeleteBusFlightMutation();
  const {
    isError: deleteIsError,
    isSuccess: deleteIsSuccess,
    isLoading: deleteIsLoading,
    error: deleteError,
    data: deleteData
  } = deleteResult;
  const { data, isLoading, isSuccess, isError, isFetching, error, refetch } =
    useGetBusFlightsQuery({
      start: (pagination.pageIndex || 0) * pagination.pageSize,
      size: pagination.pageSize,
      filters: JSON.stringify(columnFilters ?? []),
      filtersFns: JSON.stringify(columnFilterFns ?? []),
      sorting: JSON.stringify(sorting ?? [])
    });

  // useEffect(()=>{
  //   async function getData(){
  //     await refetch();
  //   }
  //   getData();

  // }, [pagination.pageIndex, pagination.pageSize]);

  //DELETE action
  const openDeleteConfirmModal = (row: MRT_Row<BusFlight>) => {
    setCurrId(row.original.busFlightId || '0');
  };

  const handleSnackBarOpen = (newState: SnackbarState) => {
    setSnackBarState({ ...newState });
  };

  const handleSnackBarClose = () => {
    setSnackBarState({
      ...snackBarState,
      open: false
    });
  };

  useEffect(() => {
    let queryString: string = `/dashboards/bus-flights?pageSize=${
      pagination.pageSize
    }&pageIndex=${pagination.pageIndex}&filters=${JSON.stringify(
      columnFilters ?? []
    )}&filterFns=${JSON.stringify(
      columnFilterFns ?? []
    )}&sorting=${JSON.stringify(sorting ?? [])}`;

    // if(renderCount === 2 && !isNaN(pageIndexRef.current) && (pagination.pageIndex !== pageIndexRef.current)) {
    //   setPagination(prev => ({
    //     pageIndex: pageIndexRef.current,
    //     pageSize: prev.pageSize
    //   }));

    //   queryString = `/dashboards/bus-flights?pageSize=${pagination.pageSize}&pageIndex=${pageIndexRef.current}&filters=${JSON.stringify(columnFilters ?? [])}&filterFns=${JSON.stringify(columnFilterFns ?? [])}&sorting=${JSON.stringify(sorting ?? [])}`;
    //   navigate(queryString);
    //   return;
    // }
    // Check if pageIndex has changed before navigating
    // if (parseInt(params.get('pageIndex') || '0', 10) !== pagination.pageIndex) {
    navigate(queryString);
    // return;
    // }

    async function getData() {
      await refetch();
    }
    getData();
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    columnFilters,
    columnFilterFns,
    sorting
  ]);

  useEffect(() => {
    if (Number(currId)) {
      async function deleteBusFlight() {
        if (
          window.confirm(`Ви впевнені, що хочете видалити рейс з id ${currId}?`)
        ) {
          await deleteFn(currId);
        }
      }
      deleteBusFlight();
    }
  }, [currId]);

  useEffect(() => {
    if (deleteIsSuccess) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `Рейс з id ${currId} успішно видалено!`,
        open: true,
        severity: 'success'
      });
      setCurrId('0');
    }
  }, [deleteIsSuccess]);

  useEffect(() => {
    if (deleteIsError) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: `Виникла помилка при видаленні рейсу з id ${currId}! ${JSON.stringify(
          deleteError,
          null,
          2
        )}`,
        open: true,
        severity: 'error'
      });
      setCurrId('0');
    }
  }, [deleteIsError]);

  useEffect(() => {
    if (notification) {
      handleSnackBarOpen({
        vertical: 'bottom',
        horizontal: 'right',
        message: notification,
        open: true,
        severity: notificationSeverity || 'info'
      });
      // Reset the location state after displaying the notification
      navigate(location.pathname + location.search, { state: null });
    }
  }, [notification, notificationSeverity, location, navigate]);

  useEffect(() => {
    if (isNaN(parseInt(params.get('pageIndex') || 'null', 10))) {
      setPagination((prev) => ({
        pageIndex: data?.meta?.startPage ?? 0,
        pageSize: prev.pageSize
      }));
    }
  }, [data?.meta?.startPage]);

  useEffect(() => {
    dispatch(setFullScreen(isFullScreen));
  }, [isFullScreen]);

  const table = useMaterialReactTable({
    autoResetPageIndex: false,
    columns: columns,
    data: data?.data ?? [],
    enableColumnFilterModes: true,
    enableColumnPinning: true,
    enableFullScreenToggle: true,
    enableGlobalFilter: false,
    enableMultiSort: true,
    enableRowActions: true,
    enableStickyFooter: true,
    enableStickyHeader: true,
    initialState: {
      showColumnFilters: true,
      columnPinning: { right: ['mrt-row-actions'] }
    },
    isMultiSortEvent: () => true,
    localization: {
      ...MRT_Localization_UK
      // filterCustomFilterFn: 'Custom Filter Fn'
    },
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    muiBottomToolbarProps: {
      sx: {
        minHeight: '3.5rem!important'
      }
    },
    muiFilterDatePickerProps: {
      format: 'DD-MM-YYYY'
    },
    muiTableBodyRowProps: {
      sx: {
        backgroundColor: 'white'
      }
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: 'clamp(350px, calc(100vh - 375px), 9999px)'
      }
    },
    muiPaginationProps: {
      rowsPerPageOptions: validPageSizes,
      showFirstButton: true,
      showLastButton: true
    },
    muiTablePaperProps: ({ table }) => ({
      //not sx
      style: {
        zIndex: isFullScreen ? 1000 : undefined,
        borderRadius: isFullScreen ? '0' : '10px'
      }
    }),
    muiTopToolbarProps: {
      sx: {
        minHeight: '3.5rem!important'
      }
    },
    muiToolbarAlertBannerProps: isError
      ? {
          color: 'error',
          children: `Виникла помилка. Неможливо завантажити дані. ${
            'data' in error
              ? 'status' in (error.data as any)
                ? (error.data as any).status
                : JSON.stringify(error)
              : JSON.stringify(error)
          }.`
        }
      : undefined,
    onColumnFilterFnsChange: setColumnFilterFns,
    onIsFullScreenChange: setIsFullScreen,
    // @ts-ignore
    onColumnFiltersChange: setColumnFiltersDebounced,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: '8px' }}>
        <Tooltip title="Редагувати">
          <IconButton
            color="secondary"
            onClick={() => {
              navigate(
                `/dashboards/bus-flights/edit/${
                  row.original.busFlightId
                }?redirect=${encodeURIComponent(
                  location.pathname + location.search
                )}`
              );
            }}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Видалити">
          <IconButton color="error" onClick={() => openDeleteConfirmModal(row)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
    // renderTopToolbarCustomActions: ({table}) => (
    //   <Tooltip arrow title="Перезавантажити">
    //     {/* <IconButton onClick={() => refetch()}> */}
    //     <IconButton onClick={() => {console.log("getCoreRowModel", table.getCoreRowModel().rows);}}>
    //       <RefreshIcon />
    //     </IconButton>
    //   </Tooltip>
    // ),
    renderTopToolbarCustomActions: ({ table }) => {
      return (
        <Box sx={{ display: 'flex', gap: '1rem', p: '4px' }}>
          <Tooltip arrow title="Перезавантажити">
            <IconButton onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <TopToolbarMenu table={table} disabled={isLoading} />
        </Box>
      );
    },
    positionActionsColumn: 'last',
    rowCount: data?.meta?.totalRowCount ?? 0,
    state: {
      isFullScreen,
      isLoading,
      pagination,
      showAlertBanner: isError,
      showProgressBars: isFetching,
      columnFilters,
      columnFilterFns,
      sorting
    }
  });

  return (
    <Card style={{ width: '100%' }}>
      <MaterialReactTable table={table} />
      <PositionedSnackbar
        state={snackBarState}
        handleClose={handleSnackBarClose}
      />
    </Card>
  );
};

export default BusFlightsTable;

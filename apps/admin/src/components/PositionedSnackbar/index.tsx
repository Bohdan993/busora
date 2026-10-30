import Snackbar, { SnackbarOrigin } from '@mui/material/Snackbar';
import { FC, forwardRef } from 'react';
import MuiAlert, { AlertProps } from '@mui/material/Alert';

export interface SnackbarState extends SnackbarOrigin {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

type SnackbarProps = {
  handleClose: () => void;
  state: {
    open: boolean;
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  };
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  props,
  ref
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export const PositionedSnackbar: FC<SnackbarProps> = ({
  handleClose,
  state: { vertical, horizontal, open, message, severity }
}) => {
  // const [state, setState] = useState<State>({
  //   open: false,
  //   vertical: 'top',
  //   horizontal: 'right',
  // });
  // const { vertical, horizontal, open } = state;

  // const handleClick = (newState: SnackbarOrigin) => () => {
  //   setState({ ...newState, open: true });
  // };

  // const handleClose = () => {
  //   setState({ ...state, open: false });
  // };
  return (
    <Snackbar
      autoHideDuration={6000}
      anchorOrigin={{ vertical, horizontal }}
      open={open}
      onClose={handleClose}
      // key={vertical + horizontal}
    >
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

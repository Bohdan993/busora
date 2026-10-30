import { ComponentType, FC } from 'react';
import { Navigate } from 'react-router-dom';
import { selectUser } from 'src/slices/userSlice';
import { useAppSelector } from 'src/store/hooks';

const withIsAccountActivated =
  <P extends any>(Component: ComponentType<P>): FC<P> =>
  (props) => {
    const user = useAppSelector(selectUser);
    // const location = useLocation();

    if (user?.isActivated) {
      return <Component {...props} />;
    }

    return (
      <Navigate
        to="/home"
        replace
        // state={{redirect: location?.pathname}}
      />
    );
  };

export default withIsAccountActivated;

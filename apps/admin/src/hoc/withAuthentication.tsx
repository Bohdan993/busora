import { ComponentType, FC } from 'react';
import { Navigate } from 'react-router-dom';
import { selectIsAuth } from 'src/slices/userSlice';
import { useAppSelector } from 'src/store/hooks';

const withAuthentication =
  <P extends any>(Component: ComponentType<P>): FC<P> =>
  (props) => {
    const isAuthenticated = useAppSelector(selectIsAuth);
    // const location = useLocation();

    if (isAuthenticated) {
      return <Component {...props} />;
    }

    return (
      <Navigate
        to="/login"
        replace
        // state={{redirect: location?.pathname}}
      />
    );
  };

export default withAuthentication;

import { Suspense, lazy, LazyExoticComponent } from 'react';
import { Navigate } from 'react-router-dom';
import { RouteObject } from 'react-router';

import SidebarLayout from 'src/layouts/SidebarLayout';
import BaseLayout from 'src/layouts/BaseLayout';

import SuspenseLoader from 'src/components/SuspenseLoader';
import withAuthentication from './hoc/withAuthentication';
import withIsAccountActivated from './hoc/withIsAccountActivated';

const Loader =
  (Component: LazyExoticComponent<() => JSX.Element>) =>
  (props: JSX.IntrinsicAttributes) =>
    (
      <Suspense fallback={<SuspenseLoader />}>
        <Component {...props} />
      </Suspense>
    );

// Pages

const Home = Loader(lazy(() => import('src/content/home')));

// Dashboards

const Crypto = Loader(lazy(() => import('src/content/dashboards/Crypto')));
const Tickets = Loader(lazy(() => import('src/content/dashboards/Tickets')));
const TicketsAdd = Loader(
  lazy(() => import('src/content/dashboards/Tickets/Add'))
);
const TicketsEdit = Loader(
  lazy(() => import('src/content/dashboards/Tickets/Edit'))
);
const BusFlights = Loader(
  lazy(() => import('src/content/dashboards/BusFlights'))
);
const BusFlightsAdd = Loader(
  lazy(() => import('src/content/dashboards/BusFlights/Add'))
);
const BusFlightsEdit = Loader(
  lazy(() => import('src/content/dashboards/BusFlights/Edit'))
);

// Applications

const Messenger = Loader(
  lazy(() => import('src/content/applications/Messenger'))
);
const Transactions = Loader(
  lazy(() => import('src/content/applications/Transactions'))
);
const UserProfile = Loader(
  lazy(() => import('src/content/applications/Users/profile'))
);
const UserSettings = Loader(
  lazy(() => import('src/content/applications/Users/settings'))
);

// Components

const Buttons = Loader(
  lazy(() => import('src/content/pages/Components/Buttons'))
);
const Modals = Loader(
  lazy(() => import('src/content/pages/Components/Modals'))
);
const Accordions = Loader(
  lazy(() => import('src/content/pages/Components/Accordions'))
);
const Tabs = Loader(lazy(() => import('src/content/pages/Components/Tabs')));
const Badges = Loader(
  lazy(() => import('src/content/pages/Components/Badges'))
);
const Tooltips = Loader(
  lazy(() => import('src/content/pages/Components/Tooltips'))
);
const Avatars = Loader(
  lazy(() => import('src/content/pages/Components/Avatars'))
);
const Cards = Loader(lazy(() => import('src/content/pages/Components/Cards')));
const Forms = Loader(lazy(() => import('src/content/pages/Components/Forms')));

// Status

const Status404 = Loader(
  lazy(() => import('src/content/pages/Status/Status404'))
);
const Status500 = Loader(
  lazy(() => import('src/content/pages/Status/Status500'))
);
const StatusComingSoon = Loader(
  lazy(() => import('src/content/pages/Status/ComingSoon'))
);
const StatusMaintenance = Loader(
  lazy(() => import('src/content/pages/Status/Maintenance'))
);

// Pages

const LoginPage = Loader(lazy(() => import('src/content/pages/Login')));

const RegistrationPage = Loader(
  lazy(() => import('src/content/pages/Registration'))
);

const WithAuthHome = withAuthentication(Home);
const WithAuthNavigate = withAuthentication(Navigate);
// const WithAuthPassengers = withIsAccountActivated(withAuthentication(Passengers));
// const WithAuthPassengersAdd = withIsAccountActivated(withAuthentication(PassengersAdd));
// const WithAuthPassengersEdit = withIsAccountActivated(withAuthentication(PassengersEdit));
const WithAuthTickets = withIsAccountActivated(withAuthentication(Tickets));
const WithAuthTicketsAdd = withIsAccountActivated(
  withAuthentication(TicketsAdd)
);
const WithAuthTicketsEdit = withIsAccountActivated(
  withAuthentication(TicketsEdit)
);
const WithAuthBusFlights = withIsAccountActivated(
  withAuthentication(BusFlights)
);
const WithAuthBusFlightsAdd = withIsAccountActivated(
  withAuthentication(BusFlightsAdd)
);
const WithAuthBusFlightsEdit = withIsAccountActivated(
  withAuthentication(BusFlightsEdit)
);

const routes: RouteObject[] = [
  {
    path: '',
    element: <BaseLayout />,
    children: [
      {
        path: '',
        element: <WithAuthNavigate to="/home" replace />
      },
      {
        path: '/login',
        element: <LoginPage />
      },
      {
        path: '/registration',
        element: <RegistrationPage />
      },
      {
        path: 'status',
        children: [
          {
            path: '',
            element: <Navigate to="404" replace />
          },
          {
            path: '404',
            element: <Status404 />
          },
          {
            path: '500',
            element: <Status500 />
          },
          {
            path: 'maintenance',
            element: <StatusMaintenance />
          },
          {
            path: 'coming-soon',
            element: <StatusComingSoon />
          }
        ]
      },
      {
        path: '*',
        element: <Status404 />
      }
    ]
  },
  {
    path: 'home',
    element: <SidebarLayout />,
    children: [
      {
        path: '',
        element: <WithAuthHome />
      }
    ]
  },
  {
    path: 'dashboards',
    element: <SidebarLayout />,
    children: [
      {
        path: '',
        element: <WithAuthNavigate to="tickets" replace />
      },
      {
        path: 'crypto',
        element: <Crypto />
      },
      {
        path: 'messenger',
        element: <Messenger />
      },
      {
        path: 'tickets',
        children: [
          {
            path: '',
            element: <WithAuthTickets />
          },
          {
            path: 'add',
            element: <WithAuthTicketsAdd />
          },
          {
            path: 'edit/:id',
            element: <WithAuthTicketsEdit />
          }
        ]
      },
      {
        path: 'bus-flights',
        children: [
          {
            path: '',
            element: <WithAuthBusFlights />
          },
          {
            path: 'add',
            element: <WithAuthBusFlightsAdd />
          },
          {
            path: 'edit/:id',
            element: <WithAuthBusFlightsEdit />
          }
        ]
      }
    ]
  },
  {
    path: 'management',
    element: <SidebarLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="transactions" replace />
      },
      {
        path: 'transactions',
        element: <Transactions />
      },
      {
        path: 'profile',
        children: [
          {
            path: '',
            element: <Navigate to="details" replace />
          },
          {
            path: 'details',
            element: <UserProfile />
          },
          {
            path: 'settings',
            element: <UserSettings />
          }
        ]
      }
    ]
  },
  {
    path: '/components',
    element: <SidebarLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="buttons" replace />
      },
      {
        path: 'buttons',
        element: <Buttons />
      },
      {
        path: 'modals',
        element: <Modals />
      },
      {
        path: 'accordions',
        element: <Accordions />
      },
      {
        path: 'tabs',
        element: <Tabs />
      },
      {
        path: 'badges',
        element: <Badges />
      },
      {
        path: 'tooltips',
        element: <Tooltips />
      },
      {
        path: 'avatars',
        element: <Avatars />
      },
      {
        path: 'cards',
        element: <Cards />
      },
      {
        path: 'forms',
        element: <Forms />
      }
    ]
  }
];

export default routes;

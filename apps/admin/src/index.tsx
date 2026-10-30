import ReactDOM from 'react-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Provider as RTKProvider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import 'nprogress/nprogress.css';
import App from 'src/App';
import { SidebarProvider } from 'src/contexts/SidebarContext';
import * as serviceWorker from 'src/serviceWorker';
import { store } from './store';

ReactDOM.render(
  <HelmetProvider>
    <SidebarProvider>
      <BrowserRouter>
        <RTKProvider store={store}>
          <App />
        </RTKProvider>
      </BrowserRouter>
    </SidebarProvider>
  </HelmetProvider>,
  document.getElementById('root')
);

serviceWorker.unregister();

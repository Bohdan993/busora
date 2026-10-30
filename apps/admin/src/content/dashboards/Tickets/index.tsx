import { Helmet } from 'react-helmet-async';
import PageHeader from './PageHeader';
import PageTitleWrapper from 'src/components/PageTitleWrapper';
import { Grid, Container } from '@mui/material';
import Footer from 'src/components/Footer';

import TicketsComponent from './Tickets';

const DashboardsTickets = () => {
  return (
    <>
      <Helmet>
        <title>Сторінка квитків</title>
      </Helmet>
      <PageTitleWrapper>
        <PageHeader />
      </PageTitleWrapper>
      <Container maxWidth="xl">
        <Grid
          container
          direction="row"
          justifyContent="center"
          alignItems="stretch"
          spacing={3}
        >
          <Grid item xs={12}>
            <TicketsComponent />
          </Grid>
        </Grid>
      </Container>
      <Footer />
    </>
  );
};

export default DashboardsTickets;

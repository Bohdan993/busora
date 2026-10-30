import { Helmet } from 'react-helmet-async';
import PageHeader from './PageHeader';
import PageTitleWrapper from 'src/components/PageTitleWrapper';
import { Grid, Container } from '@mui/material';
import Footer from 'src/components/Footer';

import BusFlights from './BusFlights';

function DashboardsBusFlights() {
  return (
    <>
      <Helmet>
        <title>Сторінка рейсів</title>
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
            <BusFlights />
          </Grid>
        </Grid>
      </Container>
      <Footer />
    </>
  );
}

export default DashboardsBusFlights;

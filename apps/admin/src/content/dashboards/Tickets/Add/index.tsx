import { Helmet } from 'react-helmet-async';
// import PageHeader from './PageHeader';
import PageTitleWrapper from 'src/components/PageTitleWrapper';
import { Grid, Container } from '@mui/material';
import Footer from 'src/components/Footer';

// import Tickets from './Tickets';

function DashboardsTicketsAdd() {
  return (
    <>
      <Helmet>
        <title>Сторінка додавання квитка</title>
      </Helmet>
      <PageTitleWrapper>{/* <PageHeader /> */}</PageTitleWrapper>
      <Container maxWidth="xl">
        <Grid
          container
          direction="row"
          justifyContent="center"
          alignItems="stretch"
          spacing={3}
        >
          <Grid item xs={12}>
            {/* <Tickets /> */}
          </Grid>
        </Grid>
      </Container>
      <Footer />
    </>
  );
}

export default DashboardsTicketsAdd;

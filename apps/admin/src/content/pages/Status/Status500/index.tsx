import {
  Box,
  Typography,
  Hidden,
  Container,
  Button,
  Grid
} from '@mui/material';
import { Helmet } from 'react-helmet-async';

import { styled } from '@mui/material/styles';

const GridWrapper = styled(Grid)(
  ({ theme }) => `
    background: ${theme.colors.gradients.black1};
`
);

const MainContent = styled(Box)(
  () => `
    height: 100%;
    display: flex;
    flex: 1;
    overflow: auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
`
);

const TypographyPrimary = styled(Typography)(
  ({ theme }) => `
      color: ${theme.colors.alpha.white[100]};
`
);

const TypographySecondary = styled(Typography)(
  ({ theme }) => `
      color: ${theme.colors.alpha.white[70]};
`
);

function Status500() {
  // const [pending, setPending] = useState(false);
  // function handleClick() {
  //   setPending(true);
  // }

  return (
    <>
      <Helmet>
        <title>Status - 500</title>
      </Helmet>
      <MainContent>
        <Grid
          container
          sx={{ height: '100%' }}
          alignItems="stretch"
          spacing={0}
        >
          <Grid
            xs={12}
            md={6}
            alignItems="center"
            display="flex"
            justifyContent="center"
            item
          >
            <Container maxWidth="sm">
              <Box textAlign="center">
                <img
                  alt="500"
                  height={260}
                  src="/static/images/status/500.svg"
                />
                <Typography variant="h2" sx={{ my: 2 }}>
                  Сталася помилка, будь ласка, спробуйте ще раз пізніше.
                </Typography>
                <Typography
                  variant="h4"
                  color="text.secondary"
                  fontWeight="normal"
                  sx={{ mb: 4 }}
                >
                  Сервер зіткнувся з внутрішньою помилкою і не зміг завершити
                  ваш запит.
                </Typography>
                {/* <LoadingButton
                  onClick={handleClick}
                  loading={pending}
                  variant="outlined"
                  color="primary"
                  startIcon={<RefreshTwoToneIcon />}
                >
                  Refresh view
                </LoadingButton> */}
                {/* <Button href="/home" variant="contained" sx={{ ml: 1 }}>
                  Повернутися
                </Button> */}
              </Box>
            </Container>
          </Grid>
          <Hidden mdDown>
            <GridWrapper
              xs={12}
              md={6}
              alignItems="center"
              display="flex"
              justifyContent="center"
              item
            >
              <Container maxWidth="sm">
                <Box textAlign="center">
                  <TypographyPrimary variant="h1" sx={{ my: 2 }}>
                    Busreisen Адмін Панель
                  </TypographyPrimary>
                  {/* <TypographySecondary
                    variant="h4"
                    fontWeight="normal"
                    sx={{ mb: 4 }}
                  >
                    High performance React template built with lots of powerful
                    Material-UI components across multiple product niches for
                    fast &amp; perfect apps development processes.
                  </TypographySecondary> */}
                  <Button href="/home" size="large" variant="contained">
                    На головну
                  </Button>
                </Box>
              </Container>
            </GridWrapper>
          </Hidden>
        </Grid>
      </MainContent>
    </>
  );
}

export default Status500;

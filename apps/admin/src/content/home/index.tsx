import { Box, Container, Card } from '@mui/material';
import { Helmet } from 'react-helmet-async';

import { styled } from '@mui/material/styles';
import Logo from 'src/components/LogoSign';
import Hero from './Hero';

const HomeWrapper = styled(Box)(
  () => `
    overflow: auto;
    flex: 1;
    overflow-x: hidden;
    align-items: center;
`
);

function Home() {
  // const location = useLocation();
  // const navigate = useNavigate();
  // let redirect = (location.state as LocationState)?.redirect;

  // useEffect(()=>{
  //   if(redirect && redirect !== "/home") {
  //     navigate(redirect);
  //   }
  // }, [redirect]);
  return (
    <HomeWrapper>
      <Helmet>
        <title>Busora Адмін Панель</title>
      </Helmet>
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" py={5} alignItems="center">
          <Logo />
        </Box>
        <Card sx={{ p: 10, mb: 10, borderRadius: 12 }}>
          <Hero />
        </Card>
      </Container>
    </HomeWrapper>
  );
}

export default Home;

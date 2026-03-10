import React from 'react';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { styled } from '@mui/material/styles';
import { NavigateNext, Dashboard as DashboardIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const HeroBox = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #004F98 0%, #002D5B 100%)',
  height:"100px",
  padding: theme.spacing(8, 0),
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(5, 0),
    minHeight: '200px',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 40%)',
    pointerEvents: 'none',
  }
}));

interface PageHeroProps {
  title: string;
  subtitle?: string;
  showBreadcrumbs?: boolean;
}

const PageHero: React.FC<PageHeroProps> = ({ title, subtitle, showBreadcrumbs = true }) => {
  const navigate = useNavigate();

  return (
    <HeroBox>
      <Container maxWidth="xl">
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 600, 
              mb:1, 
              letterSpacing: '-0.02em',
              fontSize: { xs: '2.2rem', md: '3rem' }
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography 
              variant="h6" 
              sx={{ 
                opacity: 0.9, 
                fontWeight: 100, 
                maxWidth: 700, 
                mx: 'auto', 
                mb: 2,
                fontSize: { xs: '1rem', md: '1rem' }
              }}
            >
              {subtitle}
            </Typography>
          )}
          
          {showBreadcrumbs && (
            <Breadcrumbs 
              separator={<NavigateNext fontSize="small" sx={{ color: 'rgba(255,255,255,0.6)' }} />}
              sx={{ justifyContent: 'center', display: 'flex', color: 'white' }}
            >
              <Link
                underline="hover"
                color="inherit"
                href="/"
                onClick={(e) => { e.preventDefault(); navigate('/admin'); }}
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  opacity: 0.8,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  '&:hover': { opacity: 1 }
                }}
              >
                <DashboardIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Dashboard
              </Link>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>
                {title}
              </Typography>
            </Breadcrumbs>
          )}
        </Box>
      </Container>
    </HeroBox>
  );
};

export default PageHero;

import React, { useState, type KeyboardEvent, type ChangeEvent, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  Fade,
  Stack,
  useTheme,
  useMediaQuery,
  Grid,
  Avatar
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  AdminPanelSettings,
  Business,
  Security,
  VerifiedUser,
  LoginOutlined,
  KeyOutlined
} from '@mui/icons-material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { styled, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import authManager from '../services/authSession';
import Logo from "../assets/images/logo.png";
import LoginImg from "../assets/images/warehouse.png"

/* -------------------- ANIMATIONS -------------------- */

const float = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
`;

const shine = keyframes`
  0% { left: -100%; }
  100% { left: 100%; }
`;

/* -------------------- STYLED COMPONENTS -------------------- */

const LoginRoot = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #004F98 0%, #001A33 100%)',
  padding: theme.spacing(2),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)`,
    backgroundSize: '32px 32px',
    zIndex: 0,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(25, 118, 210, 0.1) 0%, transparent 70%)',
    top: '-300px',
    right: '-100px',
    borderRadius: '50%',
    zIndex: 0,
  }
}));

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: 32,
  width: '100%',
  maxWidth: 1000,
  display: 'flex',
  overflow: 'hidden',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  zIndex: 1,
  [theme.breakpoints.down('md')]: {
    maxWidth: '95%',
    flexDirection: 'column',
    borderRadius: 24,
  }
}));

const VisualSection = styled(Box)(({ theme }) => ({
  flex: 1,
  background: 'linear-gradient(135deg, #004F98 0%, #1976D2 100%)',
  backgroundImage:`url(${LoginImg})`,
  padding: theme.spacing(6),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '300px',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(4, 2),
    textAlign: 'center',
    minHeight: 'auto',
  }
}));

const FormSection = styled(Box)(({ theme }) => ({
  maxHeight:'50vh',
  flex: 1.2,
  padding: theme.spacing(8, 6),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  backgroundColor: '#ffffff',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(5, 3),
  }
}));

const LogoAvatar = styled(Avatar)(({ theme }) => ({
  width: 100,
  height: 100,
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(10px)',
  marginBottom: theme.spacing(4),
  animation: `${float} 6s ease-in-out infinite`,
  border: '1px solid rgba(255, 255, 255, 0.2)',
  '& .MuiSvgIcon-root': {
    fontSize: 50,
  }
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 16,
    transition: 'all 0.3s ease',
    '& fieldset': {
      borderColor: 'rgba(0, 79, 152, 0.1)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(0, 79, 152, 0.3)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#004F98',
      borderWidth: '2px',
    },
    '&.Mui-focused': {
      backgroundColor: 'rgba(0, 79, 152, 0.01)',
    }
  },
  '& .MuiInputLabel-root': {
    color: '#64748B',
    '&.Mui-focused': {
      color: '#004F98',
    }
  }
}));



const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: 16,
  padding: theme.spacing(1.8),
  fontSize: '1rem',
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: '0 8px 16px rgba(0, 79, 152, 0.2)',
  overflow: 'hidden',
  position: 'relative',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 24px rgba(0, 79, 152, 0.3)',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    width: '50%',
    height: '100%',
    background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent)',
    animation: `${shine} 3s infinite`,
  }
}));



/* -------------------- COMPONENT -------------------- */

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const loggedIn = await authManager.isLoggedIn();
      if (loggedIn) {
        navigate('/admin');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e?: React.FormEvent): Promise<void> => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!email || !password) {
      setError('Required: Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await api.login(email, password);

      if (result.success) {
        if (result.user?.role !== 'admin') {
          setError('Access Restricted: Only administrators can access this portal.');
          await api.logout();
          return;
        }
        navigate('/admin');
      } else {
        setError(result.message || 'Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Network unreachable. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginRoot>
      <Fade in={true} timeout={1000}>
        <StyledPaper elevation={0} >
          {/* Visual Branding Section */}
          <VisualSection >
            <LogoAvatar>
              <Box
               component="img"
               src={Logo}
               alt="PAS Logo"
               sx={{
                 height: { md:80 }, 
                 objectFit: "contain"
               }}
             />
            </LogoAvatar>
            <Typography variant="h3" fontWeight={800} >
              PAS  
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.7, mb: 4, textAlign: 'center', fontWeight: 500,textDecoration:'underline'}}>
              Parts Auditing System
            </Typography>
          <Stack spacing={2} sx={{ width: '100%', maxWidth: 300 }}>
              {/*<Box sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'rgba(255,255,255,0.1)', p: 1.5, borderRadius: 3 }}>
                <VerifiedUser sx={{ color: '#4ADE80' }} />
                <Typography variant="body2">Secure Enterprise Access</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'rgba(255,255,255,0.1)', p: 1.5, borderRadius: 3 }}>
                <Security sx={{ color: '#FCD34D' }} />
                <Typography variant="body2">End-to-End Encryption</Typography>
              </Box>*/}
            </Stack>
          </VisualSection>

          {/* Form Section */}
          <FormSection>
            <Box mb={4}>
  <Typography
    variant="h4"
    fontWeight={500}
    color="#004F98"
    sx={{
      textAlign: 'center',
      mb: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1
    }}
  >
    
    Login
    <LockOutlinedIcon fontSize="medium" />
  </Typography>

  <Typography
    color="text.secondary"
    sx={{
      textAlign: 'center',
      fontSize: '13px',
      textDecoration: 'underline'
    }}
  >
    Enter your credentials to manage inventory
  </Typography>
</Box>


            <form onSubmit={handleLogin}>
              <Stack spacing={3.5}>
                <StyledTextField
                  fullWidth
                  label="Administrator Email"
                  placeholder="Hello@focus.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email sx={{ color: '#94A3B8' }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <StyledTextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock sx={{ color: '#94A3B8' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#94A3B8' }}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {error && (
                  <Fade in={!!error}>
                    <Alert 
                      severity="error" 
                      variant="outlined" 
                      sx={{ 
                        borderRadius: 3,
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                        bgcolor: 'rgba(239, 68, 68, 0.02)',
                        color: '#EF4444'
                      }}
                    >
                      {error}
                    </Alert>
                  </Fade>
                )}
                <Box mt={-10} pt={0} sx={{  textAlign:'right' }}>
              <Typography variant="body2" color="text.disabled" sx={{ display: 'flex', alignItems: 'right', justifyContent: 'right', gap: 0.5,fontSize:'11px',marginTop:'-14px'  }}>
                 <Typography
                 sx={{textDecoration:'underline',fontSize:'11px'}}>Forgot password? </Typography>Contact system administrator 
              </Typography>
            </Box>

                <ActionButton
                  fullWidth
                  size="large"
                  variant="contained"
                  type="submit"
                  disabled={loading || !email || !password}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginOutlined />}
                >
                  {loading ? 'Authenticating...' : 'Enter System'}
                </ActionButton>
              </Stack>
            </form>

            {/*<Box mt={6} pt={3} sx={{ borderTop: '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <Typography variant="body2" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <KeyOutlined fontSize="small" />*/}
                {/*Forgot password? Contact system administrator Allrights reserved to Focus
              </Typography>
            </Box>
            */}
            <Box
  mt={4}
  pt={3}
  sx={{
    borderTop: '1px solid rgba(0,0,0,0.05)',
    textAlign: 'center',

  }}
>
  <Typography
    variant="body2"
    
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      fontSize:'12px',
      color:'rgba(10, 42, 72, 0.68)'
    }}
  >
    © {new Date().getFullYear()} Focus Engineering. All rights reserved. | PAS
  </Typography>
</Box>

          </FormSection>
        </StyledPaper>
      </Fade>
    </LoginRoot>
  );
};

export default LoginPage;

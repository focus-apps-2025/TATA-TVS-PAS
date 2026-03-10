// src/component/AdminLoginModal.tsx
import React, { useState, type KeyboardEvent, type ChangeEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  Button,
  Alert,
  CircularProgress,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  Divider,
  Paper
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AdminPanelSettings,
  Email,
  Lock,
  Close,
  Security
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../../services/api';

/* -------------------- TYPES -------------------- */

interface AdminLoginModalProps {
  open: boolean;
  onClose?: () => void;
  onLoginSuccess: () => void;
  adminOnly?: boolean;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    role: string;
  };
}

/* -------------------- STYLES -------------------- */

const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialog-paper': {
    borderRadius: 20,
    padding: 0,
    background: '#ffffff',
    boxShadow:
      '0 24px 48px rgba(0, 79, 152, 0.15), 0 12px 24px rgba(0, 79, 152, 0.1)',
    border: '1px solid rgba(0, 79, 152, 0.08)',
    overflow: 'hidden',
    minHeight: '400px'
  }
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  background:
    'linear-gradient(135deg, #004F98 0%, #003875 50%, #002952 100%)',
  color: 'white',
  padding: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #0066CC 0%, #004F98 100%)'
  }
}));

const LoginButton = styled(Button)(({ theme }) => ({
  background: '#004F98',
  borderRadius: 12,
  padding: theme.spacing(1.5, 4),
  fontWeight: 600,
  textTransform: 'none',
  fontSize: 16,
  color: 'white',
  minHeight: 48,
  boxShadow: '0 4px 12px rgba(0, 79, 152, 0.3)',
  '&:hover': {
    background: 'linear-gradient(135deg, #003875 0%, #002952 100%)',
    transform: 'translateY(-2px)'
  }
}));

const CancelButton = styled(Button)(({ theme }) => ({
  borderColor: '#004F98',
  color: '#004F98',
  borderRadius: 12,
  padding: theme.spacing(1.5, 4),
  textTransform: 'none',
  fontSize: 16,
  fontWeight: 600,
  minHeight: 48
}));

const StyledTextField = styled(TextField)(() => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 12,
    backgroundColor: '#fafbfc'
  }
}));

const HeaderIcon = styled(Box)(() => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: 'rgba(255,255,255,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}));

/* -------------------- COMPONENT -------------------- */

const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  open,
  onClose,
  onLoginSuccess,
  adminOnly = false
}) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result: LoginResponse = await api.login(email, password);

      if (!result.success) {
        setError(result.message ?? 'Login failed');
        return;
      }

      if (adminOnly && result.user?.role !== 'admin') {
        setError('Access denied. Admin privileges required.');
        await api.logout();
        return;
      }

      onLoginSuccess();
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleClose = (): void => {
    onClose ? onClose() : (window.location.href = '/');
  };

  return (
    <StyledDialog open={open} maxWidth="sm" fullWidth>
      <StyledDialogTitle>
        <HeaderIcon>
          <Security sx={{ fontSize: 28 }} />
        </HeaderIcon>

        <Box sx={{ flexGrow: 1 }}>
          <Typography fontWeight={700} fontSize={28}>
            {adminOnly ? 'Admin Portal' : 'Admin Dashboard'}
          </Typography>
          <Typography sx={{ fontSize: 14, opacity: 0.9 }}>
            Secure access to administrative controls
          </Typography>
        </Box>

        <IconButton onClick={handleClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </StyledDialogTitle>

      <DialogContent sx={{ p: 4 }}>
        <Box display="flex" flexDirection="column" gap={3}>
          <StyledTextField
            label="Email Address"
            type="email"
            fullWidth
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            onKeyPress={handleKeyPress}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email />
                </InputAdornment>
              )
            }}
          />

          <StyledTextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
            onKeyPress={handleKeyPress}
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(v => !v)}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ justifyContent: 'center', gap: 2 }}>
        <CancelButton onClick={handleClose} disabled={loading}>
          Cancel
        </CancelButton>

        <LoginButton
          onClick={handleLogin}
          disabled={loading || !email || !password}
          startIcon={
            loading ? <CircularProgress size={20} /> : <AdminPanelSettings />
          }
        >
          {loading ? 'Authenticating…' : 'Sign In'}
        </LoginButton>
      </DialogActions>
    </StyledDialog>
  );
};

export default AdminLoginModal;

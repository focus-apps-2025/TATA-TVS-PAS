// components/LoadingOverlay.tsx
import React from 'react';
import { Backdrop, CircularProgress, Typography } from '@mui/material';

interface LoadingOverlayProps {
  open: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ open, message }) => {
  return (
    <Backdrop
      sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 9999 }}
      open={open}
    >
      <CircularProgress color="inherit" />
      {message && (
        <Typography variant="h6" sx={{ ml: 2 }}>
          {message}
        </Typography>
      )}
    </Backdrop>
  );
};

export default LoadingOverlay;
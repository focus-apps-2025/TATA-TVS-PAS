import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import AdminNavbar from '../components/layout/AdminNavbar';
import authManager from '../services/authSession';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const loggedIn = await authManager.isLoggedIn();
      if (!loggedIn) {
        navigate('/login');
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleRefresh = () => {
    // Emit a custom event that pages can listen to for refreshing data
    window.dispatchEvent(new CustomEvent('admin-refresh'));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <AdminNavbar handleRefresh={handleRefresh} />
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          overflow: 'auto'
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;

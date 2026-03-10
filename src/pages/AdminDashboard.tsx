import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Avatar,
  Button,
  Divider,
  Chip,
  LinearProgress,
  Stack,
  useMediaQuery,
  SvgIcon,
} from '@mui/material';

type SvgIconComponent = typeof SvgIcon;
import { useTheme, styled } from '@mui/material/styles';
import {
  People as PeopleIcon,
  Group as GroupsIcon,
  Description as DescriptionIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle,
  Business,
  Phone,
  Email,
  LocationOn,
  Schedule,
  Analytics as AnalyticsIcon,
  FlashOn as QuickActionIcon,
  Dns as MasterDataIcon,
  Assessment as ReportIcon,
  Shield as AdminShieldIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import api from '../services/api';
import authManager from '../services/authSession';
import ProfessionalCard from '../components/common/ProfessionalCard';
import StatsCard from '../components/common/StatsCard';

interface ManagementTool {
  title: string;
  description: string;
  icon: SvgIconComponent;
  color: string;
  bgColor: string;
  path: string;
  status?: string;
}

// Type definitions
interface DashboardStats {
  users: number;
  teams: number;
  totalRacks: number;
  masterItems: number;
}

interface UserProfile {
  name?: string;
  [key: string]: any;
}

// --- Styled Components ---
const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #004F98 0%, #002D5B 100%)',
  minHeight: '320px',
  padding: theme.spacing(12, 0),
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(8, 0),
    minHeight: '260px',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    left: '-10%',
    width: '120%',
    height: '200%',
    background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 40%)',
    animation: 'pulse 15s infinite alternate',
    pointerEvents: 'none',
  },
  '@keyframes pulse': {
    '0%': { transform: 'scale(1) rotate(0deg)' },
    '100%': { transform: 'scale(1.1) rotate(2deg)' }
  }
}));

const FloatingIcon = styled(Box)(({ theme }) => ({
  position: 'absolute',
  opacity: 0.1,
  color: 'white',
  zIndex: 0,
  animation: 'float 6s infinite ease-in-out',
  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0)' },
    '50%': { transform: 'translateY(-20px)' }
  }
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginBottom: theme.spacing(4),
  '& .line': {
    flexGrow: 1,
    height: '2px',
    background: 'linear-gradient(to right, #E2E8F0, transparent)',
    marginRight: theme.spacing(2)
  },
  '& .line-right': {
    flexGrow: 1,
    height: '2px',
    background: 'linear-gradient(to left, #E2E8F0, transparent)',
    marginLeft: theme.spacing(2)
  }
}));

const ActionCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  borderRadius: '16px',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  border: '1px solid #F1F5F9',
  '&:hover': {
    transform: 'translateX(8px)',
    boxShadow: '0 10px 25px rgba(0, 79, 152, 0.08)',
    borderColor: '#004F98',
    '& .action-icon': {
      backgroundColor: '#004F98',
      color: 'white',
    }
  }
}));

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State variables
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats>({ 
    users: 0, 
    teams: 0,
    totalRacks: 0,
    masterItems: 0
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const managementTools: ManagementTool[] = [
    {
      title: 'User Management',
      description: 'Manage users, roles and permissions',
      icon: PeopleIcon,
      color: '#004F98',
      bgColor: 'rgba(0, 79, 152, 0.08)',
      path: '/admin/users',
      status: 'Active'
    },
    {
      title: 'Team Management',
      description: 'Organize auditing teams and assignments',
      icon: GroupsIcon,
      color: '#10B981',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      path: '/admin/teams',
      status: 'Updated'
    },
    {
      title: 'Master Descriptions',
      description: 'Centralized repository for part details',
      icon: DescriptionIcon,
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.08)',
      path: '/admin/master-desc',
      status: 'Configured'
    },
    {
      title: 'Reports & Analytics',
      description: 'Comprehensive auditing performance reports',
      icon: AnalyticsIcon,
      color: '#8B5CF6',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      path: '/admin/reports',
      status: 'Ready'
    }
  ];

  const quickActions = [
    { title: 'Create New Team', icon: GroupsIcon, path: '/admin/teams?action=new', color: '#3B82F6' },
    { title: 'Upload Master Data', icon: DescriptionIcon, path: '/admin/master-desc', color: '#10B981' },
    { title: 'Generate Report', icon: AnalyticsIcon, path: '/admin/reports', color: '#F59E0B' },
    { title: 'Audit Logs', icon: AdminShieldIcon, path: '/admin', color: '#6366F1' },
  ];

  useEffect(() => {
    loadDashboardData();
    loadUserProfile();
    
    const handleRefreshEvent = () => {
      handleRefresh();
    };
    window.addEventListener('admin-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('admin-refresh', handleRefreshEvent);
    };
  }, []);

  const loadDashboardData = async (): Promise<void> => {
    try {
      setIsDataLoading(true);
      const [users, teams, racks, masterData] = await Promise.all([
        api.getAllUsers(),
        api.getTeams(),
        api.getRacks({ limit: 1 }),
        api.getUploadedFilesMetadata()
      ]);
      setStats({
        users: users?.length || 0,
        teams: teams?.length || 0,
        totalRacks: racks?.totalCount || 0,
        masterItems: (masterData as any)?.data?.length || 0
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsDataLoading(false);
    }
  };

  const loadUserProfile = async (): Promise<void> => {
    try {
      const user = await authManager.getCurrentUser();
      setUserProfile(user);
    } catch (error) {
      console.error("Failed to load user profile for dashboard:", error);
    }
  };

  const handleRefresh = (): void => {
    loadDashboardData();
    loadUserProfile();
  };

  const handleNavigation = (path: string): void => {
    navigate(path);
  };

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#F8FAFC' }}>
      {/* Hero Section */}
      <HeroSection>
        {/* Decorative Floating Icons */}
        <FloatingIcon sx={{ top: '15%', left: '10%' }}>
          <ReportIcon sx={{ fontSize: 80 }} />
        </FloatingIcon>
        <FloatingIcon sx={{ bottom: '20%', left: '25%', animationDelay: '1s' }}>
          <GroupsIcon sx={{ fontSize: 60 }} />
        </FloatingIcon>
        <FloatingIcon sx={{ top: '25%', right: '15%', animationDelay: '2s' }}>
          <MasterDataIcon sx={{ fontSize: 70 }} />
        </FloatingIcon>
        <FloatingIcon sx={{ bottom: '15%', right: '5%', animationDelay: '3s' }}>
          <AdminShieldIcon sx={{ fontSize: 90 }} />
        </FloatingIcon>

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container alignItems="center" spacing={4}>
            <Grid size={{ xs: 12, md: 16 }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 900,
                  mb: 2,
                  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
                  lineHeight: 1.1,
                  textShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                Welcome back,<br />
                <Box component="span" sx={{ color: '#10B981' }}>{userProfile?.name?.split(' ')[0] || 'Admin'}</Box>
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  mb: 4,
                  opacity: 0.9,
                  fontWeight: 400,
                  maxWidth: 600,
                  fontSize: { xs: '1rem', md: '1.25rem' },
                  lineHeight: 1.6
                }}
              >
                Manage your auditing ecosystem with precision. Track performance, coordinate teams, and maintain master data integrity.
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Chip
                  icon={<Schedule sx={{ fontSize: 18, color: 'white !important' }} />}
                  label={`Today: ${new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}`}
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    fontWeight: 700,
                    px: 1,
                    height: 36,
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '0.9rem'
                  }}
                />
                <Button 
                  variant="contained" 
                  onClick={handleRefresh}
                  startIcon={<RefreshIcon />}
                  sx={{ 
                    bgcolor: 'white', 
                    color: '#004F98',
                    fontWeight: 700,
                    borderRadius: '12px',
                    px: 3,
                    height: 36,
                    '&:hover': { bgcolor: '#F1F5F9' }
                  }}
                >
                  Sync Data
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </HeroSection>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: -6, pb: 8, position: 'relative', zIndex: 2 }}>
        
        {/* Statistics Section */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatsCard 
              title="Total Users"
              value={stats.users}
              icon={PeopleIcon}
              color="#004F98"
              trend="+12%"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatsCard 
              title="Active Teams"
              value={stats.teams}
              icon={GroupsIcon}
              color="#10B981"
              trend="+3"
            />
          </Grid>
         
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatsCard 
              title="Master Items"
              value={stats.masterItems}
              icon={DescriptionIcon}
              color="#F59E0B"
              trend="Sync"
            />
          </Grid>
        </Grid>

        {/* Management Tools Section */}
        <Box sx={{ mb: { xs: 4, md: 6 } }}>
          <Stack 
            direction="row" 
            alignItems="center" 
            justifyContent="center" 
            spacing={2} 
            sx={{ mb: 4 }}
          >
            <Divider sx={{ flexGrow: 1, borderColor: '#E2E8F0' }} />
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: '#1E293B',
                letterSpacing: '-0.5px',
                textAlign: 'center',
                px: 2
              }}
            >
              Management Console
            </Typography>
            <Divider sx={{ flexGrow: 1, borderColor: '#E2E8F0' }} />
          </Stack>

          <Grid container spacing={3}>
            {managementTools.map((tool, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={index}>
                <ProfessionalCard
                  onClick={() => handleNavigation(tool.path)}
                  sx={{ cursor: 'pointer', height: '100%' }}
                >
                  <CardContent sx={{ p: 3, textAlign: 'center' }}>
                    <Avatar
                      sx={{
                        bgcolor: tool.bgColor,
                        color: tool.color,
                        width: 64,
                        height: 64,
                        mx: 'auto',
                        mb: 2,
                        boxShadow: `0 4px 12px ${tool.color}20`
                      }}
                    >
                      <tool.icon sx={{ fontSize: 32 }} />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#1E293B' }}>
                      {tool.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tool.description}
                    </Typography>
                  </CardContent>
                </ProfessionalCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>

      {/* Professional Footer */}
      <Box sx={{
        bgcolor: '#1F2937',
        color: 'white',
        py: { xs: 3, md: 4 },
        mt: { xs: 4, md: 6 }
      }}>
        <Container maxWidth="lg">
          <Grid container spacing={isMobile ? 2 : 3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 2 } }}>
                <Business sx={{ fontSize: { xs: 22, md: 24 }, mr: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                  Parts Auditing System
                </Typography>
              </Box>
              <Typography variant="body2" sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                mb: { xs: 1.5, md: 2 },
                fontSize: { xs: '0.75rem', md: '0.8rem' }
              }}>
                Professional management platform for modern businesses. Streamline operations, enhance productivity, and drive growth.
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckCircle sx={{ color: '#10B981', mr: 1, fontSize: { xs: 14, md: 16 } }} />
                <Typography variant="body2" sx={{
                  color: '#10B981',
                  fontWeight: 600,
                  fontSize: { xs: '0.75rem', md: '0.8rem' }
                }}>
                  System Status: Online
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: { xs: 1.5, md: 2 }, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                Quick Links
              </Typography>
              <Stack spacing={isMobile ? 0.5 : 1}>
                {managementTools.map((tool) => (
                  <Typography
                    key={tool.path}
                    variant="body2"
                    onClick={() => handleNavigation(tool.path)}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      cursor: 'pointer',
                      '&:hover': { color: 'white' },
                      fontSize: { xs: '0.75rem', md: '0.8rem' }
                    }}
                  >
                    {tool.title}
                  </Typography>
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: { xs: 1.5, md: 2 }, fontSize: { xs: '1rem', md: '1.1rem' } }}>
                Contact Information
              </Typography>
              <Stack spacing={isMobile ? 0.5 : 1}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Email sx={{ mr: 1.5, fontSize: { xs: 14, md: 16 }, color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.75rem', md: '0.8rem' } }}>
                    focusenggapps@gmail.com
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Phone sx={{ mr: 1.5, fontSize: { xs: 14, md: 16 }, color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.75rem', md: '0.8rem' } }}>
                    +91 9047878224
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocationOn sx={{ mr: 1.5, fontSize: { xs: 14, md: 16 }, color: 'rgba(255, 255, 255, 0.7)' }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.75rem', md: '0.8rem' } }}>
                    Gudiyatham, Vellore, Tamil Nadu, India, 632602.
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: { xs: 2.5, md: 3 } }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
              © {new Date().getFullYear()} Parts Auditing System. All rights reserved. Professional Management Platform
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default AdminDashboard;
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  TextField,
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
  CalendarMonth as CalendarMonthIcon,
  ContentCopy as ContentCopyIcon,
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
  currentSites: number;
  totalTeamMembers: number;
  presentStaff: number;
  absentStaff: number;
  totalRacks: number;
  masterItems: number;
}

interface UserProfile {
  name?: string;
  [key: string]: any;
}

interface DailyActivityMember {
  id: string;
  name: string;
  email: string;
  role: string;
  scanCount: number;
}

interface DailyActivityTeam {
  teamId: string;
  teamName: string;
  auditType: string;
  location: string;
  totalScans: number;
  members: DailyActivityMember[];
}

const auditSubcategoryCards = ['TATA Commercial', 'TATA Accessories', 'TVS 2W', '3W TVS'];
const auditChartColors = ['#1665B5', '#16A36A', '#F59E0B', '#EA5A5A'];
const stateChartColors = ['#9DBDEB', '#93DCCD', '#FFD18D', '#CDBEEF', '#FFAAA5', '#A7D7F5'];
const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const currentIndiaDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const belongsToMonth = (record: any, month: string) => {
  const rawDate = String(record.quoteDate || record.startingDate || record.createdAt || '');
  if (rawDate.startsWith(month)) return true;
  const match = rawDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return Boolean(match && `${match[3]}-${String(match[2]).padStart(2, '0')}` === month);
};
const countAuditTypes = (records: any[]) => {
  const grouped = records.reduce((counts: Record<string, number>, record) => {
    const auditType = String(record.auditType || '').trim();
    const subcategory = String(record.subcategory || '').trim();
    const label = subcategory
      ? (auditType === '3w-tvs' || (auditType === 'TVS' && subcategory.toUpperCase() === '3W') ? '3W TVS' : auditType === 'TVS' ? `TVS ${subcategory}` : subcategory)
      : (auditType === '3w-tvs' ? '3W TVS' : auditType || 'Not specified');
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});

  const knownCards = auditSubcategoryCards.map((label) => ({ label, count: grouped[label] || 0 }));
  const extraCards = Object.entries(grouped)
    .filter(([label]) => !auditSubcategoryCards.includes(label))
    .map(([label, count]) => ({ label, count }));
  return [...knownCards, ...extraCards];
};
const parseDashboardDate = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}` : null;
};
const isWithinDashboardRange = (record: any, from: string, to: string, fields: string[]) => {
  const date = fields.map((field) => parseDashboardDate(record?.[field])).find(Boolean);
  return Boolean(date && date >= from && date <= to);
};

const AuditStatePie: React.FC<{ title: string; records: any[]; loading: boolean }> = ({ title, records, loading }) => {
  const segments = Object.entries(records.reduce((groups: Record<string, number>, record) => {
    const state = String(record.state || 'Not specified').trim() || 'Not specified';
    groups[state] = (groups[state] || 0) + 1;
    return groups;
  }, {})).map(([label, count]) => ({ label, count }));
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  let progress = 0;
  const background = total ? `conic-gradient(${segments.map((segment, index) => {
    const start = (progress / total) * 100;
    progress += segment.count;
    return `${stateChartColors[index % stateChartColors.length]} ${start}% ${(progress / total) * 100}%`;
  }).join(', ')})` : '#E2E8F0';
  return <Paper elevation={0} sx={{ p: 2.5, height: '100%', border: '1px solid #E2E8F0', borderRadius: 3 }}>
    <Typography fontWeight={800} color="#172B4D">{title}</Typography>
    <Typography variant="body2" color="text.secondary">State-wise distribution</Typography>
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-around" spacing={2} sx={{ pt: 2 }}>
      <Box sx={{ width: 156, height: 156, borderRadius: '50%', p: '13px', background, flexShrink: 0 }}><Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center' }}><Box><Typography variant="h5" fontWeight={800}>{loading ? '—' : total}</Typography><Typography variant="caption" color="text.secondary">records</Typography></Box></Box></Box>
      <Stack spacing={0.85} sx={{ width: { xs: '100%', sm: 170 } }}>{segments.map((segment, index) => <Stack key={segment.label} direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: stateChartColors[index % stateChartColors.length] }} /><Typography variant="body2" fontWeight={700}>{segment.label}</Typography></Stack><Typography variant="body2" fontWeight={800}>{loading ? '—' : `${segment.count} · ${total ? Math.round((segment.count / total) * 100) : 0}%`}</Typography></Stack>)}</Stack>
    </Stack>
  </Paper>;
};

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
  const dashboardCaptureRef = useRef<HTMLDivElement>(null);

  // State variables
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<DashboardStats>({ 
    users: 0, 
    teams: 0,
    currentSites: 0,
    totalTeamMembers: 0,
    presentStaff: 0,
    absentStaff: 0,
    totalRacks: 0,
    masterItems: 0
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [teamsByAuditType, setTeamsByAuditType] = useState<{ label: string; count: number }[]>(countAuditTypes([]));
  const [followUpRecords, setFollowUpRecords] = useState<any[]>([]);
  const [completionRecords, setCompletionRecords] = useState<any[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityTeam[]>([]);
  const [fromDate, setFromDate] = useState(currentIndiaDate());
  const [toDate, setToDate] = useState(currentIndiaDate());
  const [appliedRange, setAppliedRange] = useState({ from: currentIndiaDate(), to: currentIndiaDate() });
  const [copyingDashboard, setCopyingDashboard] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const isSiteManager = userProfile?.role === 'site_manager';

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
  ].filter((tool) => {
    if (isSiteManager) return tool.title === 'Team Management';
    if (userProfile?.role === 'team_leader') return tool.title !== 'User Management' && tool.title !== 'Master Descriptions';
    return true;
  });

  const quickActions = [
    { title: 'Create New Team', icon: GroupsIcon, path: '/admin/teams?action=new', color: '#3B82F6' },
    { title: 'Upload Master Data', icon: DescriptionIcon, path: '/admin/master-desc', color: '#10B981' },
    { title: 'Generate Report', icon: AnalyticsIcon, path: '/admin/reports', color: '#F59E0B' },
    { title: 'Audit Logs', icon: AdminShieldIcon, path: '/admin', color: '#6366F1' },
  ].filter(() => {
    if (isSiteManager) return false;
    if (userProfile?.role === 'team_leader') return false;
    return true;
  });

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

  const loadDashboardData = async (from = appliedRange.from, to = appliedRange.to): Promise<void> => {
    try {
      setIsDataLoading(true);
      const currentUser = await authManager.getCurrentUser();
      const siteManagerMode = currentUser?.role === 'site_manager';
      const [users, teams, racks, masterData, followUps, completions, activity, attendance] = await Promise.all([
        siteManagerMode ? Promise.resolve([]) : api.getAllUsers().catch(() => []),
        api.getTeams().catch(() => []),
        api.getRacks({ limit: 1 }).catch(() => ({ totalCount: 0 })),
        siteManagerMode ? Promise.resolve({ data: [] }) : api.getUploadedFilesMetadata().catch(() => ({ data: [] })),
        api.getAuditFollowUps().catch(() => ({ data: [] })),
        api.getAuditCompletions().catch(() => ({ data: [] })),
        siteManagerMode ? Promise.resolve({ data: [] }) : api.getDailyTeamActivity(from, to).catch(() => ({ data: [] })),
        siteManagerMode ? Promise.resolve({ summary: { totalStaff: 0, present: 0, absent: 0 } }) : api.getTeamAttendance({ from, to }).catch(() => ({ summary: { totalStaff: 0, present: 0, absent: 0 } }))
      ]);
      setStats({
        users: users?.length || 0,
        teams: teams?.length || 0,
        currentSites: (teams || []).filter((team: any) => isWithinDashboardRange(team, currentIndiaDate(), currentIndiaDate(), ['auditStartDate', 'createdAt'])).length,
        totalTeamMembers: (attendance as any)?.summary?.totalStaff || 0,
        presentStaff: (attendance as any)?.summary?.present || 0,
        absentStaff: (attendance as any)?.summary?.absent || 0,
        totalRacks: racks?.totalCount || 0,
        masterItems: siteManagerMode ? 0 : (masterData as any)?.data?.length || 0
      });
      setTeamsByAuditType(countAuditTypes((teams || []).filter((team: any) => isWithinDashboardRange(team, from, to, ['auditStartDate', 'createdAt']))));
      setFollowUpRecords(((followUps as any)?.data || []).filter((record: any) => isWithinDashboardRange(record, from, to, ['quoteDate', 'createdAt'])));
      setCompletionRecords(((completions as any)?.data || []).filter((record: any) => isWithinDashboardRange(record, from, to, ['startingDate', 'endDate', 'createdAt'])));
      setDailyActivity((activity as any)?.data || []);
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

  const applyDateRange = (): void => {
    if (!fromDate || !toDate || fromDate > toDate) return;
    setAppliedRange({ from: fromDate, to: toDate });
    loadDashboardData(fromDate, toDate);
  };

  const resetDateRange = (): void => {
    const today = currentIndiaDate();
    setFromDate(today);
    setToDate(today);
    setAppliedRange({ from: today, to: today });
    loadDashboardData(today, today);
  };

  const copyDashboardImage = async (): Promise<void> => {
    if (!dashboardCaptureRef.current || copyingDashboard) return;
    setCopyingDashboard(true);
    setCopyFeedback('');
    try {
      const canvas = await html2canvas(dashboardCaptureRef.current, {
        backgroundColor: '#F8FAFC',
        scale: 2,
        useCORS: true,
        windowWidth: dashboardCaptureRef.current.scrollWidth,
        windowHeight: dashboardCaptureRef.current.scrollHeight,
      });
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!image || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image copy is not supported in this browser.');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
      setCopyFeedback('Dashboard image copied');
    } catch (error) {
      console.error('Unable to copy dashboard image:', error);
      setCopyFeedback('Unable to copy image');
    } finally {
      setCopyingDashboard(false);
    }
  };

  const handleNavigation = (path: string): void => {
    navigate(path);
  };

  return (
    <Box ref={dashboardCaptureRef} sx={{ flexGrow: 1, bgcolor: '#F8FAFC' }}>
      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 3, border: '1px solid #DCE6F3', borderRadius: 3, bgcolor: 'rgba(255,255,255,0.98)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: { md: 1 } }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: '#E7F0FC', color: '#0059A8' }}><CalendarMonthIcon fontSize="small" /></Avatar>
              <Box><Typography fontWeight={800} color="#172B4D">Dashboard period</Typography><Typography variant="caption" color="text.secondary">Filter audit analytics and scan activity</Typography></Box>
            </Stack>
            <TextField label="From" type="date" size="small" value={fromDate} onChange={(event) => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: { md: 165 } }} />
            <TextField label="To" type="date" size="small" value={toDate} onChange={(event) => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: fromDate }} sx={{ minWidth: { md: 165 } }} />
            <Button variant="contained" onClick={applyDateRange} disabled={!fromDate || !toDate || fromDate > toDate} sx={{ minWidth: 100, fontWeight: 800 }}>Apply</Button>
            <Button variant="text" onClick={resetDateRange} sx={{ minWidth: 86, fontWeight: 700 }}>Today</Button>
            <Button data-html2canvas-ignore="true" variant="outlined" onClick={copyDashboardImage} disabled={copyingDashboard} startIcon={<ContentCopyIcon />} sx={{ minWidth: 142, fontWeight: 700 }}>
              {copyingDashboard ? 'Copying…' : 'Copy image'}
            </Button>
            {copyFeedback && <Typography data-html2canvas-ignore="true" variant="caption" color={copyFeedback.includes('Unable') ? 'error.main' : 'success.main'} fontWeight={700}>{copyFeedback}</Typography>}
          </Stack>
        </Paper>
        
        {/* Statistics Section */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {!isSiteManager && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatsCard
                title="Total Users"
                value={stats.users}
                icon={PeopleIcon}
                color="#004F98"
                trend="+12%"
              />
            </Grid>
          )}
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
              title="Current Sites"
              value={stats.currentSites}
              icon={Business}
              color="#7C3AED"
              trend="Created today"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatsCard
              title="Total Team Members"
              value={stats.totalTeamMembers}
              icon={GroupsIcon}
              color="#2563EB"
              trend="Active staff"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatsCard
              title="Present Staff"
              value={stats.presentStaff}
              icon={CheckCircle}
              color="#15803D"
              trend="Selected period"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatsCard
              title="Absent Staff"
              value={stats.absentStaff}
              icon={PeopleIcon}
              color="#DC2626"
              trend="Selected period"
            />
          </Grid>
         
          {!isSiteManager && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatsCard
                title="Master Items"
                value={stats.masterItems}
                icon={DescriptionIcon}
                color="#F59E0B"
                trend="Sync"
              />
            </Grid>
          )}
        </Grid>

        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {!isSiteManager && <Box sx={{ mb: 6 }}>
          <Typography variant="h5" fontWeight={800} color="#172B4D" sx={{ mb: 0.5 }}>Audit overview</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Subcategory-based team counts and audit details from {new Date(`${appliedRange.from}T00:00:00`).toLocaleDateString('en-IN')} to {new Date(`${appliedRange.to}T00:00:00`).toLocaleDateString('en-IN')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '16px', mb: 3 }}>
            {teamsByAuditType.map((item, index) => <Paper key={item.label} elevation={0} sx={{ p: 2, minWidth: 0, border: '1px solid #E2E8F0', borderTop: `4px solid ${auditChartColors[index % auditChartColors.length]}`, borderRadius: 2.5 }}><Typography variant="body2" color="text.secondary" fontWeight={700}>{item.label}</Typography><Typography variant="h4" fontWeight={800} color="#172B4D" sx={{ mt: 0.5 }}>{isDataLoading ? '—' : item.count}</Typography><Typography variant="caption" color="text.secondary">Teams in period</Typography></Paper>)}
          </Box>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}><AuditStatePie title="Audit Follow-ups" records={followUpRecords} loading={isDataLoading} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><AuditStatePie title="Audit Completion" records={completionRecords} loading={isDataLoading} /></Grid>
          </Grid>
        </Box>}

        {!isSiteManager && <Box sx={{ mb: 6, order: -1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2.5 }}>
            <Box>
              <Typography variant="h5" fontWeight={800} color="#172B4D">Today’s user activity</Typography>
              <Typography variant="body2" color="text.secondary">Scans recorded in the selected period, grouped by team and assigned member.</Typography>
            </Box>
            <Chip icon={<Schedule />} label={`${new Date(`${appliedRange.from}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(`${appliedRange.to}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`} variant="outlined" sx={{ fontWeight: 700 }} />
          </Stack>

          {isDataLoading ? <LinearProgress sx={{ borderRadius: 2 }} /> : dailyActivity.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px dashed #B8C7DA', borderRadius: 3, bgcolor: '#FBFDFF' }}>
              <Typography fontWeight={700} color="#334155">No scans recorded in this period</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Team activity will appear here when members scan racks during the selected dates.</Typography>
            </Paper>
          ) : (
            <Grid container spacing={2.5}>
              {dailyActivity.map((team) => (
                <Grid key={team.teamId} size={{ xs: 12, md: 6 }}>
                  <Paper elevation={0} sx={{ height: '100%', overflow: 'hidden', border: '1px solid #DCE6F3', borderRadius: 3, bgcolor: '#FFF' }}>
                    <Box sx={{ px: 2.5, py: 1.75, bgcolor: '#F3F8FE', borderBottom: '1px solid #DCE6F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800} color="#172B4D" noWrap>{team.teamName}</Typography>
                        <Typography variant="caption" color="text.secondary">{team.auditType} · {team.location || 'Location not set'}</Typography>
                      </Box>
                      <Chip label={`${team.totalScans} scans`} color="primary" size="small" sx={{ fontWeight: 800, flexShrink: 0 }} />
                    </Box>
                    <Stack divider={<Divider flexItem />}>
                      {team.members.map((member) => (
                        <Box key={member.id} sx={{ px: 2.5, py: 1.35, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar sx={{ width: 34, height: 34, fontSize: 14, fontWeight: 800, bgcolor: member.scanCount ? '#DDF6E9' : '#EEF2F7', color: member.scanCount ? '#087C43' : '#64748B' }}>
                            {member.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={750} noWrap>{member.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{member.role}</Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                            <Typography fontWeight={850} color={member.scanCount ? '#087C43' : '#64748B'}>{member.scanCount}</Typography>
                            <Typography variant="caption" color="text.secondary">scans</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>}

        </Box>

        {/* Management Tools Section — temporarily hidden */}
        {false && <Box sx={{ mb: { xs: 4, md: 6 } }}>
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
        </Box>}
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

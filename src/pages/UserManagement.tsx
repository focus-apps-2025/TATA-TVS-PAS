import React, { useState, useEffect } from 'react';
import type {FormEvent } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  IconButton,
  Button,
  Chip,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Avatar,
  Fab,
  Grid,
  Divider,
  InputAdornment,
  Card,
  CardContent,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  type SelectChangeEvent,
  SvgIcon,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  People as PeopleIcon,
  SearchOff as SearchOffIcon,
  PersonOutline as PersonOutlineIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import api from '../services/api';
import authManager from '../services/authSession';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ProfessionalCard from '../components/common/ProfessionalCard';
import StatsCard from '../components/common/StatsCard';
type SvgIconComponent = typeof SvgIcon;

// Type definitions - FIXED
interface User {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'team_leader' | 'team_member' | string;
  isActive: boolean;
  [key: string]: any;
}

// Add this type for API responses
interface ApiUser {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  [key: string]: any;
}

interface Role {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: SvgIconComponent;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

// Styled components - FIXED color props
const StyledCard = styled(Card)<{ $isCurrentUser?: boolean }>(({ theme, $isCurrentUser }) => ({
  borderRadius: 12,
  boxShadow: '0 4px 12px rgba(0, 79, 152, 0.08)',
  borderLeft: $isCurrentUser ? '4px solid #004F98' : 'none',
  transition: 'all 0.3s ease',
  margin: '16px 0',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 20px rgba(0, 79, 152, 0.12)',
  }
}));

const RoleChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'customColor'
})<{ customColor: string }>(({ theme, customColor }) => ({
  borderRadius: 8,
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: `${customColor}15`,
  color: customColor,
  border: `1px solid ${customColor}30`
}));

const ActionButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'hoverColor'
})<{ color: string; hoverColor?: string }>(({ theme, color, hoverColor }) => ({
  backgroundColor: `${color}08`,
  border: `1px solid ${color}20`,
  transition: 'all 0.2s ease',
  padding: 8,
  '&:hover': {
    backgroundColor: hoverColor || `${color}20`,
  }
}));

const FilterPaper = styled(Paper)({
  padding: 24,
  borderRadius: 16,
  marginBottom: 24,
  backgroundColor: '#ffffff',
  boxShadow: '0 2px 10px rgba(0, 79, 152, 0.06)',
  border: '1px solid #EBF0F5'
});

const SearchField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: 12,
    color: '#111BA5',
    backgroundColor: '#F9FAFC',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#00eaffff',
      borderWidth: 3
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#00eaffff',
      borderWidth: 2
    }
  }
});

const CompactTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    height: 40,
    fontSize: '0.9rem',
    borderRadius: 6
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.9rem',
    transform: 'translate(14px, 12px) scale(1)'
  },
  '& .MuiInputLabel-shrink': {
    transform: 'translate(14px, -6px) scale(0.75)'
  }
}));

const RoleOption = styled(Paper)<{ selected: boolean; color: string }>(({ theme, selected, color }) => ({
  cursor: 'pointer',
  padding: theme.spacing(1.5),
  borderRadius: 6,
  border: selected ? `2px solid ${color}` : '1px solid #E5E7EB',
  backgroundColor: selected ? `${color}08` : 'white',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  height: '100%',
  minHeight: 100,
  transition: 'all 0.2s ease'
}));

const RoleIcon = styled(Box)<{ color: string }>(({ theme, color }) => ({
  backgroundColor: `${color}15`,
  color: color,
  borderRadius: '50%',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(1)
}));

const AppColors = {
  primaryColor: '#004F98',
  primaryLight: '#1976D2',
  primaryDark: '#003366',
  backgroundColor: '#F8FAFC',
  cardColor: '#FFFFFF',
  surfaceColor: '#F9FAFB',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  dividerColor: '#E5E7EB',
  shadowColor: 'rgba(0, 79, 152, 0.08)',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  errorColor: '#EF4444',
  inactiveColor: '#94A3B8'
};

const UserCard = styled(Card)<{ $isCurrentUser?: boolean }>(({ theme, $isCurrentUser }) => ({
  borderRadius: 20,
  height: '100%',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  border: '1px solid #EBF0F5',
  position: 'relative',
  overflow: 'visible',
  background: '#ffffff',
  boxShadow: $isCurrentUser 
    ? '0 10px 25px rgba(0, 79, 152, 0.12)' 
    : '0 4px 15px rgba(0, 0, 0, 0.05)',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 15px 35px rgba(0, 79, 152, 0.15)',
    borderColor: '#004F98',
    '& .action-buttons': {
      opacity: 1,
      transform: 'translateY(0)'
    }
  }
}));

const StatItem = ({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: string }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Box sx={{ 
      display: 'inline-flex', 
      p: 1.5, 
      borderRadius: '16px', 
      bgcolor: `${color}15`, 
      color: color,
      mb: 1
    }}>
      <Icon fontSize="medium" />
    </Box>
    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1F2937' }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Typography>
  </Box>
);

const ContentContainer = styled(Container)({
  paddingTop: 24,
  paddingBottom: 24
});

import PageHero from '../components/common/PageHero';

const UserManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });
  const [deleting, setDeleting] = useState<boolean>(false);
  
  // Form Modal state
  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    role: '',
    isActive: true
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const roles: Role[] = [
    { 
      id: 'admin', 
      title: 'Administrator', 
      description: 'Full system access and management capabilities', 
      color: AppColors.primaryColor, 
      icon: PersonIcon 
    },
    { 
      id: 'team_leader', 
      title: 'Team Leader', 
      description: 'Can manage team members and assignments', 
      color: '#10B981', 
      icon: PersonIcon 
    },
    { 
      id: 'team_member', 
      title: 'Team Member', 
      description: 'Standard user with basic system access', 
      color: '#6366F1', 
      icon: PersonIcon 
    }
  ];

  const isCreating: boolean = !editingUser;

  useEffect(() => {
    loadUsersAndCurrentUser();
    
    const handleRefreshEvent = () => {
      loadUsersAndCurrentUser();
    };
    window.addEventListener('admin-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('admin-refresh', handleRefreshEvent);
    };
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchText, selectedRoleFilter, showActiveOnly]);

  const loadUsersAndCurrentUser = async (): Promise<void> => {
    try {
      setLoading(true);
      const [usersData, currentUserData] = await Promise.all([
        api.getAllUsers(),
        authManager.getCurrentUser()
      ]);
      
      // FIX: Transform API data to match User interface
      const transformedUsers: User[] = (usersData || []).map((user: ApiUser) => ({
        _id: user._id || user.id,
        id: user.id || user._id,
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'team_member',
        isActive: user.isActive !== undefined ? user.isActive : true,
        ...user
      }));
      
      setUsers(transformedUsers);
      
      // FIX: Transform current user data
      if (currentUserData) {
        const transformedCurrentUser: User = {
          _id: currentUserData._id || currentUserData.id,
          id: currentUserData.id || currentUserData._id,
          name: currentUserData.name || '',
          email: currentUserData.email || '',
          role: currentUserData.role || '',
          isActive: currentUserData.isActive !== undefined ? currentUserData.isActive : true,
          ...currentUserData
        };
        setCurrentUser(transformedCurrentUser);
      } else {
        setCurrentUser(null);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      showSnackbar('Error loading users: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success'): void => {
    setSnackbar({ open: true, message, severity });
  };

  const filterUsers = (): void => {
    let filtered = users;

    if (searchText) {
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (selectedRoleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRoleFilter);
    }

    if (showActiveOnly) {
      filtered = filtered.filter(user => user.isActive);
    }

    setFilteredUsers(filtered);
  };

  const confirmDeleteUser = (user: User): void => {
    const userId = user._id || user.id;
    
    if (!userId) {
      showSnackbar('Invalid user data. Cannot delete user.', 'error');
      return;
    }

    if (user.role === 'admin') {
      try {
        const admins = users.filter(u => u.role === 'admin' && u.isActive);
        if (admins.length <= 1 && user.isActive) {
          showSnackbar('Cannot delete the last active administrator account.', 'warning');
          return;
        }
      } catch (error) {
        showSnackbar('Error checking admin count', 'error');
        return;
      }
    }

    if (currentUser && (currentUser._id || currentUser.id) === userId) {
      showSnackbar('You cannot delete your own account.', 'warning');
      return;
    }

    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async (): Promise<void> => {
    if (!userToDelete) return;
    
    const userId = userToDelete._id || userToDelete.id;
    
    if (!userId) {
      console.error('No user ID found:', userToDelete);
      showSnackbar('Invalid user data. Cannot delete user.', 'error');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      return;
    }
    
    setDeleting(true);
    try {
      const result = await api.deleteUser(userId);
      
      if (result.success) {
        showSnackbar(result.message || 'User deleted successfully!', 'success');
        setUsers(users.filter(user => (user._id || user.id) !== userId));
      } else {
        showSnackbar(result.message || 'Failed to delete user.', 'error');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      showSnackbar('Unexpected error during deletion', 'error');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  // Form Modal functions
  const openCreateModal = (): void => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      isActive: true
    });
    setFormErrors({});
    setShowPassword(false);
    setFormModalOpen(true);
  };

  const openEditModal = (user: User): void => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || '',
      isActive: user.isActive !== undefined ? user.isActive : true
    });
    setFormErrors({});
    setShowPassword(false);
    setFormModalOpen(true);
  };

  const closeModal = (): void => {
    setFormModalOpen(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      isActive: true
    });
    setFormErrors({});
    setShowPassword(false);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Please enter a name';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Please enter an email';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (isCreating && !formData.password) {
      newErrors.password = 'Please enter a password';
    }
    if (!formData.role) {
      newErrors.role = 'Please select a role';
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validateForm()) return;
    setFormLoading(true);
    try {
      let result: any;
      const userData = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
        ...(formData.password && { password: formData.password })
      };
      
      if (isCreating) {
        result = await api.createUser(userData);
      } else {
        const userId = editingUser?._id || editingUser?.id;
        if (!userId) throw new Error('No user ID found for editing');
        result = await api.updateUser(userId, userData);
      }
      if (result.success) {
        showSnackbar(
          result.message || (isCreating ? 'User created successfully!' : 'User updated successfully!'),
          'success'
        );
        await loadUsersAndCurrentUser();
        closeModal();
      } else {
        showSnackbar(
          result.message || (isCreating ? 'Failed to create user.' : 'Failed to update user.'),
          'error'
        );
      }
    } catch (error: any) {
      showSnackbar('Error saving user: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: any): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getAvatarColors = (role: string): [string, string] => {
    switch (role) {
      case 'admin':
        return ['#004F98', '#0066CC'];
      case 'team_leader':
        return ['#10B981', '#0E9F6E'];
      case 'team_member':
        return ['#6366F1', '#4F46E5'];
      default:
        return ['#94A3B8', '#64748B'];
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'admin':
        return AppColors.primaryColor;
      case 'team_leader':
        return AppColors.successColor;
      case 'team_member':
        return '#6366F1';
      default:
        return AppColors.textMuted;
    }
  };

  const capitalize = (str: string): string => {
    if (!str) return '';
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (name: string): string => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleRefresh = (): void => {
    loadUsersAndCurrentUser();
  };

  const clearFilters = (): void => {
    setSearchText('');
    setSelectedRoleFilter('all');
    setShowActiveOnly(false);
  };

  if (loading) {
    return (
      <Box sx={{ bgcolor: AppColors.backgroundColor, flexGrow: 1 }}>
        <Box>
          {loading && <LoadingOverlay open={loading} message="Loading Users..." />}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <LoadingOverlay open={loading} />

      <PageHero 
        title="User Management" 
        subtitle="Manage your organization's users, roles, and access permissions in one centralized location."
      />

      {/* Main Content Area */}
      <ContentContainer maxWidth="xl" sx={{ mt: -5, pb: 8, position: 'relative', zIndex: 2 }}>
        <Grid container spacing={4}>
          {/* Action Header Section - Now inside container */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ 
              p: 3, 
              borderRadius: '24px', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 3,
              mb: 4
            }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={openCreateModal}
                  sx={{
                    bgcolor: '#004F98',
                    fontWeight: 700,
                    px: 3,
                    borderRadius: '12px'
                  }}
                >
                  Add User
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleRefresh}
                  sx={{
                    borderRadius: '12px',
                    fontWeight: 600
                  }}
                >
                  Refresh
                </Button>
              </Box>

              <Box sx={{ 
                display: 'flex', 
                gap: 3, 
                width: { xs: '100%', md: 'auto' },
                justifyContent: 'center'
              }}>
                <StatItem 
                  icon={PeopleIcon} 
                  label="Total" 
                  value={users.length} 
                  color="#004F98" 
                />
                <StatItem 
                  icon={CheckCircleIcon} 
                  label="Active" 
                  value={users.filter(u => u.isActive).length} 
                  color="#10B981" 
                />
                <StatItem 
                  icon={PersonIcon} 
                  label="Admins" 
                  value={users.filter(u => u.role === 'admin').length} 
                  color="#6366F1" 
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Filters Section */}
        <FilterPaper elevation={0} sx={{ mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, lg: 4 }}>
              <SearchField
                fullWidth
                placeholder="Search by name or email..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: AppColors.primaryColor }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchText && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchText('')}>
                        <ClearIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>Filter by Role</InputLabel>
                <Select
                  value={selectedRoleFilter}
                  onChange={(e: SelectChangeEvent) => setSelectedRoleFilter(e.target.value)}
                  label="Filter by Role"
                  sx={{ borderRadius: '12px', bgcolor: '#F9FAFC' }}
                >
                  <MenuItem value="all">All Roles</MenuItem>
                  <MenuItem value="admin">Administrators</MenuItem>
                  <MenuItem value="team_leader">Team Leaders</MenuItem>
                  <MenuItem value="team_member">Team Members</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                p: 1.5, 
                borderRadius: '12px', 
                bgcolor: showActiveOnly ? `${AppColors.successColor}08` : '#F9FAFC',
                border: '1px solid #EBF0F5'
              }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showActiveOnly}
                      onChange={(e) => setShowActiveOnly(e.target.checked)}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600, color: AppColors.textSecondary }}>
                      Active Only
                    </Typography>
                  }
                  sx={{ ml: 0, width: '100%' }}
                />
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                disabled={!searchText && selectedRoleFilter === 'all' && !showActiveOnly}
                sx={{ 
                  borderRadius: '12px', 
                  py: 1.5, 
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </FilterPaper>

        {/* Results Info */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, px: 1 }}>
          <Typography variant="body1" sx={{ color: '#64748B', fontWeight: 500 }}>
            Showing **{filteredUsers.length}** of {users.length} total users
          </Typography>
        </Box>

        {/* User Cards Grid */}
        {filteredUsers.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: '24px', border: '1px dashed #CBD5E1', bgcolor: 'transparent' }}>
            <SearchOffIcon sx={{ fontSize: 80, color: '#CBD5E1', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#475569', mb: 1 }}>No users found</Typography>
            <Typography variant="body1" sx={{ color: '#64748B', mb: 3 }}>Try adjusting your search or filters to find what you're looking for.</Typography>
            <Button variant="contained" onClick={clearFilters} sx={{ borderRadius: '12px', px: 4 }}>Clear All Filters</Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {filteredUsers.map((user) => {
              const isCurrentUserFlag = !!(currentUser && (currentUser._id || currentUser.id) === (user._id || user.id));
              const avatarColors = getAvatarColors(user.role);
              const roleColor = getRoleColor(user.role);
              
              return (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={user._id || user.id}>
                  <UserCard $isCurrentUser={isCurrentUserFlag}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Avatar
                          sx={{
                            width: 64,
                            height: 64,
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            background: `linear-gradient(135deg, ${avatarColors[0]} 0%, ${avatarColors[1]} 100%)`,
                            boxShadow: `0 8px 20px ${avatarColors[0]}40`,
                            mr: 2.5
                          }}
                        >
                          {getInitials(user.name)}
                        </Avatar>
                        <Box sx={{ overflow: 'hidden' }}>
                          <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: '#1F2937', mb: 0.5 }}>
                            {user.name}
                          </Typography>
                          <Typography variant="body2" noWrap sx={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 14 }} /> {user.email}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                        <RoleChip 
                          label={capitalize(user.role)}
                          customColor={roleColor}
                          sx={{
                            fontWeight: 700,
                            borderRadius: '10px',
                            px: 1
                          }}
                        />
                        <Chip
                          icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: user.isActive ? '#10B981' : '#94A3B8', ml: 1 }} />}
                          label={user.isActive ? "Active" : "Inactive"}
                          sx={{
                            bgcolor: user.isActive ? '#10B98115' : '#94A3B815',
                            color: user.isActive ? '#10B981' : '#64748B',
                            fontWeight: 700,
                            borderRadius: '10px',
                            '& .MuiChip-icon': { ml: '4px', mr: '-4px' }
                          }}
                        />
                        {isCurrentUserFlag && (
                          <Chip 
                            label="You" 
                            size="small"
                            sx={{ bgcolor: '#004F98', color: 'white', fontWeight: 700, borderRadius: '10px' }} 
                          />
                        )}
                      </Box>

                      <Divider sx={{ mb: 2.5, borderStyle: 'dashed' }} />

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                          ID: {(user._id || user.id || '').substring(0, 8)}...
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton 
                            onClick={() => openEditModal(user)}
                            sx={{ 
                              bgcolor: '#004F9810', 
                              color: '#004F98',
                              '&:hover': { bgcolor: '#004F9820' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            onClick={() => confirmDeleteUser(user)}
                            disabled={isCurrentUserFlag}
                            sx={{ 
                              bgcolor: '#EF444410', 
                              color: '#EF4444',
                              '&:hover': { bgcolor: '#EF444420' },
                              '&.Mui-disabled': { bgcolor: '#F1F5F9', color: '#CBD5E1' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </UserCard>
                </Grid>
              );
            })}
          </Grid>
        )}
      </ContentContainer>

      {/* Mobile-only FAB for adding users */}
      <Box sx={{ display: { md: 'none' } }}>
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            bgcolor: AppColors.primaryColor,
            '&:hover': { bgcolor: AppColors.primaryDark }
          }}
          onClick={openCreateModal}
        >
          <AddIcon />
        </Fab>
      </Box>

      {/* Create/Edit User Modal */}
      <Dialog
        open={formModalOpen}
        onClose={() => !formLoading && closeModal()}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }
        }}
      >
        <Box sx={{ 
          background: 'linear-gradient(135deg, #004F98 0%, #1976D2 100%)', 
          p: 3, 
          color: 'white',
          position: 'relative'
        }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {isCreating ? 'Add New User' : 'Edit User Profile'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5 }}>
            {isCreating ? 'Create a new account and assign permissions' : `Modifying account details for ${editingUser?.name}`}
          </Typography>
          <IconButton 
            onClick={closeModal} 
            sx={{ position: 'absolute', right: 16, top: 16, color: 'white' }}
            disabled={formLoading}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 4 }}>
          <Box component="form" noValidate sx={{ mt: 1 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: '#475569' }}>Full Name</Typography>
                <TextField
                  fullWidth
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: '#64748B' }} />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: '12px' }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: '#475569' }}>Email Address</Typography>
                <TextField
                  fullWidth
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: '#64748B' }} />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: '12px' }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: '#475569' }}>
                  {isCreating ? 'Password' : 'New Password (leave blank to keep current)'}
                </Typography>
                <TextField
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  error={!!formErrors.password}
                  helperText={formErrors.password}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: '#64748B' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: { borderRadius: '12px' }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: '#475569' }}>Account Status</Typography>
                <Box sx={{ 
                  p: 1, 
                  px: 2, 
                  borderRadius: '12px', 
                  border: '1px solid #E2E8F0', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  height: '56px'
                }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: formData.isActive ? '#10B981' : '#64748B' }}>
                    {formData.isActive ? 'Account Active' : 'Account Disabled'}
                  </Typography>
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    color="success"
                  />
                </Box>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: '#475569' }}>Select User Role</Typography>
                <Grid container spacing={2}>
                  {roles.map((role) => (
                    <Grid size={{ xs: 12, sm: 4 }} key={role.id}>
                      <RoleOption 
                        selected={formData.role === role.id}
                        color={role.color}
                        elevation={0}
                        onClick={() => handleInputChange('role', role.id)}
                        sx={{ borderRadius: '16px', p: 2, minHeight: 120 }}
                      >
                        <RoleIcon color={role.color} sx={{ mb: 1 }}>
                          <role.icon />
                        </RoleIcon>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>{role.title}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', lineHeight: 1.2 }}>{role.description}</Typography>
                      </RoleOption>
                    </Grid>
                  ))}
                </Grid>
                {formErrors.role && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>{formErrors.role}</Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 4, pt: 2, gap: 2 }}>
          <Button 
            onClick={closeModal} 
            sx={{ borderRadius: '12px', px: 3, fontWeight: 600, color: '#64748B' }}
            disabled={formLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFormSubmit}
            variant="contained"
            disabled={formLoading}
            startIcon={formLoading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            sx={{ 
              borderRadius: '12px', 
              px: 4, 
              py: 1.5,
              fontWeight: 700,
              bgcolor: '#004F98',
              '&:hover': { bgcolor: '#003366' },
              boxShadow: '0 10px 15px -3px rgba(0, 79, 152, 0.3)'
            }}
          >
            {formLoading ? 'Saving...' : (isCreating ? 'Create Account' : 'Save Changes')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '24px', p: 1 } }}
      >
        <DialogContent sx={{ textAlign: 'center', p: 4 }}>
          <Avatar sx={{ bgcolor: '#FEE2E2', color: '#EF4444', width: 80, height: 80, mx: 'auto', mb: 3 }}>
            <DeleteIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1F2937', mb: 2 }}>Delete User Account?</Typography>
          <Typography variant="body1" sx={{ color: '#64748B', mb: 1 }}>
            You are about to permanently delete <Box component="span" sx={{ fontWeight: 'bold' }}>{userToDelete?.name}</Box>.
          </Typography>
          <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 600 }}>
            This action cannot be undone and will remove all associated data.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 4, pt: 0, justifyContent: 'center', gap: 2 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)} 
            disabled={deleting}
            sx={{ borderRadius: '12px', px: 3, fontWeight: 600, color: '#64748B' }}
          >
            Keep Account
          </Button>
          <Button
            onClick={handleDeleteUser}
            variant="contained"
            disabled={deleting}
            sx={{ 
              borderRadius: '12px', 
              px: 4, 
              bgcolor: '#EF4444', 
              '&:hover': { bgcolor: '#DC2626' },
              fontWeight: 700
            }}
          >
            {deleting ? <CircularProgress size={20} color="inherit" /> : 'Yes, Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', boxShadow: 3 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserManagement;
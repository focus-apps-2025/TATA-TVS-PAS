// src/pages/admin/TeamManagement.tsx
import React, { useState, useEffect, useCallback, useRef, type ChangeEvent, type SyntheticEvent, type JSX } from 'react';
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
  Slide,
  Tab,
  Tabs,
  Menu,
  ListItemIcon,
  ListItemText,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  Autocomplete,
  Tooltip,
  Backdrop,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  Checkbox,
  Collapse,
  type AlertColor,
  type SelectChangeEvent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  People as PeopleIcon,
  Groups as GroupsIcon,
  SearchOff as SearchOffIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
  GroupAdd as GroupAddIcon,
  CalendarToday as CalendarIcon,
  Save as SaveIcon,
  MoreVert as MoreVertIcon,
  Dns as DnsIcon,
  Visibility as VisibilityIcon,
  Numbers as NumbersIcon,
  Description as DescriptionIcon,
  ArrowBack as ArrowBackIcon,
  CurrencyRupee as RupeeIcon,
  LocalOffer as OfferIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  InsertDriveFile as FileIcon,
  Home as HomeIcon,
  Download as DownloadIcon,
  NavigateNext as NavigateNextIcon,
  MyLocation as MyLocationIcon,
  NewReleases as NewReleasesIcon,
  AccessTime as AccessTimeIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import api, { type User, type Team, type Rack, type TeamFormData, type RackParams } from '../services/api';
import authManager from '../services/authSession';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ProfessionalCard from '../components/common/ProfessionalCard';
import StatsCard from '../components/common/StatsCard';
import PageHero from '../components/common/PageHero';
import StatusChip from '../components/common/StatusChip';
import EmptyState from '../components/common/EmptyState';
import TeamCard from '../components/team/TeamCard';
import TeamForm from '../components/team/TeamForm';
import MemberAssignmentDialog from '../components/team/MemberAssignmentDialog';
import TeamDeleteDialog from '../components/team/TeamDeleteDialog';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Type definitions
interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface UserStats {
  totalCount: number;
  firstScanTime?: Date | null;
}

interface ServerUserStats {
  [key: string]: UserStats;
}

interface RackEditData {
  rackNo: string;
  partNo: string;
  mrp: string;
  nextQty: string;
  location: string;
  materialDescription: string;
  ndp: string;
}

interface RackEditErrors {
  rackNo?: string;
  partNo?: string;
  mrp?: string;
  nextQty?: string;
  location?: string;
  materialDescription?: string;
  ndp?: string;
}

// Style constants
const primaryColor = '#004F98';
const secondaryColor = '#0066CC';
const successColor = '#10B981';
const warningColor = '#F59E0B';
const errorColor = '#EF4444';
const backgroundColor = '#F8FAFC';
const surfaceColor = '#FFFFFF';

// Styled components (same as before, but with TypeScript)
const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'active'
})<{ active?: boolean }>(({ theme, active }) => ({
  borderRadius: 12,
  boxShadow: '0 4px 12px rgba(0, 79, 152, 0.08)',
  borderLeft: active ? `4px solid ${primaryColor}` : 'none',
  transition: 'all 0.3s ease',
  margin: '16px 0',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 20px rgba(0, 79, 152, 0.12)',
  }
}));

// Components imported from common/team folder

const StyledTab = styled(Tab)(({ theme }) => ({
  textTransform: 'none',
  minWidth: 0,
  fontWeight: 500,
  marginRight: theme.spacing(3),
  '&.Mui-selected': {
    fontWeight: 700,
    color: primaryColor
  }
}));

const ContentContainer = styled(Container)({
  paddingTop: 24,
  paddingBottom: 24
});

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0, 79, 152, 0.08)',
  '& .MuiTableHead-root': {
    backgroundColor: alpha(primaryColor, 0.04)
  },
  '& .MuiTableCell-head': {
    color: primaryColor,
    fontWeight: 600
  }
}));

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

// Helper functions
function getStatusColor(status: string): string {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return successColor;
    case "active":
      return warningColor;
    case "inactive":
      return errorColor;
    default:
      return warningColor;
  }
}

type QuantityStatus = "out_of_stock" | "low_stock" | "in_stock";

function getQuantityStatus(quantity: number): QuantityStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity < 10) return "low_stock";
  return "in_stock";
}

function getQuantityStatusColor(status: QuantityStatus): string {
  switch (status) {
    case "in_stock":
      return successColor;
    case "low_stock":
      return warningColor;
    case "out_of_stock":
      return errorColor;
    default:
      return "#6B7280";
  }
}

// Main component

const TeamManagement: React.FC = () => {
  const navigate = useNavigate();
  const { teamId } = useParams<{ teamId?: string }>();

  // State for authentication and user
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Global state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [activeTab, setActiveTab] = useState<string>(teamId ? 'racks' : 'teams');

  // Teams state
  const [teams, setTeams] = useState<Team[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Team operations state
  const [teamFormOpen, setTeamFormOpen] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamFormLoading, setTeamFormLoading] = useState<boolean>(false);
  const [teamActionMenuAnchor, setTeamActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [teamMenuTarget, setTeamMenuTarget] = useState<Team | null>(null);
  const [teamDeleteDialogOpen, setTeamDeleteDialogOpen] = useState<boolean>(false);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);

  // Racks state
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rackSearch, setRackSearch] = useState<string>('');
  const [rackStatusFilter, setRackStatusFilter] = useState<string>('all');
  const [rackSortOrder, setRackSortOrder] = useState<string>('rack_asc');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [totalRacks, setTotalRacks] = useState<number>(0);
  const [rackPage, setRackPage] = useState<number>(0);
  const [racksPerPage, setRacksPerPage] = useState<number>(10);
  const [detailsActiveTab, setDetailsActiveTab] = useState<string>('info');

  // Rack operations state
  const [rackActionMenuAnchor, setRackActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [rackMenuTarget, setRackMenuTarget] = useState<Rack | null>(null);
  const [rackDeleteDialogOpen, setRackDeleteDialogOpen] = useState<boolean>(false);
  const [rackToDelete, setRackToDelete] = useState<Rack | null>(null);
  const [rackDetailsOpen, setRackDetailsOpen] = useState<boolean>(false);
  const [rackToView, setRackToView] = useState<Rack | null>(null);
  const [isWorkSubmitted, setIsWorkSubmitted] = useState<boolean>(false);
  const [serverUserStats, setServerUserStats] = useState<ServerUserStats>({});
  const [totalMissingInfo, setTotalMissingInfo] = useState<number>(0);
  const [loadingMissingInfo, setLoadingMissingInfo] = useState<boolean>(false);


  const [currentAuditType, setCurrentAuditType] = useState<'TVS' | 'TATA'>('TVS');


  // For rack details editing
  const [isEditingRackDetails, setIsEditingRackDetails] = useState<boolean>(false);
  const [rackFormLoading, setRackFormLoading] = useState<boolean>(false);
  const [editRackData, setEditRackData] = useState<RackEditData>({
    rackNo: '',
    partNo: '',
    mrp: '',
    nextQty: '',
    location: '',
    materialDescription: '',
    ndp: ''
  });
  const [editRackErrors, setEditRackErrors] = useState<RackEditErrors>({});

  // Add Partno state
  const [addPartnoDialogOpen, setAddPartnoDialogOpen] = useState<boolean>(false);
  const [addRackLoading, setAddRackLoading] = useState<boolean>(false);
  const [newRackData, setNewRackData] = useState<RackEditData>({
    rackNo: '',
    partNo: '',
    mrp: '',
    nextQty: '',
    location: '',
    materialDescription: '',
    ndp: ''
  });
  const [addRackErrors, setAddRackErrors] = useState<RackEditErrors>({});

  // Team form state
  const [teamFormData, setTeamFormData] = useState<TeamFormData>({
    siteName: '',
    location: '',
    description: '',
    status: 'active',
    isNewSite: false,
    auditType: 'TVS', // Default to TVS
  });
  const [teamFormErrors, setTeamFormErrors] = useState<Record<string, string>>({});
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableTeamLeaders, setAvailableTeamLeaders] = useState<User[]>([]);
  const [availableTeamMembers, setAvailableTeamMembers] = useState<User[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<User[]>([]);
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<User | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState<boolean>(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [gettingLocation, setGettingLocation] = useState<boolean>(false);

  // Initialize and load data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Apply filters to teams
  useEffect(() => {
    if (teams.length > 0) {
      filterTeams();
    }
  }, [teams, teamSearch, teamStatusFilter]);

  // Handle tab changes
  useEffect(() => {
    if (activeTab === 'racks' && selectedTeam) {
      loadRacks();
      checkWorkStatus();
    }
  }, [activeTab, selectedTeam]);

  // Separate effect for search/filter changes
  useEffect(() => {
    if (activeTab === 'racks' && selectedTeam) {
      const timeoutId = setTimeout(() => {
        setRackPage(0);
        loadRacks();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [rackSearch, rackSortOrder, racksPerPage]);

  // Date filter effect
  useEffect(() => {
    if (activeTab === 'racks' && selectedTeam) {
      setRackPage(0);
      loadRacks();
      checkWorkStatus();
    }
  }, [selectedDate]);

  // Clear rack data when team changes
  useEffect(() => {
    if (selectedTeam) {
      setRacks([]);
      setTotalRacks(0);
      setServerUserStats({});
      setTotalMissingInfo(0);
      setRackSearch('');
      setSelectedDate(null);
      setRackPage(0);
    }
  }, [selectedTeam]);

  useEffect(() => {
    const handleRefreshEvent = () => {
      loadInitialData();
    };
    window.addEventListener('admin-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('admin-refresh', handleRefreshEvent);
    };
  }, []);

  // Load initial data
  const loadInitialData = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all required data in parallel for much faster performance
      const [user, teamsData, usersData] = await Promise.all([
        authManager.getCurrentUser(),
        api.getTeams(),
        api.getAllUsers()
      ]);

      setCurrentUser(user);
      setTeams(teamsData || []);
      setAvailableUsers(usersData.filter(u => u.isActive) || []);

      // Filter available leaders and members in parallel
      await Promise.all([
        fetchAvailableTeamLeaders(),
        fetchAvailableTeamMembers()
      ]);

      // If teamId is provided, find and set the selected team
      if (teamId) {
        const foundTeam = (teamsData || []).find(team => (team._id === teamId || team.id === teamId));
        if (foundTeam) {
          setSelectedTeam(foundTeam);
          setActiveTab('racks');
        } else {
          setError(`Team with ID ${teamId} not found`);
        }
      }

    } catch (error: any) {
      setError(`Failed to load data: ${error.message}`);
      showSnackbar(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTeamMembers = async (): Promise<void> => {
    try {
      // The backend api.getUsersByRole('team_member') already filters out 
      // users who are in active teams, so we don't need to check individually anymore.
      const members: User[] = await api.getUsersByRole('team_member');

      // Just filter out the current user if they are in the list
      const availableMembers = members.filter(user =>
        user._id !== currentUser?._id && user.id !== currentUser?.id
      );

      setAvailableTeamMembers(availableMembers);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      showSnackbar('Failed to load team members', 'error');
    }
  };

  // Fetch available team leaders
  const fetchAvailableTeamLeaders = async (): Promise<void> => {
    try {
      const [teamLeaders, admins]: [User[], User[]] = await Promise.all([
        api.getUsersByRole('team_leader'),
        api.getUsersByRole('admin')
      ]);

      const allLeaders = [...teamLeaders, ...admins];
      const uniqueLeaders = allLeaders.filter((leader, index, self) =>
        index === self.findIndex(t => (t._id || t.id) === (leader._id || leader.id))
      );

      setAvailableTeamLeaders(uniqueLeaders);
    } catch (error: any) {
      console.error('Error fetching team leaders:', error);
      showSnackbar('Failed to load team leaders', 'error');
    }
  };

  // Refresh all data
  const handleRefresh = (): void => {
    if (activeTab === 'teams') {
      loadInitialData();
    } else if (activeTab === 'racks' && selectedTeam) {
      loadRacks();
      checkWorkStatus();
    }
  };

  // Load racks for selected team
  const loadRacks = useCallback(async (): Promise<void> => {
    if (!selectedTeam) return;

    setLoading(true);
    setError(null);

    try {
      const formattedDate = selectedDate ? format(new Date(selectedDate), 'yyyy-MM-dd') : null;

      const params: Record<string, any> = {
        teamId: selectedTeam._id,
        page: rackPage + 1,
        limit: racksPerPage,
        search: rackSearch || undefined,
        sortBy: rackSortOrder !== 'rack_asc' ? rackSortOrder : undefined,
        date: formattedDate,
      };

      console.log('Loading racks with params:', params);
      const response = await api.getRacks(params);

      setRacks(response.racks || []);
      setTotalRacks(response.totalCount || 0);
      fetchUserStats();
      fetchTotalMissingInfo(selectedTeam);
    } catch (error: any) {
      console.error('Error loading racks:', error);
      setError(`Failed to load racks: ${error.message}`);
      showSnackbar(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedTeam, rackPage, racksPerPage, rackSearch, rackSortOrder, selectedDate]);

  // Get total missing info count
  const fetchTotalMissingInfo = async (teamParam: Team): Promise<void> => {
    if (!teamParam) {
      setTotalMissingInfo(0);
      return;
    }

    try {
      const params: any = {
        teamId: teamParam._id || teamParam.id,
        search: 'n/a',
        limit: 1
      };

      if (selectedDate) {
        params.date = format(selectedDate, 'yyyy-MM-dd');
      }

      const response = await api.getRacks(params);
      setTotalMissingInfo(response.totalCount || 0);
    } catch (error: any) {
      console.error('Error fetching missing info count:', error);
      setTotalMissingInfo(0);
    } finally {
      setLoadingMissingInfo(false);
    }
  };

  // Check if work is submitted for the team
  const checkWorkStatus = async (): Promise<void> => {
    if (!selectedTeam) return;

    try {
      const status: boolean = await api.getTeamWorkStatus(selectedTeam._id || selectedTeam.id || '');
      setIsWorkSubmitted(status);
    } catch (error: any) {
      console.error("Error checking work status:", error);
    }
  };

  // Fetch user statistics
  const fetchUserStats = async (): Promise<void> => {
    if (!selectedTeam) return;

    try {
      if (selectedDate) {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const stats = await api.getFirstScanByUser(selectedTeam._id || selectedTeam.id || '', formattedDate);

        const formattedStats: ServerUserStats = {};
        Object.entries(stats).forEach(([user, data]: [string, any]) => {
          formattedStats[user] = {
            totalCount: data.count || 0,
            firstScanTime: data.firstScan ? new Date(data.firstScan) : null
          };
        });
        setServerUserStats(formattedStats);
      } else {
        const counts = await api.getTotalScanCounts(selectedTeam._id || selectedTeam.id || '');
        const formattedStats: ServerUserStats = {};
        Object.entries(counts).forEach(([user, count]: [string, number]) => {
          formattedStats[user] = {
            totalCount: count,
            firstScanTime: null
          };
        });
        setServerUserStats(formattedStats);
      }
    } catch (error: any) {
      console.error("Error fetching user stats:", error);
      setServerUserStats({});
    }
  };

  // Filter teams based on search and status filter
  const filterTeams = (): void => {
    let filtered = teams;

    // Apply search filter
    if (teamSearch) {
      filtered = filtered.filter(team =>
        (team.siteName || "").toLowerCase().includes(teamSearch.toLowerCase()) ||
        (team.location || "").toLowerCase().includes(teamSearch.toLowerCase())
      );
    }

    // Apply status filter
    if (teamStatusFilter !== 'all') {
      filtered = filtered.filter(team => (team.status || "active").toLowerCase() === teamStatusFilter);
    }

    setFilteredTeams(filtered);
  };

  // Clear all filters
  const clearFilters = (): void => {
    if (activeTab === 'teams') {
      setTeamSearch('');
      setTeamStatusFilter('all');
    } else {
      setRackSearch('');
      setRackStatusFilter('all');
      setRackSortOrder('rack_asc');
      setSelectedDate(null);
      setRackPage(0);
    }
  };

  // Handle tab change
  const handleTabChange = (event: SyntheticEvent, newValue: string): void => {
    setActiveTab(newValue);
    if (newValue === 'teams') {
      setSelectedTeam(null);
    }
  };

  // Show snackbar notification
  const showSnackbar = (message: string, severity: AlertColor = 'success'): void => {
    setSnackbar({ open: true, message, severity });
  };

  // --- SUB-RENDERS ---

  function renderEmptyState(type: 'teams' | 'racks', isFiltered: boolean) {
    if (type === 'teams') {
      return (
        <EmptyState
          icon={isFiltered ? SearchOffIcon : GroupIcon}
          title={isFiltered ? "No teams found" : "No teams created yet"}
          subtitle={isFiltered ? "Try adjusting your search or filters to find what you're looking for." : "Start by creating your first team to manage sites and inventory."}
          hasFilters={isFiltered}
          onClearFilters={() => {
            setTeamSearch('');
            setTeamStatusFilter('all');
          }}
          onAction={!isFiltered ? openCreateTeamForm : undefined}
          actionText="Add New Team"
        />
      );
    }
    return (
      <EmptyState
        icon={isFiltered ? SearchOffIcon : RefreshIcon}
        title={isFiltered ? "No racks found" : "No inventory data"}
        subtitle={isFiltered ? "Try adjusting your search or date filters." : "This team hasn't scanned any racks for the selected period yet."}
        hasFilters={isFiltered}
        onClearFilters={() => {
          setRackSearch('');
          setRackStatusFilter('all');
          setSelectedDate(null);
        }}
        onAction={!isFiltered ? loadRacks : undefined}
        actionText="Refresh Data"
      />
    );
  }

  // ----- TEAM OPERATIONS -----

  // Open team form for creation
  const openCreateTeamForm = (): void => {
    setEditingTeam(null);
    setTeamFormData({
      siteName: '',
      location: '',
      description: '',
      isNewSite: false,
      status: 'active',
      auditType: 'TVS',
    });
    setSelectedTeamMembers([]);
    setSelectedTeamLeader(null);
    setTeamFormErrors({});
    setTeamFormOpen(true);
  };

  // Open team form for editing
  const openEditTeamForm = (team: Team): void => {
    setEditingTeam(team);
    setTeamFormData({
      siteName: team.siteName || '',
      location: team.location || '',
      description: team.description || '',
      isNewSite: team.isNewSite || false,
      status: team.status || 'active',
      auditType: team.auditType || 'TVS', // Add this
    });

    setSelectedTeamMembers(team.members as User[] || []);
    setSelectedTeamLeader(team.teamLeader as User || null);

    setTeamFormErrors({});
    setTeamFormOpen(true);
  };

  // Close team form
  const closeTeamForm = (): void => {
    setTeamFormOpen(false);
    setEditingTeam(null);
    setTeamFormData({
      siteName: '',
      location: '',
      description: '',
      isNewSite: false,
      status: 'active',
      auditType: 'TVS', // Add this line

    });
    setSelectedTeamMembers([]);
    setSelectedTeamLeader(null);
    setTeamFormErrors({});
  };

  // Get current location
  const getCurrentLocation = async (): Promise<void> => {
    setGettingLocation(true);
    try {
      if (!navigator.geolocation) {
        showSnackbar('Geolocation is not supported by this browser', 'warning');
        return;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );

      const data = await response.json();
      if (data.display_name) {
        setTeamFormData(prev => ({
          ...prev,
          location: data.display_name
        }));
      }
    } catch (error: any) {
      console.error('Error getting location:', error);
      showSnackbar('Failed to get current location', 'error');
    } finally {
      setGettingLocation(false);
    }
  };

  // Validate team form
  const validateTeamForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!teamFormData.siteName.trim()) {
      errors.siteName = 'Site name is required';
    }

    if (!teamFormData.location.trim()) {
      errors.location = 'Location is required';
    }

    if (!teamFormData.auditType) {
      errors.auditType = 'Audit type is required';
    }

    if (currentUser?.role === 'admin' && !selectedTeamLeader) {
      errors.teamLeader = 'Please select a team leader';
    }

    setTeamFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle team form submission
  const handleTeamFormSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateTeamForm()) return;

    setTeamFormLoading(true);

    try {
      const teamData: TeamFormData = {
        siteName: teamFormData.siteName,
        location: teamFormData.location,
        description: teamFormData.description,
        isNewSite: teamFormData.isNewSite,
        status: teamFormData.status,
        auditType: teamFormData.auditType,
        members: selectedTeamMembers.map(member => member._id || member.id || '')
      };

      if (selectedTeamLeader) {
        teamData.leader = selectedTeamLeader._id || selectedTeamLeader.id || '';
      }

      let result;

      if (editingTeam) {
        result = await api.updateTeam(editingTeam._id || editingTeam.id || '', teamData);
      } else {
        result = await api.createTeam(teamData);
      }

      if (result.success) {
        showSnackbar(
          result.message || (editingTeam ? 'Team updated successfully!' : 'Team created successfully!'),
          'success'
        );

        const teamsData: Team[] = await api.getTeams();
        setTeams(teamsData || []);

        closeTeamForm();
      } else {
        showSnackbar(
          result.message || (editingTeam ? 'Failed to update team.' : 'Failed to create team.'),
          'error'
        );
      }
    } catch (error: any) {
      showSnackbar(`Error: ${error.message}`, 'error');
    } finally {
      setTeamFormLoading(false);
    }
  };

  // Handle team form input change
  const handleTeamFormChange = (field: keyof TeamFormData, value: any): void => {
    setTeamFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (teamFormErrors[field]) {
      setTeamFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle team leader selection
  const handleTeamLeaderChange = (e: SelectChangeEvent<string>): void => {
    const leaderId = e.target.value;
    const leader = availableTeamLeaders.find(l => l.id === leaderId || l._id === leaderId);
    setSelectedTeamLeader(leader || null);
    if (teamFormErrors.teamLeader) {
      setTeamFormErrors(prev => ({ ...prev, teamLeader: '' }));
    }
  };

  // Toggle team member selection
  const toggleTeamMember = (member: User): void => {
    setSelectedTeamMembers(prev => {
      const isSelected = prev.some(m => (m._id || m.id) === (member._id || member.id));
      if (isSelected) {
        return prev.filter(m => (m._id || m.id) !== (member._id || member.id));
      } else {
        return [...prev, member];
      }
    });
  };

  // Remove a team member
  const removeTeamMember = (memberId: string): void => {
    setSelectedTeamMembers(prev => prev.filter(m => (m._id || m.id) !== memberId));
  };

  // Open member selection dialog
  const openMemberDialog = async (): Promise<void> => {
    await fetchAvailableTeamMembers();
    setMemberDialogOpen(true);
  };

  // Close member selection dialog
  const closeMemberDialog = (): void => {
    setMemberDialogOpen(false);
  };

  // Open team action menu
  const handleTeamMenuOpen = (event: React.MouseEvent<HTMLElement>, team: Team): void => {
    event.stopPropagation();
    setTeamActionMenuAnchor(event.currentTarget);
    setTeamMenuTarget(team);
  };

  // Close team action menu
  const handleTeamMenuClose = (): void => {
    setTeamActionMenuAnchor(null);
    setTeamMenuTarget(null);
  };

  // Open team delete confirmation dialog
  const openTeamDeleteDialog = (team: Team): void => {
    setTeamToDelete(team);
    setTeamDeleteDialogOpen(true);
    handleTeamMenuClose();
  };

  // Handle team deletion
  const handleDeleteTeam = async (): Promise<void> => {
    if (!teamToDelete) return;

    setLoading(true);

    try {
      const teamId = teamToDelete._id || teamToDelete.id || '';
      const result = await api.deleteTeam(teamId);

      if (result.success) {
        showSnackbar(result.message || 'Team deleted successfully!', 'success');
        setTeams(teams.filter(team => (team._id || team.id) !== teamId));
      } else {
        showSnackbar(result.message || 'Failed to delete team.', 'error');
      }
    } catch (error: any) {
      showSnackbar(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setTeamDeleteDialogOpen(false);
      setTeamToDelete(null);
    }
  };

  // Select a team to view its racks
  const selectTeamForRacks = (team: Team): void => {
    setRacks([]);
    setTotalRacks(0);
    setRackPage(0);
    setRackSearch('');
    setSelectedTeam(team);
    setActiveTab('racks');

    setCurrentAuditType(team.auditType || 'TVS');

    handleTeamMenuClose();
  };

  // ----- RACK OPERATIONS -----

  // Open rack action menu
  const handleRackMenuOpen = (event: React.MouseEvent<HTMLElement>, rack: Rack): void => {
    setRackActionMenuAnchor(event.currentTarget);
    setRackMenuTarget(rack);
  };

  // Close rack action menu
  const handleRackMenuClose = (): void => {
    setRackActionMenuAnchor(null);
    setRackMenuTarget(null);
  };

  // Open rack delete confirmation dialog
  const openRackDeleteDialog = (rack: Rack): void => {
    setRackToDelete(rack);
    setRackDeleteDialogOpen(true);
    handleRackMenuClose();
  };

  // Handle edit rack form field changes
  const handleEditRackChange = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const { name, value } = e.target;

    setEditRackData(prev => ({
      ...prev,
      [name]: value
    }));

    if (editRackErrors[name as keyof RackEditErrors]) {
      setEditRackErrors(prev => ({ ...prev, [name]: '' }));
    }

    // If partNo changes → search through existing racks for matching part details
    if (name === "partNo" && value.trim()) {
      try {
        console.log('Searching for part details in existing data:', value);

        const matchingRack = racks.find(rack =>
          rack.partNo &&
          rack.partNo.toLowerCase().trim() === value.toLowerCase().trim() &&
          rack.partNo !== rackToView?.partNo
        );

        if (matchingRack) {
          console.log('Found matching rack with part details:', matchingRack);

          setEditRackData(prev => ({
            ...prev,
            partNo: value,
            mrp: matchingRack.mrp?.toString() || prev.mrp || '',
            ndp: matchingRack.ndp?.toString() || prev.ndp || '',
            materialDescription: matchingRack.materialDescription || prev.materialDescription || ''
          }));

          showSnackbar(`Found details for part ${value}`, 'info');
        } else {
          console.log('No matching part found in existing data for:', value);

          try {
            console.log('Searching via API...');
            const searchResults = await api.getRacks({
              search: value,
              limit: 10
            });

            if (searchResults && searchResults.racks && searchResults.racks.length > 0) {
              const exactMatch = searchResults.racks.find(rack =>
                rack.partNo && rack.partNo.toLowerCase().trim() === value.toLowerCase().trim()
              );

              const bestMatch = exactMatch || searchResults.racks[0];

              if (bestMatch && bestMatch.partNo === value) {
                console.log('Found part details via API search:', bestMatch);

                setEditRackData(prev => ({
                  ...prev,
                  partNo: value,
                  mrp: bestMatch.mrp?.toString() || prev.mrp || '',
                  ndp: bestMatch.ndp?.toString() || prev.ndp || '',
                  materialDescription: bestMatch.materialDescription || prev.materialDescription || ''
                }));

                showSnackbar(`Found details for part ${value} via search`, 'success');
              }
            }
          } catch (apiError: any) {
            console.log('API search failed:', apiError);
          }
        }
      } catch (error: any) {
        console.error("Error searching for part details:", error);
      }
    }
  };

  // Validate edit rack form
  const validateEditRackForm = (): boolean => {
    const errors: RackEditErrors = {};

    if (!editRackData.rackNo.trim()) errors.rackNo = 'Rack No. is required';
    if (!editRackData.partNo.trim()) errors.partNo = 'Part No. is required';
    if (!editRackData.location.trim()) errors.location = 'Location is required';

    if (!editRackData.nextQty.trim()) {
      errors.nextQty = 'Quantity is required';
    } else {
      const qty = parseInt(editRackData.nextQty);
      if (isNaN(qty) || qty < 0) errors.nextQty = 'Enter a valid quantity';
    }

    if (editRackData.mrp.trim()) {
      const mrp = parseFloat(editRackData.mrp);
      if (isNaN(mrp) || mrp < 0) errors.mrp = 'Enter a valid MRP';
    }

    if (editRackData.ndp.trim()) {
      const ndp = parseFloat(editRackData.ndp);
      if (isNaN(ndp) || ndp < 0) errors.ndp = 'Enter a valid NDP';
    }

    setEditRackErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Sync edit form when rackToView changes
  useEffect(() => {
    if (rackToView && isEditingRackDetails) {
      setEditRackData({
        rackNo: rackToView.rackNo || '',
        partNo: rackToView.partNo || '',
        mrp: rackToView.mrp?.toString() || '',
        nextQty: rackToView.nextQty?.toString() || '',
        location: rackToView.location || '',
        materialDescription: rackToView.materialDescription || '',
        ndp: rackToView.ndp?.toString() || ''
      });
    }
  }, [rackToView, isEditingRackDetails]);

  // Handle saving edited rack
  const handleSaveRackEdit = async (): Promise<void> => {
    if (!validateEditRackForm()) return;

    setRackFormLoading(true);

    try {
      const updatedRack: Record<string, any> = {
        rackNo: editRackData.rackNo,
        partNo: editRackData.partNo,
        mrp: editRackData.mrp ? parseFloat(editRackData.mrp) : null,
        nextQty: parseInt(editRackData.nextQty) || 0,
        location: editRackData.location,
        materialDescription: editRackData.materialDescription,
        ndp: editRackData.ndp ? parseFloat(editRackData.ndp) : null
      };

      const rackId = rackToView?._id || rackToView?.id;
      if (!rackId) throw new Error('Rack ID not found');

      const result = await api.updateRack(rackId, updatedRack);

      if (result.success) {
        showSnackbar('Rack updated successfully!', 'success');
        setRackDetailsOpen(false);

        if (rackToView) {
          setRackToView(prev => ({
            ...prev!,
            ...updatedRack,
            updatedAt: new Date().toISOString()
          }));
        }

        loadRacks();
      } else {
        showSnackbar(result.message || 'Failed to update rack!', 'error');
      }
    } catch (error: any) {
      console.error("Error saving rack:", error);
      showSnackbar(`Error: ${error.message}`, 'error');
    } finally {
      setRackFormLoading(false);
    }
  };

  // Handle rack deletion
  const handleDeleteRack = async (): Promise<void> => {
    if (!rackToDelete) return;

    setLoading(true);

    try {
      const rackId = rackToDelete._id || rackToDelete.id;
      if (!rackId) throw new Error('Rack ID not found');

      const result = await api.deleteRack(rackId);

      if (result.success) {
        showSnackbar(result.message || 'Rack deleted successfully!', 'success');
        loadRacks();
      } else {
        showSnackbar(result.message || 'Failed to delete rack.', 'error');
      }
    } catch (error: any) {
      showSnackbar(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setRackDeleteDialogOpen(false);
      setRackToDelete(null);
    }
  };

  // ----- ADD PARTNO OPERATIONS -----

  const openAddPartnoDialog = () => {
    setNewRackData({
      rackNo: '',
      partNo: '',
      mrp: '',
      nextQty: '',
      location: '',
      materialDescription: '',
      ndp: ''
    });
    setAddRackErrors({});
    setAddPartnoDialogOpen(true);
  };

  const closeAddPartnoDialog = () => {
    setAddPartnoDialogOpen(false);
    setNewRackData({
      rackNo: '',
      partNo: '',
      mrp: '',
      nextQty: '',
      location: '',
      materialDescription: '',
      ndp: ''
    });
    setAddRackErrors({});
  };

  const handleNewRackChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewRackData(prev => ({ ...prev, [name]: value }));

    if (addRackErrors[name as keyof RackEditErrors]) {
      setAddRackErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === "partNo" && value.trim()) {
      try {
        // Try to find in current racks first for speed
        const matchingRack = racks.find(r => r.partNo?.toLowerCase() === value.toLowerCase());
        if (matchingRack) {
          setNewRackData(prev => ({
            ...prev,
            mrp: matchingRack.mrp?.toString() || '',
            ndp: matchingRack.ndp?.toString() || '',
            materialDescription: matchingRack.materialDescription || ''
          }));
          return;
        }

        // Otherwise check master via API
        const response = await api.checkPartNoInMaster(value, selectedTeam?.siteName || '');
        if (response.success && response.exists) {
          const { mrp, ndp, description } = response.data;
          setNewRackData(prev => ({
            ...prev,
            mrp: mrp?.toString() || '',
            ndp: ndp?.toString() || '',
            materialDescription: description || ''
          }));
        }
      } catch (error) {
        console.error("Error fetching part details:", error);
      }
    }
  };

  const validateAddRackForm = (): boolean => {
    const errors: RackEditErrors = {};
    if (!newRackData.rackNo.trim()) errors.rackNo = 'Rack No. is required';
    if (!newRackData.partNo.trim()) errors.partNo = 'Part No. is required';
    if (!newRackData.nextQty.trim()) errors.nextQty = 'Quantity is required';
    if (!newRackData.location.trim()) errors.location = 'Location is required';

    setAddRackErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddPartnoSubmit = async () => {
    if (!validateAddRackForm()) return;
    setAddRackLoading(true);
    try {
      const rackData = {
        rackNo: newRackData.rackNo,
        partNo: newRackData.partNo,
        nextQty: parseInt(newRackData.nextQty),
        siteName: selectedTeam?.siteName,
        location: newRackData.location,
        remark: selectedTeam?.auditType === 'TATA' ? 'No Remark' : undefined
      };

      const result = await api.createRack(rackData);
      if (result.success) {
        showSnackbar('Part number added successfully!', 'success');
        closeAddPartnoDialog();
        loadRacks();
      } else {
        showSnackbar(result.message || 'Failed to add part number', 'error');
      }
    } catch (error: any) {
      showSnackbar(error.message || 'Error adding part number', 'error');
    } finally {
      setAddRackLoading(false);
    }
  };

  // Open rack details view
  const openRackDetails = (rack: Rack): void => {
    console.log("Opening rack details for:", rack);
    setRackToView(rack);
    setIsEditingRackDetails(false);
    setEditRackErrors({});
    setRackDetailsOpen(true);
    handleRackMenuClose();
  };

  // Handle pagination for racks
  const handleRackPageChange = (event: unknown, newPage: number): void => {
    setRackPage(newPage);
    loadRacks();
  };

  // Handle rows per page change for racks
  const handleRacksPerPageChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setRacksPerPage(parseInt(event.target.value, 10));
    setRackPage(0);
    loadRacks();
  };

  // Handle date selection for racks
  const handleDateChange = (date: Date | null): void => {
    setSelectedDate(date);
    setRackPage(0);
  };

  // Export racks to Excel
  const exportRacksToExcel = async (): Promise<void> => {
    if (!selectedTeam) return;

    setLoading(true);
    showSnackbar('Preparing Excel download...', 'info');

    try {
      const params: Record<string, any> = {
        teamId: selectedTeam._id || selectedTeam.id,
        ...(rackSearch && { search: rackSearch }),
        ...(selectedDate && { date: format(selectedDate, 'yyyy-MM-dd') })
      };

      console.log('Downloading with params:', params);

      const blob = await api.downloadRacksExcel(params);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename
      const dateStr = selectedDate
        ? format(selectedDate, 'yyyy-MM-dd')
        : format(new Date(), 'yyyyMMdd');

      const siteName = selectedTeam.siteName?.replace(/[^a-zA-Z0-9]/g, '_') || 'racks';
      const filename = `${siteName}_${dateStr}.xlsx`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar(`Downloaded successfully!`, 'success');

    } catch (error: any) {
      console.error('Export error:', error);
      showSnackbar(error.message || 'Export failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle finish work
  const handleFinishWork = async (): Promise<void> => {
    if (!selectedTeam) return;

    if (totalRacks === 0) {
      showSnackbar('No racks to finish work for.', 'warning');
      return;
    }

    const isTATA = selectedTeam.auditType === 'TATA';

    const closeDialog = (): void => {
      setTeamDeleteDialogOpen(false);
      setTeamToDelete(null);
    };

    // Different messages based on audit type
    const finishWorkMessage = isTATA
      ? `Are you sure you want to finish work for site "${selectedTeam.siteName}" (TATA Mode)?\n\nThis action will:\n• Save a grouped snapshot of all current data\n• Clear team members and leader from the team`
      : `Are you sure you want to finish work for site "${selectedTeam.siteName}" (TVS Mode)?\n\nThis action will:\n• Save a snapshot of all current rack data\n• Clear team members and leader from the team`;

    const confirmationDialog = {
      title: 'Confirm Finish Work',
      message: finishWorkMessage,
      onConfirm: async (): Promise<void> => {
        setLoading(true);

        try {
          showSnackbar('Fetching all records for submission...', 'info');
          const allRacksForSubmission: Rack[] = await api.exportAllRacks({
            teamId: selectedTeam._id || selectedTeam.id,
            search: rackSearch || undefined,
            date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined
          });

          if (allRacksForSubmission.length === 0) {
            throw new Error('Could not fetch records to submit.');
          }

          let exportRows;

          if (isTATA) {
            // TATA: Group by partNo for snapshot
            const groupedByPartNo: Record<string, Rack[]> = {};

            allRacksForSubmission.forEach(rack => {
              const partNo = rack.partNo || '';
              if (!groupedByPartNo[partNo]) {
                groupedByPartNo[partNo] = [];
              }
              groupedByPartNo[partNo].push(rack);
            });

            exportRows = Object.entries(groupedByPartNo).map(([partNo, racks], index) => {
              const latestRack = racks[0];
              const totalQty = racks.reduce((sum, rack) => sum + (rack.nextQty || 0), 0);

              return {
                sNo: index + 1,
                'Product Category': latestRack.location || '',
                Location: racks.map(r => r.rackNo).join(', '),
                partNo: partNo,
                nextQty: totalQty,
                mrp: latestRack.mrp || 0,
                materialDescription: latestRack.materialDescription || '',
                remark: latestRack.remark || '',
                siteName: latestRack.siteName || selectedTeam.siteName || ''
              };
            });
          } else {
            // TVS: Individual racks for snapshot
            exportRows = allRacksForSubmission.map((rack, index) => ({
              sNo: index + 1,
              location: rack.location || '',
              rackNo: rack.rackNo || '',
              partNo: rack.partNo || '',
              nextQty: rack.nextQty || 0,
              mrp: rack.mrp || 0,
              ndp: rack.ndp || 0,
              materialDescription: rack.materialDescription || '',
              siteName: rack.siteName || selectedTeam.siteName || ''
            }));
          }

          const snapshotResponse = await api.saveExportedRacksSnapshot(
            exportRows,
            selectedTeam._id || selectedTeam.id || '',
            selectedTeam.siteName
          );

          if (snapshotResponse.success !== true) {
            throw new Error(snapshotResponse.message || 'Failed to save rack snapshot.');
          }

          showSnackbar(snapshotResponse.message || 'Rack snapshot saved!', 'success');

          const teamCompletionResponse = await api.completeTeamWork(selectedTeam._id || selectedTeam.id || '');
          if (teamCompletionResponse.success !== true) {
            throw new Error(teamCompletionResponse.message || 'Failed to complete team work.');
          }

          showSnackbar(
            teamCompletionResponse.message || 'Team work completed successfully!',
            'success'
          );

          loadRacks();
          checkWorkStatus();
        } catch (error: any) {
          showSnackbar(`Error finishing work: ${error.message}`, 'error');
        } finally {
          setLoading(false);
          closeDialog();
        }
      },
    };

    setTeamDeleteDialogOpen(true);
    setTeamToDelete({
      ...selectedTeam,
      _isFinishWorkAction: true,
      confirmationDialog
    } as any);
  };

  // Get initials from name
  const getInitials = (name: string): string => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Render status chip for rack quantity
  const renderStatusChip = (quantity: number): JSX.Element => {
    const status = getQuantityStatus(quantity);
    let label = "";

    switch (status) {
      case "in_stock":
        label = "In Stock";
        break;
      case "low_stock":
        label = "Low Stock";
        break;
      case "out_of_stock":
        label = "Out of Stock";
        break;
      default:
        label = "Unknown";
    }

    return (
      <StatusChip
        label={label}
        color={getQuantityStatusColor(status)}
        icon={
          status === "in_stock" ? (
            <CheckCircleIcon style={{ fontSize: 16 }} />
          ) : status === "low_stock" ? (
            <WarningIcon style={{ fontSize: 16 }} />
          ) : (
            <ErrorIcon style={{ fontSize: 16 }} />
          )
        }
      />
    );
  };

  // Determine if current user can edit/delete
  const canEditDelete = (): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'team_leader') {
      if (selectedTeam && selectedTeam.teamLeader) {
        const teamLeader = selectedTeam.teamLeader as User;
        return teamLeader._id === currentUser._id || teamLeader.id === currentUser.id;
      }
    }
    return false;
  };

  // Render teams view
  function renderTeamsView(): JSX.Element {
    const hasFilteredTeams = filteredTeams.length > 0;
    const hasFilters = !!(teamSearch || teamStatusFilter !== 'all');

    return (
      <>
        {/* Page Header */}


        {/* Filters Section */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, mb: 3, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterListIcon sx={{ color: primaryColor }} />
              <Typography variant="h6" fontWeight={600}>
                Filters & Options
              </Typography>
            </Box>
            <Box>
              <Button
                size="small"
                onClick={clearFilters}
                startIcon={<ClearIcon />}
                disabled={!teamSearch && teamStatusFilter === 'all'}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => handleRefresh()}
                sx={{
                  ml: 1,
                  borderColor: primaryColor,
                  color: primaryColor,
                  '&:hover': {
                    bgcolor: `${primaryColor}10`,
                    borderColor: primaryColor
                  }
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                placeholder="Search teams by name or location"
                variant="outlined"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: teamSearch && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setTeamSearch('')}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={teamStatusFilter}
                  onChange={(e) => setTeamStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>


            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={openCreateTeamForm}
                  sx={{
                    bgcolor: primaryColor,
                    '&:hover': { bgcolor: secondaryColor },
                    borderRadius: 2,
                    px: 3,
                    py: 1
                  }}
                >
                  Add New Team
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* Teams List */}
        {!hasFilteredTeams ? (
          renderEmptyState('teams', hasFilters)
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Showing {filteredTeams.length} of {teams.length} teams
            </Typography>

            <Grid container spacing={2}>
              {filteredTeams.map((team) => {
                const teamHasMembers = Array.isArray(team.members) && team.members.length > 0;
                const statusColor = getStatusColor(team.status);

                return (
                  <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={team._id || team.id}>
                    <StyledCard
                      active={selectedTeam ? (selectedTeam._id === team._id || selectedTeam.id === team.id) : false}
                      onClick={() => selectTeamForRacks(team)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ bgcolor: primaryColor, mr: 2 }}>
                              {team.siteName?.charAt(0).toUpperCase() || "?"}
                            </Avatar>
                            <Box>
                              <Typography variant="h6" fontWeight="bold">
                                {team.siteName}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                <LocationIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="textSecondary">
                                  {team.location || "No location"}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTeamMenuOpen(e, team);
                              }}
                            >
                              <MoreVertIcon />
                            </IconButton>

                            <StatusChip
                              label={team.status || "Active"}
                              color={statusColor}
                              size="small"
                              sx={{ mt: 1 }}
                            />


                            {team.isNewSite && (
                              <Chip
                                label="New Site"
                                size="small"
                                sx={{
                                  bgcolor: `${warningColor}15`,
                                  color: warningColor,
                                  mt: 1,
                                  fontSize: '0.7rem',
                                  height: 10
                                }}
                              />
                            )}

                            {team.auditType && (
                              <Chip
                                label={team.auditType}
                                size="small"
                                sx={{
                                  bgcolor: team.auditType === 'TATA'
                                    ? `${warningColor}15`
                                    : `${primaryColor}15`,
                                  color: team.auditType === 'TATA' ? warningColor : primaryColor,
                                  mt: 1,
                                  fontSize: '0.7rem',
                                  height: 20
                                }}
                              />
                            )}
                          </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Team Leader
                          </Typography>

                          {team.teamLeader ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: `${primaryColor}40`, color: primaryColor }}>
                                {(team.teamLeader as User).name?.charAt(0).toUpperCase() || "?"}
                              </Avatar>
                              <Typography variant="body2">{(team.teamLeader as User).name}</Typography>
                            </Box>
                          ) : (
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                              No team leader assigned
                            </Typography>
                          )}

                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Team Members ({team.members?.length || 0})
                          </Typography>

                          {teamHasMembers ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {team.members!.slice(0, 3).map((member: any) => (
                                <Chip
                                  key={member._id || member.id}
                                  label={member.name}
                                  size="small"
                                  sx={{
                                    bgcolor: `${primaryColor}15`,
                                    color: primaryColor
                                  }}
                                />
                              ))}

                              {team.members!.length > 3 && (
                                <Chip
                                  label={`+${team.members!.length - 3} more`}
                                  size="small"
                                  sx={{
                                    bgcolor: `${primaryColor}05`,
                                    color: primaryColor
                                  }}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                              No members assigned
                            </Typography>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarIcon fontSize="small" color="action" />
                            <Typography variant="caption" color="textSecondary">
                              Created: {team.createdAt ? format(new Date(team.createdAt), 'dd MMM yyyy') : "N/A"}
                            </Typography>
                          </Box>

                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<NavigateNextIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectTeamForRacks(team);
                            }}
                            sx={{
                              borderColor: primaryColor,
                              color: primaryColor,
                              '&:hover': {
                                bgcolor: `${primaryColor}10`,
                                borderColor: primaryColor
                              }
                            }}
                          >
                            View Racks
                          </Button>
                        </Box>
                      </CardContent>
                    </StyledCard>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}
      </>
    );
  }

  // Render racks view
  function renderRacksView(): JSX.Element {
    if (!selectedTeam) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <BusinessIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Team Selected
          </Typography>
          <Typography color="textSecondary" paragraph>
            Please select a team to view its racks
          </Typography>
          <Button
            variant="contained"
            onClick={() => setActiveTab('teams')}
            sx={{
              bgcolor: primaryColor,
              '&:hover': { bgcolor: secondaryColor }
            }}
          >
            View Teams
          </Button>
        </Paper>
      );
    }

    const hasFilteredRacks = racks.length > 0;
    const hasFilters = !!(rackSearch || rackStatusFilter !== 'all' || selectedDate);

    return (
      <>
        {/* Team Info Header */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            mb: 2,
            mt: -10,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
            color: 'white'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%'
            }}
          >
            {/* Left: Back to Teams button */}
            <Box>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => {
                  setActiveTab('teams');
                  setSelectedTeam(null);
                  loadInitialData();
                }}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    borderColor: 'white',
                    bgcolor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                Back to Teams
              </Button>
            </Box>

            {/* Center: Site info */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold">
                {selectedTeam?.siteName || "Site Name"}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
                <LocationIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.8 }} />
                <Typography variant="body2" sx={{ opacity: 0.8, mr: 1 }}>
                  {selectedTeam?.location || "No location"}
                </Typography>
                <StatusChip
                  label={selectedTeam?.status || "Active"}
                  color="white"
                  size="small"
                  sx={{ mr: 1, bgcolor: 'rgba(255, 255, 255, 0.2)' }}
                />
                {selectedTeam?.auditType && (
                  <Chip
                    label={selectedTeam.auditType}
                    size="small"
                    sx={{
                      bgcolor: selectedTeam.auditType === 'TATA'
                        ? 'rgba(211, 84, 0, 0.9)'
                        : 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                )}
              </Box>
            </Box>

            {/* Right: Finish Work button */}
            <Box>
              {isWorkSubmitted ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Work Submitted"
                  color="success"
                  sx={{
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    color: successColor,
                    fontWeight: 600
                  }}
                />
              ) : (
                currentUser?.role === 'admin' && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleFinishWork}
                    disabled={loading}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.9)',
                      color: successColor,
                      '&:hover': {
                        bgcolor: 'white'
                      }
                    }}
                  >
                    Finish Work
                  </Button>
                )
              )}
            </Box>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, mb: 3, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterListIcon sx={{ color: primaryColor }} />
              <Typography variant="h6" fontWeight={600}>
                Filters & Options
              </Typography>
            </Box>
            <Box>
              <Button
                size="small"
                onClick={clearFilters}
                startIcon={<ClearIcon />}
                disabled={!rackSearch && rackStatusFilter === 'all' && !selectedDate}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => handleRefresh()}
                sx={{
                  ml: 1,
                  borderColor: primaryColor,
                  color: primaryColor,
                  '&:hover': {
                    bgcolor: `${primaryColor}10`,
                    borderColor: primaryColor
                  }
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                placeholder="Search racks by number, part or description"
                variant="outlined"
                value={rackSearch}
                onChange={(e) => setRackSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: rackSearch && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setRackSearch('')}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </Grid>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                Date:
              </Typography>
              <TextField
                placeholder="dd-mm-yyyy"
                type="date"
                size="small"
                value={selectedDate ? format(new Date(selectedDate), 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const newDate = e.target.value ? new Date(e.target.value) : null;
                  setSelectedDate(newDate);
                }}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: selectedDate && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedDate(null)}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: '180px',
                  '& input': { paddingLeft: selectedDate ? '8px' : '0' }
                }}
              />
            </Box>



            <Grid size={{ xs: 12, md: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={exportRacksToExcel}
                  disabled={loading || totalRacks === 0}
                  sx={{
                    borderColor: primaryColor,
                    color: primaryColor,
                    '&:hover': {
                      bgcolor: `${primaryColor}10`,
                      borderColor: primaryColor
                    }
                  }}
                >
                  Export {selectedTeam?.auditType === 'TATA' ? '(Grouped)' : ''}
                </Button>
                {currentUser?.role === 'admin' && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={openAddPartnoDialog}
                    sx={{
                      bgcolor: primaryColor,
                      '&:hover': { bgcolor: secondaryColor },
                      borderRadius: 2,
                      px: 3
                    }}
                  >
                    Add Partno
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* User Stats Chips */}
        {Object.keys(serverUserStats).length > 0 && (
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, mb: 3, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
              User Activity
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(serverUserStats).map(([userName, stats]) => (
                <Chip
                  key={userName}
                  icon={<PersonIcon sx={{ color: primaryColor }} />}
                  label={`${userName}: ${stats.totalCount}${stats.firstScanTime ? ` (${format(stats.firstScanTime, 'hh:mm a')})` : ''
                    }`}
                  variant="outlined"
                  sx={{
                    borderColor: primaryColor,
                    color: primaryColor,
                    backgroundColor: `${primaryColor}10`
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}

        {/* Rack Stats Summary */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            mb: 3,
            backgroundColor: 'white',
            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)'
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              Inventory Summary
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(16,185,129, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="h5" fontWeight="bold" color={successColor}>
                  {racks.filter(r => getQuantityStatus(r.nextQty) === "in_stock").length}
                </Typography>
                <Typography variant="body2" color={successColor}>
                  In Stock
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(245,158,11, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="h5" fontWeight="bold" color={warningColor}>
                  {racks.filter(r => getQuantityStatus(r.nextQty) === "low_stock").length}
                </Typography>
                <Typography variant="body2" color={warningColor}>
                  Low Stock
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(239,68,68, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="h5" fontWeight="bold" color={errorColor}>
                  {racks.filter(r => getQuantityStatus(r.nextQty) === "out_of_stock").length}
                </Typography>
                <Typography variant="body2" color={errorColor}>
                  Out of Stock
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <Box sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(0,79,152, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="h5" fontWeight="bold" color={primaryColor}>
                  {totalRacks}
                </Typography>
                <Typography variant="body2" color={primaryColor}>
                  Total Racks
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              {/* N/A Counter Card */}
              <Box sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(107,114,128, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                {/*  show the total N/A count here */}
                <Typography variant="h5" fontWeight="bold" color="#6B7280">
                  {loadingMissingInfo ? (
                    <CircularProgress size={20} sx={{ color: '#6B7280' }} />
                  ) : (
                    totalMissingInfo
                  )}
                </Typography>

                <Tooltip title="View racks with missing information">
                  <Button
                    size="small"
                    sx={{ mt: -1, color: '#6B7280', fontSize: '0.7rem' }}
                    onClick={() => {
                      setRackSearch('n/a');   // ✅ clicking shows all N/A racks
                    }}
                  >
                    View N/A
                  </Button>
                </Tooltip>
              </Box>
            </Grid>

          </Grid>
        </Paper>

        {/* Racks Content */}
        {!hasFilteredRacks ? (
          renderEmptyState('racks', hasFilters)
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="textSecondary">
                Showing {racks.length} of {totalRacks} racks
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SortIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
                <Typography variant="body2" color="textSecondary">
                  {rackSortOrder.includes('rack') ? 'Rack No.' :
                    rackSortOrder.includes('qty') ? 'Quantity' : 'Price'}
                </Typography>
              </Box>
            </Box>




            {/* Table View */}
            <StyledTableContainer {...({ component: Paper, elevation: 0 } as any)}>
              <Table size="medium">
                {/* Table Header */}
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell>{currentAuditType === 'TATA' ? 'Product Category' : 'Location'}</TableCell>
                    <TableCell>{currentAuditType === 'TATA' ? 'Location' : 'Rack No.'}</TableCell>
                    <TableCell>Part No.</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell>Status</TableCell>
                    {currentAuditType !== 'TATA' && <TableCell align="right">MRP (₹)</TableCell>}
                    <TableCell align="right">NDP (₹)</TableCell>
                    <TableCell>Description</TableCell>
                    {currentAuditType === 'TATA' && <TableCell>Remark</TableCell>}
                    {rackSearch === 'n/a' && <TableCell>Missing Info</TableCell>}
                    <TableCell>Scanned By</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {racks.map((rack) => (
                    <TableRow key={rack._id || rack.id} hover>
                      <TableCell>{format(new Date(rack.createdAt), 'dd-MM-yyyy')}</TableCell>
                      <TableCell>{rack.siteName}</TableCell>
                      <TableCell>
                        <Chip
                          label={rack.location}
                          size="small"
                          sx={{
                            bgcolor: `${primaryColor}15`,
                            color: primaryColor,
                            fontWeight: 500,
                            fontSize: '0.7rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="bold">{rack.rackNo}</Typography>
                      </TableCell>
                      <TableCell>{rack.partNo}</TableCell>
                      <TableCell align="right">{rack.nextQty || 0}</TableCell>
                      <TableCell>{renderStatusChip(rack.nextQty)}</TableCell>
                      <TableCell align="right">{rack.ndp ? `₹${rack.ndp.toFixed(2)}` : 'N/A'}</TableCell>
                      {currentAuditType !== 'TATA' && (
                        <TableCell align="right">{rack.mrp ? `₹${rack.mrp.toFixed(2)}` : 'N/A'}</TableCell>
                      )}
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={rack.materialDescription}
                        >
                          {rack.materialDescription || 'N/A'}
                        </Typography>

                      </TableCell>
                      {currentAuditType === 'TATA' && (
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rack.remark}>
                            {rack.remark || '-'}
                          </Typography>
                        </TableCell>
                      )}
                      {rackSearch.toLowerCase().includes('na') && (
                        <TableCell>
                          {(!rack.ndp || rack.ndp === 0) && (
                            <Chip label="Missing NDP" color="warning" size="small" sx={{ mr: 0.5 }} />
                          )}
                          {(!rack.mrp || rack.mrp === 0) && (
                            <Chip label="Missing MRP" color="error" size="small" sx={{ mr: 0.5 }} />
                          )}
                          {(!rack.materialDescription || rack.materialDescription.trim() === '') && (
                            <Chip label="Missing Description" color="info" size="small" />
                          )}
                        </TableCell>
                      )}
                      <TableCell>{rack.scannedBy?.name || 'Unknown'}</TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => openRackDetails(rack)}>
                              <VisibilityIcon fontSize="small" sx={{ color: primaryColor }} />
                            </IconButton>
                          </Tooltip>

                          {canEditDelete() && (
                            <Tooltip title="Delete Rack">
                              <IconButton size="small" onClick={() => openRackDeleteDialog(rack)}>
                                <DeleteIcon fontSize="small" color="error" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={totalRacks}
                rowsPerPage={racksPerPage}
                page={rackPage}
                onPageChange={handleRackPageChange}
                onRowsPerPageChange={handleRacksPerPageChange}
              />
            </StyledTableContainer>
          </>
        )}
      </>
    );
  }

  // Main render
  return (
    <Box sx={{ bgcolor: backgroundColor, flexGrow: 1, minHeight: '100vh' }}>
      <PageHero
        title={activeTab === 'teams' ? "Team Management" : "Rack Management"}
        subtitle={activeTab === 'teams'
          ? "View, create, edit and manage all system Teams"
          : `Managing racks for ${selectedTeam?.siteName || 'selected team'}`
        }
      />

      {/* Main Content */}
      <ContentContainer maxWidth="xl" sx={{ mt: -5, position: 'relative', zIndex: 2 }}>
        <LoadingOverlay open={loading} message={activeTab === 'teams' ? "Loading Teams..." : "Loading Racks..."} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {activeTab === 'teams' ? renderTeamsView() : renderRacksView()}
      </ContentContainer>

      {/* Team Action Menu */}
      <Menu
        anchorEl={teamActionMenuAnchor}
        open={Boolean(teamActionMenuAnchor)}
        onClose={handleTeamMenuClose}
        elevation={3}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            selectTeamForRacks(teamMenuTarget!);
            handleTeamMenuClose();
            handleRefresh();
          }}
        >
          <VisibilityIcon fontSize="small" sx={{ mr: 1 }} /> View Racks
        </MenuItem>
        <MenuItem
          onClick={() => {
            openEditTeamForm(teamMenuTarget!);
            handleTeamMenuClose();
            setActiveTab('teams');
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit Team
        </MenuItem>
        <MenuItem
          onClick={() => {
            openTeamDeleteDialog(teamMenuTarget!);
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete Team
        </MenuItem>
      </Menu>

      <TeamForm
        open={teamFormOpen}
        onClose={closeTeamForm}
        onSubmit={handleTeamFormSubmit}
        formData={teamFormData}
        onChange={handleTeamFormChange}
        errors={teamFormErrors}
        loading={teamFormLoading}
        editingTeam={editingTeam}
        currentUser={currentUser}
        availableTeamLeaders={availableTeamLeaders}
        selectedTeamLeader={selectedTeamLeader}
        onTeamLeaderChange={handleTeamLeaderChange}
        selectedTeamMembers={selectedTeamMembers}
        onOpenMemberDialog={openMemberDialog}
        onGetCurrentLocation={getCurrentLocation}
        gettingLocation={gettingLocation}
        getInitials={getInitials}
      />

      {/* Team Member Selection Dialog */}
      <MemberAssignmentDialog
        open={memberDialogOpen}
        onClose={closeMemberDialog}
        searchQuery={memberSearchQuery}
        onSearchChange={setMemberSearchQuery}
        availableMembers={availableTeamMembers}
        selectedMembers={selectedTeamMembers}
        onToggleMember={toggleTeamMember}
        getInitials={getInitials}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        backgroundColor={backgroundColor}
      />

      {/* Team Delete Confirmation Dialog */}
      <TeamDeleteDialog
        open={teamDeleteDialogOpen}
        onClose={() => setTeamDeleteDialogOpen(false)}
        team={teamToDelete}
        onConfirm={teamToDelete?._isFinishWorkAction
          ? (teamToDelete?.confirmationDialog?.onConfirm || (() => { }))
          : handleDeleteTeam}
        loading={loading}
        successColor={successColor}
        errorColor={errorColor}
      />

      {/* Rack Delete Confirmation Dialog */}
      <Dialog
        open={rackDeleteDialogOpen}
        onClose={() => setRackDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
          Confirm Rack Deletion
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              sx={{
                bgcolor: `${errorColor}20`,
                color: errorColor,
                mr: 2
              }}
            >
              <DeleteIcon />
            </Avatar>
            <Typography variant="body1">
              Are you sure you want to delete rack "{rackToDelete?.rackNo}"?
            </Typography>
          </Box>
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            This action cannot be undone. All data associated with this rack will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button
            onClick={() => setRackDeleteDialogOpen(false)}
            disabled={loading}
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteRack}
            color="error"
            variant="contained"
            disabled={loading}
            sx={{
              bgcolor: errorColor,
              '&:hover': { bgcolor: '#D32F2F' },
              px: 3
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Delete Rack'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rack Details Dialog */}
      {/* Rack Details/Edit Dialog */}
      {/* Rack Details/Edit Dialog */}
      {/* Rack Details Dialog - Optimized for Performance */}
      <Dialog
        open={rackDetailsOpen}
        onClose={() => {
          setRackDetailsOpen(false);
          setIsEditingRackDetails(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden',
            maxHeight: '90vh'
          }
        }}
        TransitionComponent={Slide} // Use Slide transition for smoother opening
        TransitionProps={{
          direction: "up",
          timeout: { enter: 300, exit: 200 }
        } as any}
      >
        {rackToView && (
          <>
            <DialogTitle
              sx={{
                p: 0,
                position: 'relative',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: primaryColor,
                color: 'white',
                px: 3
              }}
            >
              <Typography variant="h6" fontWeight="bold">
                {isEditingRackDetails ? "Edit Rack" : "Rack Details"}: {rackToView.rackNo}
              </Typography>

              <Box>
                {!isEditingRackDetails && canEditDelete() && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditRackData({
                        rackNo: rackToView.rackNo || '',
                        partNo: rackToView.partNo || '',
                        mrp: rackToView.mrp?.toString() || '',
                        nextQty: rackToView.nextQty?.toString() || '',
                        location: rackToView.location || '',
                        materialDescription: rackToView.materialDescription || '',
                        ndp: rackToView.ndp?.toString() || ''
                      });
                      setIsEditingRackDetails(true);
                    }}
                    sx={{ color: 'white', mr: 1 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>

                )}

                <IconButton
                  size="small"
                  onClick={() => setRackDetailsOpen(false)}
                  sx={{ color: 'white' }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </DialogTitle>

            <DialogContent
              sx={{
                p: 0,
                "&::-webkit-scrollbar": {
                  width: 8,
                },
                "&::-webkit-scrollbar-track": {
                  backgroundColor: "#f1f1f1",
                  borderRadius: 4,
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#c1c1c1",
                  borderRadius: 4,
                }
              }}
            >
              {/* Lazy load content to improve performance */}
              {rackDetailsOpen && (
                <Box sx={{ p: 3, pb: 1 }}>
                  {/* Key Details Section - Always visible first */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      mb: 2,
                      border: `1px solid ${alpha(primaryColor, 0.1)}`
                    }}
                  >

                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        {isEditingRackDetails ? (
                          <TextField
                            fullWidth
                            required
                            size="small"
                            label="Rack Number"
                            name="rackNo"
                            value={editRackData.rackNo}
                            onChange={handleEditRackChange}
                            error={!!editRackErrors.rackNo}
                            helperText={editRackErrors.rackNo}
                            sx={{ mb: 2 }}
                          />
                        ) : (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                              Rack Number
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                              {rackToView.rackNo || 'N/A'}
                            </Typography>
                          </Box>
                        )}
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}>
                        {isEditingRackDetails ? (
                          <TextField
                            fullWidth
                            required
                            size="small"
                            label="Part Number"
                            name="partNo"
                            value={editRackData.partNo}
                            onChange={handleEditRackChange}
                            error={!!editRackErrors.partNo}
                            helperText={editRackErrors.partNo}
                            sx={{ mb: 2 }}
                          />
                        ) : (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                              Part Number
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                              {rackToView.partNo || 'N/A'}
                            </Typography>
                          </Box>
                        )}
                      </Grid>




                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            Quantity
                          </Typography>
                          <Typography
                            variant="body1"
                            fontWeight="bold"
                            color={getQuantityStatusColor(getQuantityStatus(rackToView.nextQty))}
                          >
                            {rackToView.nextQty || 0}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            Status
                          </Typography>
                          <Box>
                            {renderStatusChip(rackToView.nextQty)}
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Tabs for organization - improves performance by showing only what's needed */}
                  <Box sx={{ mb: 2 }}>
                    <Tabs
                      value={detailsActiveTab || 'info'}
                      onChange={(e, newValue) => setDetailsActiveTab(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        borderBottom: 1,
                        borderColor: 'divider',
                        mb: 2,
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          minWidth: 100,
                        }
                      }}
                    >
                      <Tab label="Basic Info" value="info" />
                      <Tab label="Pricing" value="pricing" />
                      <Tab label="Description" value="description" />
                      <Tab label="Activity" value="activity" />
                    </Tabs>

                    {/* Tab Content */}
                    {detailsActiveTab === 'info' && (
                      <Box>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            {isEditingRackDetails ? (
                              <TextField
                                fullWidth
                                size="small"
                                label="Location"
                                value={editRackData.location}
                                name="location"
                                onChange={handleEditRackChange}
                                error={!!editRackErrors.location}
                                helperText={editRackErrors.location}
                                sx={{ mb: 2 }}
                              />
                            ) : (
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="textSecondary">
                                  Location
                                </Typography>
                                <Typography variant="body1">
                                  {rackToView.location || 'N/A'}
                                </Typography>
                              </Box>
                            )}
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="caption" color="textSecondary">
                                Site
                              </Typography>
                              <Typography variant="body1">
                                {rackToView.siteName || selectedTeam?.siteName || 'N/A'}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                    )}

                    {detailsActiveTab === 'pricing' && (
                      <Box>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            {isEditingRackDetails ? (
                              <TextField
                                fullWidth
                                size="small"
                                label="MRP"
                                type="number"
                                value={editRackData.mrp}
                                name="mrp"
                                onChange={handleEditRackChange}
                                error={!!editRackErrors.mrp}
                                helperText={editRackErrors.mrp}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                }}
                                sx={{ mb: 2 }}
                              />
                            ) : (
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="textSecondary">
                                  MRP (₹)
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {rackToView.mrp ? `₹${rackToView.mrp.toFixed(2)}` : 'N/A'}
                                </Typography>
                              </Box>
                            )}
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            {isEditingRackDetails ? (
                              <TextField
                                fullWidth
                                size="small"
                                label="NDP"
                                type="number"
                                name="ndp"
                                value={editRackData.ndp}
                                onChange={handleEditRackChange}
                                error={!!editRackErrors.ndp}
                                helperText={editRackErrors.ndp}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                }}
                                sx={{ mb: 2 }}
                              />
                            ) : (
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="textSecondary">
                                  NDP (₹)
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {rackToView.ndp ? `₹${rackToView.ndp.toFixed(2)}` : 'N/A'}
                                </Typography>
                              </Box>
                            )}
                          </Grid>

                          {isEditingRackDetails && (
                            <Grid size={{ xs: 12 }}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Quantity"
                                type="number"
                                name="nextQty"
                                value={editRackData.nextQty}
                                onChange={handleEditRackChange}
                                error={!!editRackErrors.nextQty}
                                helperText={editRackErrors.nextQty}
                                sx={{ mb: 2 }}
                              />
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}

                    {detailsActiveTab === 'description' && (
                      <Box>
                        {isEditingRackDetails ? (
                          <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Material Description"
                            value={editRackData.materialDescription}
                            onChange={handleEditRackChange}
                            error={!!editRackErrors.materialDescription}
                            helperText={editRackErrors.materialDescription}
                            placeholder="Enter material description"
                          />
                        ) : (
                          <Box
                            sx={{
                              maxHeight: '200px',
                              overflow: 'auto',
                              p: 2,
                              border: `1px solid ${alpha(primaryColor, 0.1)}`,
                              borderRadius: 1,
                              bgcolor: '#fafafa'
                            }}
                          >
                            <Typography variant="body2">
                              {rackToView.materialDescription || 'No description available'}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}

                    {detailsActiveTab === 'activity' && !isEditingRackDetails && (
                      <Box>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="caption" color="textSecondary">
                                Scanned By
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                                <Avatar
                                  sx={{
                                    width: 24,
                                    height: 24,
                                    bgcolor: `${primaryColor}15`,
                                    color: primaryColor,
                                    fontSize: '0.75rem',
                                    mr: 1
                                  }}
                                >
                                  {rackToView.scannedBy?.name?.charAt(0).toUpperCase() || '?'}
                                </Avatar>
                                <Typography variant="body2">
                                  {rackToView.scannedBy?.name || 'Unknown'}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>

                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="caption" color="textSecondary">
                                Created Date
                              </Typography>
                              <Typography variant="body2">
                                {rackToView.createdAt
                                  ? format(new Date(rackToView.createdAt), 'dd-MM-yyyy hh:mm a')
                                  : 'Unknown date'}
                              </Typography>
                            </Box>
                          </Grid>

                          {rackToView.updatedAt && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="caption" color="textSecondary">
                                  Last Updated
                                </Typography>
                                <Typography variant="body2">
                                  {format(new Date(rackToView.updatedAt), 'dd-MM-yyyy hh:mm a')}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0, borderTop: '1px solid #eeeeee' }}>
              {isEditingRackDetails ? (
                <>
                  <Button
                    onClick={() => {
                      setIsEditingRackDetails(false);
                      // Reset edit form to original values
                      setEditRackData({
                        rackNo: rackToView.rackNo || '',
                        partNo: rackToView.partNo || '',
                        mrp: rackToView.mrp?.toString() || '',
                        nextQty: rackToView.nextQty?.toString() || '',
                        location: rackToView.location || '',
                        materialDescription: rackToView.materialDescription || '',
                        ndp: rackToView.ndp?.toString() || ''
                      });
                      setEditRackErrors({});
                    }}
                    variant="outlined"
                    sx={{
                      color: 'text.secondary',
                      borderColor: 'rgba(0, 0, 0, 0.23)',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveRackEdit}
                    variant="contained"
                    disabled={rackFormLoading}
                    startIcon={rackFormLoading ? <CircularProgress size={16} /> : <SaveIcon />}
                    sx={{
                      bgcolor: primaryColor,
                      '&:hover': { bgcolor: secondaryColor },
                      px: 3
                    }}
                  >
                    {rackFormLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setRackDetailsOpen(false)}
                    variant="outlined"
                    sx={{
                      color: 'text.secondary',
                      borderColor: 'rgba(0, 0, 0, 0.23)',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                  >
                    Close
                  </Button>
                  {canEditDelete() && (
                    <Button
                      onClick={() => {
                        setEditRackData({
                          rackNo: rackToView.rackNo || '',
                          partNo: rackToView.partNo || '',
                          mrp: rackToView.mrp?.toString() || '',
                          nextQty: rackToView.nextQty?.toString() || '',
                          location: rackToView.location || '',
                          materialDescription: rackToView.materialDescription || '',
                          ndp: rackToView.ndp?.toString() || ''
                        });
                        setIsEditingRackDetails(true);
                      }}
                      variant="contained"
                      startIcon={<EditIcon />}
                      sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: secondaryColor }, px: 3 }}
                    >
                      Edit Rack
                    </Button>

                  )}
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>



      <Dialog
        open={addPartnoDialogOpen}
        onClose={closeAddPartnoDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: primaryColor, color: 'white' }}>
          Add New Part Number to {selectedTeam?.siteName}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Rack Number"
                name="rackNo"
                value={newRackData.rackNo}
                onChange={handleNewRackChange}
                onInput={(e: any) => { e.target.value = e.target.value.toUpperCase(); }}
                error={!!addRackErrors.rackNo}
                helperText={addRackErrors.rackNo}
                margin="dense"
                autoComplete="off"
                sx={{ '& input': { textTransform: 'uppercase' } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Part Number"
                name="partNo"
                value={newRackData.partNo}
                onChange={handleNewRackChange}
                onInput={(e: any) => { e.target.value = e.target.value.toUpperCase(); }}
                error={!!addRackErrors.partNo}
                helperText={addRackErrors.partNo}
                margin="dense"
                autoComplete="off"
                sx={{ '& input': { textTransform: 'uppercase' } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Quantity"
                name="nextQty"
                type="number"
                value={newRackData.nextQty}
                onChange={handleNewRackChange}
                error={!!addRackErrors.nextQty}
                helperText={addRackErrors.nextQty}
                margin="dense"
                autoComplete="off"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Location"
                name="location"
                value={newRackData.location}
                onChange={handleNewRackChange}
                onInput={(e: any) => { e.target.value = e.target.value.toUpperCase(); }}
                error={!!addRackErrors.location}
                helperText={addRackErrors.location}
                margin="dense"
                autoComplete="off"
                sx={{ '& input': { textTransform: 'uppercase' } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Description"
                name="materialDescription"
                value={newRackData.materialDescription}
                onChange={handleNewRackChange}
                margin="dense"
                multiline
                rows={2}
                disabled
                placeholder="Auto-filled from part number"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeAddPartnoDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddPartnoSubmit}
            disabled={addRackLoading}
            sx={{ bgcolor: primaryColor }}
          >
            {addRackLoading ? <CircularProgress size={24} /> : 'Add Part Number'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mobile-only FAB for adding */}
      <Box sx={{ display: { md: 'none' } }}>
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            bgcolor: primaryColor,
            '&:hover': { bgcolor: secondaryColor }
          }}
          onClick={activeTab === 'teams' ? openCreateTeamForm : openAddPartnoDialog}
        >
          <AddIcon />
        </Fab>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
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

export default TeamManagement;
// Admin Navbar Component
import React, { useState, useEffect } from "react";
import type { MouseEvent } from "react";
import Logo from "../../assets/images/logo.png";


import {
  Box,
  Container,
  Typography,
  Toolbar,
  AppBar,
  Tabs,
  Tab,
  IconButton,
  Badge,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemButton,
  useTheme,
  useMediaQuery,
  Stack,
  SvgIcon,
} from "@mui/material";
import {
  People as PeopleIcon,
  Group as GroupsIcon,
  Description as DescriptionIcon,
  Analytics as AnalyticsIcon,
  Dashboard as DashboardIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
  AdminPanelSettings as AdminIcon,
  AccountCircle as AccountCircleIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Business,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";

type SvgIconComponent = typeof SvgIcon;
import { useNavigate, useLocation } from "react-router-dom";
import authManager from "../../services/authSession";

// Type definitions
type IconType = SvgIconComponent;

interface NavigationItem {
  label: string;
  icon: IconType;
  path: string;
}

interface Notification {
  id: number;
  message: string;
  time: string;
  read: boolean;
}

interface UserProfile {
  name?: string;
  email?: string;
  role?: string;
  [key: string]: any;
}

interface AdminNavbarProps {
  handleRefresh: () => void;
}

// --- Styled Components ---
const WebsiteHeader = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#FFFFFF",
  color: "#1F2937",
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  borderBottom: "1px solid #E5E7EB",
  position: "sticky",
  top: 0,
  zIndex: 1000,
}));

const WebsiteTab = styled(Tab)(({ theme }) => ({
  color: "#64748B",
  fontWeight: 600,
  fontSize: "13px",
  textTransform: "none",
  minHeight: 64,
  "&.Mui-selected": {
    color: "#004F98",
  },
  "&:hover": {
    color: "#004F98",
  },
}));

const AdminNavbar: React.FC<AdminNavbarProps> = ({ handleRefresh }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notificationsAnchorEl, setNotificationsAnchorEl] = useState<HTMLElement | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState<boolean>(false);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, message: "New user registered", time: "2 minutes ago", read: false },
    { id: 2, message: "Team assignment completed", time: "5 hours ago", read: false },
    { id: 3, message: "System update available", time: "1 day ago", read: true }
  ]);

  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Navigation Items
  const navigationItems: NavigationItem[] = [
    { label: "Dashboard", icon: DashboardIcon, path: "/admin" },
    { label: "Users", icon: PeopleIcon, path: "/admin/users" },
    { label: "Teams", icon: GroupsIcon, path: "/admin/teams" },
    { label: "Master Data", icon: DescriptionIcon, path: "/admin/master-desc" },
    { label: "Reports", icon: AnalyticsIcon, path: "/admin/reports" }
  ];

  // Effect to set active tab based on current route
  useEffect(() => {
    const currentPath = location.pathname;
    const activeIndex = navigationItems.findIndex(item => item.path === currentPath);
    if (activeIndex !== -1) {
      setSelectedTab(activeIndex);
    } else {
      // Fallback for paths not directly in navigationItems
      if (currentPath.startsWith("/admin") && currentPath.split('/').length <= 2) {
        setSelectedTab(0);
      }
    }
  }, [location.pathname]);

  // Effect to load user profile on component mount
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async (): Promise<void> => {
    try {
      const user = await authManager.getCurrentUser();
      setUserProfile(user);
    } catch (error) {
      console.error("Failed to load user profile in AdminNavbar:", error);
      setUserProfile(null);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number): void => {
    setSelectedTab(newValue);
    navigate(navigationItems[newValue].path);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  // Handlers for profile and notification menus/dialogs
  const handleProfileMenuOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = (): void => {
    setAnchorEl(null);
  };

  const handleNotificationsOpen = (event: MouseEvent<HTMLElement>): void => {
    setNotificationsAnchorEl(event.currentTarget);
  };

  const handleNotificationsClose = (): void => {
    setNotificationsAnchorEl(null);
  };

  const markNotificationAsRead = (id: number): void => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleLogout = async (): Promise<void> => {
    await authManager.logout();
    setLogoutDialogOpen(false);
    navigate("/");
  };

  return (
    <>
      <WebsiteHeader position="sticky" elevation={0}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ height: { xs: 64, md: 72 }, justifyContent: "space-between" }}>
            <Box
  component="img"
  src={Logo}
  alt="PAS Logo"
  sx={{
    height: { xs: 46, md: 52 },
    mr:0.5,
    objectFit: "contain"
  }}
/>

<Box>
  <Typography
    variant="h6"
    sx={{
      fontWeight: 1000,
      color: "#004F98",
      lineHeight: 0.5,
      letterSpacing: "-0.5px",
      fontSize: { xs: "1.1rem", sm: "1.3rem", md: "2.0rem" },
      marginTop:"21px",
      fontDecoration:"underline"
    }}
  >
    PAS
  </Typography>

  {!isMobile && (
    <Typography
      variant="caption"
      sx={{
        color: "#64748B",
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "1px"
      }}
    >
      Parts Audit System 
    </Typography>
  )}
</Box>


            {/* Center Section: Navigation Tabs */}
            {!isMobile && (
              <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
                <Tabs
                  value={selectedTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    minHeight: 64,
                    "& .MuiTabs-indicator": {
                      backgroundColor: "#004F98",
                      height: 3,
                      borderRadius: '3px 3px 0 0'
                    }
                  }}
                >
                  {navigationItems.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <WebsiteTab
                        key={item.label}
                        icon={<IconComp sx={{ fontSize: 18 }} />}
                        label={item.label}
                        iconPosition="start"
                        sx={{ 
                          opacity: selectedTab === idx ? 1 : 0.7,
                          minWidth: 100,
                          px: 2,
                          transition: 'all 0.2s'
                        }}
                      />
                    );
                  })}
                </Tabs>
              </Box>
            )}

            {/* Right Section: Actions */}
            <Stack direction="row" spacing={{ xs: 1, md: 1.5 }} alignItems="center">
              {!isMobile && (
                <IconButton onClick={handleRefresh} sx={{ color: "#64748B", bgcolor: '#F1F5F9', '&:hover': { bgcolor: '#E2E8F0' } }}>
                  <RefreshIcon sx={{ fontSize: 20 }} />
                </IconButton>
              )}
              
              {/*<IconButton 
                onClick={handleNotificationsOpen} 
                sx={{ color: "#64748B", bgcolor: '#F1F5F9', '&:hover': { bgcolor: '#E2E8F0' } }}
              >
                <Badge badgeContent={unreadNotifications} color="error">
                  <NotificationsIcon sx={{ fontSize: 20 }} />
                </Badge>
              </IconButton>*/}

              <Box sx={{ ml: 0.5, pl: 1, borderLeft: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip
                  avatar={
                    <Avatar sx={{ bgcolor: "#004F98", color: 'white' }}>
                      <AdminIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                  }
                  label={isMobile ? "" : (userProfile?.name || "Admin")}
                  onClick={handleProfileMenuOpen}
                  sx={{
                    bgcolor: "#F8FAFC",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: '1px solid #E2E8F0',
                    '&:hover': { bgcolor: "#F1F5F9" },
                    height: 40,
                    borderRadius: '12px'
                  }}
                />
                
               {/*  {!isMobile && (
                  <Button
                    onClick={() => setLogoutDialogOpen(true)}
                    startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      color: "#EF4444",
                      bgcolor: "rgba(239, 68, 68, 0.08)",
                      fontWeight: 700,
                      fontSize: "13px",
                      textTransform: "none",
                      height: 40,
                      borderRadius: '10px',
                      px: 2,
                      '&:hover': {
                        bgcolor: "rgba(239, 68, 68, 0.15)",
                        color: "#DC2626",
                      }
                    }}
                  >
                    Logout
                  </Button>
                )} */}
              </Box>
            </Stack>
          </Toolbar>
        </Container>
      </WebsiteHeader>

      {/* Drawer for mobile navigation */}
     
     <SwipeableDrawer
        anchor="left"
        open={drawerOpen}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
      >
        <List sx={{ width: 220, pt: 2, bgcolor: "#F8FAFC", minHeight: '100%' }}>
          <Box sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center' }}>
            <Business sx={{ color: "#004F98", fontSize: 28, mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#004F98", fontSize: '1rem' }}>
              Navigation
            </Typography>
          </Box>
          <Divider sx={{ mb: 1, borderColor: '#E5E7EB' }} />
          {navigationItems.map((item, index) => {
            const IconComp = item.icon;
            return (
              <ListItem disablePadding key={item.label}>
                <ListItemButton 
                  selected={selectedTab === index}
                  onClick={() => handleTabChange(null as any, index)}
                  sx={{
                    '&.Mui-selected': {
                      bgcolor: 'rgba(0, 79, 152, 0.1)',
                      color: '#004F98',
                      '& .MuiListItemIcon-root': { color: '#004F98' },
                      '&:hover': { bgcolor: 'rgba(0, 79, 152, 0.15)' }
                    },
                    color: '#1F2937',
                    '& .MuiListItemIcon-root': { color: '#6B7280' },
                    '&:hover': { bgcolor: '#F0F2F5' }
                  }}
                >
                  <ListItemIcon>
                    <IconComp sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.9rem' }} />
                </ListItemButton>
              </ListItem>
            );
          })} 
          <Divider sx={{ my: 1, borderColor: '#E5E7EB' }} />
          {/* Profile and Logout in Drawer */}
          {userProfile && (
            <ListItem disablePadding>
              <ListItemButton onClick={handleProfileMenuOpen}>
                <ListItemIcon>
                  <AccountCircleIcon sx={{ color: "#6B7280", fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText 
                  primary={userProfile?.name || "Profile"} 
                  primaryTypographyProps={{ fontSize: '0.9rem' }} 
                />
              </ListItemButton>
            </ListItem>
          )}
          {/*<ListItem disablePadding>
            <ListItemButton onClick={() => { setLogoutDialogOpen(true); setDrawerOpen(false); }}>
              <ListItemIcon>
                <LogoutIcon sx={{ color: "#EF4444", fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Logout" 
                primaryTypographyProps={{ fontSize: '0.9rem', color: '#EF4444' }} 
              />
            </ListItemButton>
          </ListItem>*/}
                  </List>
      </SwipeableDrawer>

      {/* Profile Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleProfileMenuClose}>
        <MenuItem onClick={() => { handleProfileMenuClose(); setLogoutDialogOpen(true); }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{color:'#f01c1cff'}} />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Notifications Menu 
      <Menu
        anchorEl={notificationsAnchorEl}
        open={Boolean(notificationsAnchorEl)}
        onClose={handleNotificationsClose}
      >
        <MenuItem sx={{ fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>
          <Typography variant="subtitle1" sx={{ fontSize: '0.95rem' }}>Notifications</Typography>
          <Badge badgeContent={unreadNotifications} color="primary" sx={{ ml: "auto" }} />
        </MenuItem>
        {notifications.map((notification) => (
          <MenuItem
            key={notification.id}
            onClick={() => markNotificationAsRead(notification.id)}
            sx={{
              py: 1.5,
              borderLeft: notification.read ? "none" : "3px solid #004F98",
              bgcolor: notification.read ? "transparent" : "#F8FAFC"
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }}>
                {notification.message}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {notification.time}
              </Typography>
            </Box>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleNotificationsClose} sx={{ justifyContent: "center", color: "#004F98" }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
            View All Notifications
          </Typography>
        </MenuItem>
      </Menu>
      */}

      {/* Logout Dialog */}
     <Dialog open={logoutDialogOpen} onClose={() => setLogoutDialogOpen(false)}>
        <DialogTitle sx={{ fontSize: '1.25rem' }}>Confirm Logout</DialogTitle>
        <DialogContent>
          <Typography variant="body1">Are you sure you want to logout from the admin dashboard?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLogout} sx={{ bgcolor: "#004F98" }}>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AdminNavbar;
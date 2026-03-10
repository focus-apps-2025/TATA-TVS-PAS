import React from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Avatar,
  IconButton,
  TextField,
  Grid,
  InputAdornment,
  CircularProgress,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Checkbox,
  Divider,
  Card,
  CardContent
} from '@mui/material';
import {
  Close as CloseIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  MyLocation as MyLocationIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  Check as CheckIcon,
  GroupAdd as GroupAddIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import api, { type User, type TeamFormData } from '../../services/api';

const primaryColor = '#004F98';
const secondaryColor = '#0066CC';
const successColor = '#10B981';
const errorColor = '#EF4444';

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  boxShadow: '0 4px 12px rgba(0, 79, 152, 0.08)',
  margin: '16px 0',
}));

interface TeamFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: TeamFormData;
  onChange: (field: keyof TeamFormData, value: any) => void;
  errors: Record<string, string>;
  loading: boolean;
  editingTeam: any | null;
  currentUser: User | null;
  availableTeamLeaders: User[];
  selectedTeamLeader: User | null;
  onTeamLeaderChange: (e: any) => void;
  selectedTeamMembers: User[];
  onOpenMemberDialog: () => void;
  onGetCurrentLocation: () => void;
  gettingLocation: boolean;
  getInitials: (name: string) => string;
}

const TeamForm: React.FC<TeamFormProps> = ({
  open,
  onClose,
  onSubmit,
  formData,
  onChange,
  errors,
  loading,
  editingTeam,
  currentUser,
  availableTeamLeaders,
  selectedTeamLeader,
  onTeamLeaderChange,
  selectedTeamMembers,
  onOpenMemberDialog,
  onGetCurrentLocation,
  gettingLocation,
  getInitials
}) => {
  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          maxHeight: '90vh',
          maxWidth: '950px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
        }
      }}
    >
      <DialogTitle
        sx={{
          p: 0,
          position: 'relative',
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
          color: 'white',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'2\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            opacity: 0.3
          }}
        />

        <Box sx={{ position: 'relative', p: 4, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  width: 56,
                  height: 56,
                  mr: 3
                }}
              >
                <GroupAddIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
                  {editingTeam ? 'Edit Team' : 'Create New Team'}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  {editingTeam
                    ? `Update "${editingTeam.siteName}" team information`
                    : 'Set up a new team with site details and member assignments'}
                </Typography>
              </Box>
            </Box>

            <IconButton
              onClick={onClose}
              disabled={loading}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
        <Box sx={{ p: 4 }}>
          <form onSubmit={onSubmit}>
            <StyledCard sx={{ mb: 4, overflow: 'visible' }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ bgcolor: `${primaryColor}15`, color: primaryColor, mr: 2 }}>
                    <BusinessIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      Site Information
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Basic details about the work site
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Site Name"
                      placeholder="Enter the site name"
                      value={formData.siteName}
                      onChange={(e) => onChange('siteName', e.target.value)}
                      error={!!errors.siteName}
                      helperText={errors.siteName}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&:hover fieldset': { borderColor: primaryColor },
                          '&.Mui-focused fieldset': { borderColor: primaryColor }
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon sx={{ color: primaryColor }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Location"
                      placeholder="Enter the site location"
                      value={formData.location}
                      onChange={(e) => onChange('location', e.target.value)}
                      error={!!errors.location}
                      helperText={errors.location}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&:hover fieldset': { borderColor: primaryColor },
                          '&.Mui-focused fieldset': { borderColor: primaryColor }
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocationIcon sx={{ color: primaryColor }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Get current location">
                              <IconButton
                                onClick={onGetCurrentLocation}
                                disabled={gettingLocation}
                                edge="end"
                              >
                                {gettingLocation ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <MyLocationIcon sx={{ color: primaryColor }} />
                                )}
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Description (Optional)"
                      placeholder="Brief description about this site"
                      value={formData.description}
                      onChange={(e) => onChange('description', e.target.value)}
                      multiline
                      rows={3}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 3,
                          '&:hover fieldset': { borderColor: primaryColor },
                          '&.Mui-focused fieldset': { borderColor: primaryColor }
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 2 }}>
                            <DescriptionIcon sx={{ color: primaryColor }} />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth variant="outlined">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.status}
                        onChange={(e) => onChange('status', e.target.value)}
                        label="Status"
                        sx={{
                          borderRadius: 3,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: primaryColor },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: primaryColor }
                        }}
                      >
                        <MenuItem value="active">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CheckCircleIcon sx={{ color: successColor, mr: 1, fontSize: 20 }} />
                            Active
                          </Box>
                        </MenuItem>
                        <MenuItem value="inactive">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ErrorIcon sx={{ color: errorColor, mr: 1, fontSize: 20 }} />
                            Inactive
                          </Box>
                        </MenuItem>
                        <MenuItem value="completed">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <CheckIcon sx={{ color: '#6b7280', mr: 1, fontSize: 20 }} />
                            Completed
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth variant="outlined" error={!!errors.auditType}>
                      <InputLabel>Audit Type</InputLabel>
                      <Select
                        value={formData.auditType}
                        onChange={(e) => onChange('auditType', e.target.value)}
                        label="Audit Type"
                        sx={{
                          borderRadius: 3,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: primaryColor },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: primaryColor }
                        }}
                      >
                        <MenuItem value="TVS">TVS Mode</MenuItem>
                        <MenuItem value="TATA">TATA Mode</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </StyledCard>

            <StyledCard sx={{ mb: 4 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ bgcolor: `${secondaryColor}15`, color: secondaryColor, mr: 2 }}>
                    <GroupIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      Team Assignment
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Select team leader and members for this site
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}>
                    {currentUser?.role === 'admin' && (
                      <FormControl fullWidth error={!!errors.teamLeader} variant="outlined">
                        <InputLabel>Select Team Leader</InputLabel>
                        <Select
                          value={selectedTeamLeader ? selectedTeamLeader.id || selectedTeamLeader._id : ''}
                          label="Select Team Leader"
                          onChange={onTeamLeaderChange}
                          sx={{
                            borderRadius: 3,
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: primaryColor },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: primaryColor }
                          }}
                        >
                          {availableTeamLeaders.map((leader) => (
                            <MenuItem key={leader._id || leader.id} value={leader.id || leader._id}>
                              <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                                <Avatar
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: primaryColor,
                                    mr: 2,
                                    fontSize: 12
                                  }}
                                >
                                  {getInitials(leader.name || '')}
                                </Avatar>
                                <ListItemText 
                                  primary={leader.name} 
                                  secondary={(leader.role || '').replace('_', ' ').toUpperCase()} 
                                />
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Team Members ({selectedTeamMembers.length})
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={onOpenMemberDialog}
                        sx={{ borderRadius: 2 }}
                      >
                        Add Members
                      </Button>
                    </Box>
                    
                    {selectedTeamMembers.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedTeamMembers.map((member) => (
                          <Chip
                            key={member._id || member.id}
                            avatar={<Avatar>{getInitials(member.name || '')}</Avatar>}
                            label={member.name}
                            variant="outlined"
                            sx={{ borderRadius: 2 }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                        No members selected yet.
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </CardContent>
            </StyledCard>
          </form>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, bgcolor: '#f1f5f9', borderTop: '1px solid #e2e8f0' }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          sx={{
            bgcolor: primaryColor,
            '&:hover': { bgcolor: secondaryColor },
            borderRadius: 2,
            px: 4
          }}
        >
          {loading ? 'Saving...' : (editingTeam ? 'Update Team' : 'Create Team')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamForm;

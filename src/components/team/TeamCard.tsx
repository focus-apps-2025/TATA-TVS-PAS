import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Avatar, 
  IconButton,
  Grid,
  Divider,
  Chip
} from '@mui/material';
import { 
  LocationOn as LocationIcon, 
  MoreVert as MoreVertIcon 
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import StatusChip from '../common/StatusChip';

const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'active'
})<{ active?: boolean }>(({ active }) => ({
  borderRadius: 12,
  boxShadow: '0 4px 12px rgba(0, 79, 152, 0.08)',
  borderLeft: active ? '4px solid #004F98' : 'none',
  transition: 'all 0.3s ease',
  margin: '16px 0',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 20px rgba(0, 79, 152, 0.12)',
  }
}));

interface User {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  role: string;
}

interface TeamCardProps {
  team: any;
  isSelected: boolean;
  onSelect: (team: any) => void;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, team: any) => void;
  getStatusColor: (status: string) => string;
  primaryColor: string;
  warningColor: string;
}

const TeamCard: React.FC<TeamCardProps> = ({ 
  team, 
  isSelected, 
  onSelect, 
  onMenuOpen, 
  getStatusColor,
  primaryColor,
  warningColor
}) => {
  const teamLeader = team.teamLeader as User | undefined;

  return (
    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
      <StyledCard
        active={isSelected}
        onClick={() => onSelect(team)}
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
                  onMenuOpen(e, team);
                }}
              >
                <MoreVertIcon />
              </IconButton>

              <StatusChip
                label={team.status || "Active"}
                color={getStatusColor(team.status)}
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
                    height: 20
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

            {teamLeader ? (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: `${primaryColor}40`, color: primaryColor }}>
                  {teamLeader.name?.charAt(0).toUpperCase() || "?"}
                </Avatar>
                <Typography variant="body2">{teamLeader.name}</Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                No team leader assigned
              </Typography>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="textSecondary">
                {team.members?.length || 0} Members
              </Typography>
              <Typography variant="caption" sx={{ color: primaryColor, fontWeight: 700 }}>
                Click to view racks →
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </StyledCard>
    </Grid>
  );
};

export default TeamCard;

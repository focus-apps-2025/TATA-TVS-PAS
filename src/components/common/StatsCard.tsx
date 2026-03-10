import React from 'react';
import { Card, CardContent, Typography, Box, Avatar, Stack, SvgIcon } from '@mui/material';
import { styled } from '@mui/material/styles';

type SvgIconComponent = typeof SvgIcon;

const StyledStatsCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  boxShadow: '0 4px 20px rgba(0, 79, 152, 0.05)',
  border: '1px solid #F1F5F9',
  transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  height: '100%',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 15px 35px rgba(0, 79, 152, 0.1)',
    '& .icon-bg': {
      transform: 'scale(1.2) rotate(10deg)',
    }
  }
}));

interface StatsCardProps {
  title?: string;
  value?: string | number;
  icon?: SvgIconComponent;
  color?: string;
  trend?: string;
  children?: React.ReactNode;
  sx?: any;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color = '#004F98', trend, children, sx }) => {
  if (children) {
    return (
      <StyledStatsCard sx={{ borderTop: `4px solid ${sx?.['--accent-color'] || color}`, ...sx }}>
        {children}
      </StyledStatsCard>
    );
  }

  return (
    <StyledStatsCard sx={sx}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          {Icon && (
            <Avatar 
              className="icon-bg"
              sx={{ 
                bgcolor: `${color}15`, 
                color: color,
                width: 56,
                height: 56,
                borderRadius: '16px',
                transition: 'all 0.3s ease'
              }}
            >
              <Icon sx={{ fontSize: 28 }} />
            </Avatar>
          )}
          <Box>
            {title && (
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {title}
              </Typography>
            )}
            {value !== undefined && (
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B' }}>
                {value}
              </Typography>
            )}
          </Box>
        </Stack>
        
      </CardContent>
    </StyledStatsCard>
  );
};

export default StatsCard;

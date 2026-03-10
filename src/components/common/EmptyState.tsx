import React from 'react';
import { Paper, Typography, Button, Box, SvgIcon } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { 
  Clear as ClearIcon, 
  Add as AddIcon,
} from '@mui/icons-material';

type SvgIconComponent = typeof SvgIcon;

interface EmptyStateProps {
  icon: SvgIconComponent;
  title: string;
  subtitle: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onAction?: () => void;
  actionText?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  subtitle,
  hasFilters,
  onClearFilters,
  onAction,
  actionText,
  primaryColor = '#004F98',
  secondaryColor = '#0066CC'
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 6,
        borderRadius: 4,
        textAlign: "center",
        boxShadow: '0 4px 20px rgba(0, 79, 152, 0.05)',
        bgcolor: '#FFFFFF',
        border: '1px solid #F1F5F9',
        mt: 2
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mb: 3,
          '& .MuiSvgIcon-root': {
            fontSize: 80,
            color: alpha(primaryColor, 0.1),
            p: 2,
            bgcolor: `${primaryColor}05`,
            borderRadius: '50%'
          }
        }}
      >
        <Icon />
      </Box>

      <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#1E293B' }}>
        {title}
      </Typography>

      <Typography color="textSecondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
        {subtitle}
      </Typography>

      {hasFilters ? (
        <Button
          variant="outlined"
          startIcon={<ClearIcon />}
          onClick={onClearFilters}
          sx={{ 
            borderRadius: 2,
            borderColor: primaryColor,
            color: primaryColor,
            px: 4,
            '&:hover': {
              borderColor: secondaryColor,
              bgcolor: `${primaryColor}05`
            }
          }}
        >
          Clear Filters
        </Button>
      ) : (
        onAction && actionText && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAction}
            sx={{
              bgcolor: primaryColor,
              borderRadius: 2,
              px: 4,
              py: 1,
              boxShadow: `0 4px 14px ${primaryColor}40`,
              '&:hover': { 
                bgcolor: secondaryColor,
                boxShadow: `0 6px 20px ${primaryColor}60`,
              }
            }}
          >
            {actionText}
          </Button>
        )
      )}
    </Paper>
  );
};

export default EmptyState;

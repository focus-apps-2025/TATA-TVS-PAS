import React from 'react';
import { Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledStatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'customColor'
})<{ customColor: string }>(({ customColor }) => ({
  borderRadius: 8,
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: `${customColor}15`,
  color: customColor,
  border: `1px solid ${customColor}30`
}));

interface StatusChipProps {
  label: string;
  color: string;
  size?: 'small' | 'medium';
  icon?: React.ReactElement;
  sx?: any;
}

const StatusChip: React.FC<StatusChipProps> = ({ label, color, size = 'small', icon, sx }) => {
  return (
    <StyledStatusChip
      label={label}
      customColor={color}
      size={size}
      icon={icon}
      sx={sx}
    />
  );
};

export default StatusChip;

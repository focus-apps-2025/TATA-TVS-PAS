import React from 'react';
import { Card } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  boxShadow: '0 4px 12px rgba(0, 79, 152, 0.08)',
  border: '1px solid #E5E7EB',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-6px)',
    boxShadow: '0 12px 24px rgba(0, 79, 152, 0.12)',
  }
}));

const ProfessionalCard: React.FC<{ children: React.ReactNode; sx?: any; onClick?: () => void }> = ({ children, sx, onClick }) => {
  return <StyledCard sx={sx} onClick={onClick}>{children}</StyledCard>;
};

export default ProfessionalCard;

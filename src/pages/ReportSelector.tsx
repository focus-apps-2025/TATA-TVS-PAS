// src/pages/ReportSelector.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  Divider,
  alpha
} from '@mui/material';
import {
  TwoWheeler,
  DirectionsCar,
  DirectionsBus,
  Assessment,
  CompareArrows,
  PictureAsPdf,
  CheckCircle
} from '@mui/icons-material';
import TataPDFReport from '../pages/TataPDFReport';

const ReportSelector: React.FC = () => {
  const navigate = useNavigate();
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  const reportTypes = [
    {
      id: 'tvs',
      title: 'TVS Final Report',
      description: 'Generate comprehensive stock comparison report for TVS audit',
      Icon: TwoWheeler,
      color: '#004F98',
      badge: '2W',
      route: '/admin/reports/tvs',
      features: ['DMS Comparison', 'Stock Variance Analysis', 'Excel Export'],
    },
    {
      id: 'tata',
      title: 'TATA Final Report',
      description: 'Generate comprehensive stock comparison report for TATA audit',
      Icon: DirectionsCar,
      color: '#D35400',
      badge: '4W',
      route: '/admin/reports/tata',
      features: ['DMS Comparison', 'Stock Variance Analysis', 'Excel + PDF Export'],
    },
    {
      id: '3w-tvs',
      title: '3W TVS Reconciliation',
      description: 'Prepare DMS and physical audit exports for a separate 3W TVS reconciliation',
      Icon: DirectionsBus,
      color: '#0F766E',
      badge: '3W',
      route: '/admin/reports/3w-tvs',
      features: ['DMS Comparison', 'Stock Variance Analysis', 'Excel Export'],
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      {/* Page header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            bgcolor: alpha('#004F98', 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Assessment sx={{ fontSize: 20, color: '#004F98' }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            Final Report Generator
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Select manufacturer type to generate audit report
          </Typography>
        </Box>
      </Box>

      {/* Three cards — one row */}
      <Grid container spacing={3}>
        {reportTypes.map((report) => {
          const { Icon } = report;
          return (
            <Grid size={{ xs: 12, md: 4 }} key={report.id}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                  '&:hover': {
                    boxShadow: `0 10px 32px ${alpha(report.color, 0.18)}`,
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                {/* Coloured top bar */}
                <Box sx={{ height: 7, bgcolor: report.color, flexShrink: 0 }} />

                <CardContent
                  sx={{
                    p: 3,
                    '&:last-child': { pb: 3 },
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    // Soft tinted background
                    background: `linear-gradient(160deg, ${alpha(report.color, 0.05)} 0%, #ffffff 45%)`,
                  }}
                >
                  {/* Icon row + badge */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2.5,
                        bgcolor: alpha(report.color, 0.12),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ fontSize: 28, color: report.color }} />
                    </Box>

                    <Chip
                      label={report.badge}
                      size="small"
                      sx={{
                        bgcolor: alpha(report.color, 0.1),
                        color: report.color,
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        height: 26,
                        borderRadius: '999px',
                        border: `1px solid ${alpha(report.color, 0.2)}`,
                      }}
                    />
                  </Box>

                  {/* Title */}
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: '#111827', mb: 0.75, fontSize: '1rem' }}
                  >
                    {report.title}
                  </Typography>

                  {/* Description */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ lineHeight: 1.65, fontSize: '0.82rem', mb: 2 }}
                  >
                    {report.description}
                  </Typography>

                  {/* Divider */}
                  <Divider sx={{ mb: 2, borderColor: alpha(report.color, 0.15) }} />

                  {/* Feature bullets */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.9, mb: 3, flex: 1 }}>
                    {report.features.map((feature) => (
                      <Box key={feature} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle sx={{ fontSize: 16, color: report.color, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#374151', fontWeight: 500 }}>
                          {feature}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Primary button */}
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => navigate(report.route)}
                    startIcon={<CompareArrows />}
                    sx={{
                      bgcolor: report.color,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      py: 1.1,
                      boxShadow: 'none',
                      '&:hover': {
                        bgcolor: report.color,
                        opacity: 0.88,
                        boxShadow: `0 4px 14px ${alpha(report.color, 0.4)}`,
                      },
                    }}
                  >
                    Open {report.title}
                  </Button>

                  {/* TATA-only PDF button */}
                  {report.id === 'tata' && (
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => setPdfDialogOpen(true)}
                      startIcon={<PictureAsPdf />}
                      sx={{
                        mt: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        py: 1.1,
                        borderColor: '#DC2626',
                        color: '#DC2626',
                        '&:hover': {
                          borderColor: '#B91C1C',
                          bgcolor: alpha('#DC2626', 0.04),
                        },
                      }}
                    >
                      Generate TATA Consolidated PDF
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Footer note */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 4, textAlign: 'center' }}
      >
        Each manufacturer has specific column requirements and report formats. Upload the correct DMS and Physical files for the selected type.
      </Typography>

      {/* TATA PDF Dialog */}
      <TataPDFReport
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        dealerName="Jayaraj Karz"
        location="Thanjavur, Pudukottai, Kumbakonam & Thiruvarur"
        auditStartDate="02.02.2026"
        auditEndDate="08.02.2026"
      />
    </Container>
  );
};

export default ReportSelector;

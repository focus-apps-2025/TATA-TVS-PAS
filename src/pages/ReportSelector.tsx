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
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import {
  TwoWheeler,
  DirectionsCar,
  Assessment,
  CompareArrows,
  PictureAsPdf
} from '@mui/icons-material';
import TataPDFReport from '../pages/TataPDFReport';

const ReportSelector: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  // PDF Generation State - Only for TATA
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  const reportTypes = [
    {
      id: 'tvs',
      title: 'TVS Final Report',
      description: 'Generate comprehensive stock comparison report for TVS audit',
      icon: <TwoWheeler sx={{ fontSize: 60 }} />,
      color: '#004F98', // TVS Blue
      route: '/admin/reports/tvs'
    },
    {
      id: 'tata',
      title: 'TATA Final Report',
      description: 'Generate comprehensive stock comparison report for TATA audit',
      icon: <DirectionsCar sx={{ fontSize: 60 }} />,
      color: '#D35400', // TATA Orange
      route: '/admin/reports/tata'
    }
  ];

  // Handle PDF Dialog Open - Only for TATA
  const handleOpenPDFDialog = () => {
    setPdfDialogOpen(true);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main
          }}
        >
          <Assessment sx={{ fontSize: 40 }} />
        </Avatar>

        <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, color: theme.palette.primary.main }}>
          Final Report Generator
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Select manufacturer type to generate final audit report
        </Typography>
      </Box>

      <Grid container spacing={4} justifyContent="center">
        {reportTypes.map((report) => (
          <Grid size={{ xs: 12, md: 6 }} key={report.id}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 4,
                transition: 'all 0.3s ease',
                border: `3px solid ${alpha(report.color, 0.2)}`,
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: `0 20px 40px ${alpha(report.color, 0.2)}`,
                  border: `3px solid ${report.color}`
                }
              }}
            >
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Avatar
                  sx={{
                    width: 100,
                    height: 100,
                    mx: 'auto',
                    mb: 3,
                    bgcolor: alpha(report.color, 0.1),
                    color: report.color
                  }}
                >
                  {report.icon}
                </Avatar>

                <Typography variant="h4" sx={{ fontWeight: 700, mb: 2, color: report.color }}>
                  {report.title}
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 4, minHeight: 60 }}>
                  {report.description}
                </Typography>

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={() => navigate(report.route)}
                  startIcon={<CompareArrows />}
                  sx={{
                    py: 2,
                    borderRadius: 3,
                    bgcolor: report.color,
                    '&:hover': {
                      bgcolor: report.color,
                      opacity: 0.9
                    }
                  }}
                >
                  Generate {report.title}
                </Button>

                {/* PDF Button - Only for TATA */}
                {report.id === 'tata' && (
                  <Button
                    variant="outlined"
                    size="large"
                    fullWidth
                    onClick={handleOpenPDFDialog}
                    startIcon={<PictureAsPdf />}
                    sx={{
                      mt: 2,
                      py: 2,
                      borderRadius: 3,
                      borderColor: '#DC2626',
                      color: '#DC2626',
                      '&:hover': {
                        borderColor: '#B91C1C',
                        backgroundColor: alpha('#DC2626', 0.04)
                      }
                    }}
                  >
                    Generate TATA Consolidated PDF
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* TATA PDF Report Dialog */}
      <TataPDFReport
        open={pdfDialogOpen}
        onClose={() => setPdfDialogOpen(false)}
        dealerName="Jayaraj Karz"
        location="Thanjavur, Pudukottai, Kumbakonam & Thiruvarur"
        auditStartDate="02.02.2026"
        auditEndDate="08.02.2026"
      />

      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Note: Each manufacturer has specific column requirements and report formats.
          <br />
          Make sure you upload the correct DMS and Physical files for the selected manufacturer.
        </Typography>
      </Box>
    </Container>
  );
};

export default ReportSelector;
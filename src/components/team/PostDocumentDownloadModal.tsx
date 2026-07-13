import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material';
import type { Team } from '../../services/api';
import { downloadTeamPostDocumentPdf, downloadTeamPostDocumentPptx } from '../../utils/postDocumentExport';
import { fetchAndComputeSummaryStats } from '../../utils/summaryStats';

interface PostDocumentDownloadModalProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onMessage: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

const primaryColor = '#004F98';

const formatDate = (dateValue?: string | Date) => {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PostDocumentDownloadModal: React.FC<PostDocumentDownloadModalProps> = ({
  open,
  team,
  onClose,
  onMessage
}) => {
  const [downloading, setDownloading] = useState<'pdf' | 'pptx' | null>(null);

  const handleDownload = async (type: 'pdf' | 'pptx') => {
    if (!team) return;
    setDownloading(type);
    try {
      const summaryStats = await fetchAndComputeSummaryStats(team._id || team.id || '');
      
      if (type === 'pdf') {
        await downloadTeamPostDocumentPdf(team, summaryStats);
      } else {
        await downloadTeamPostDocumentPptx(team, summaryStats);
      }
      onMessage(`${type.toUpperCase()} downloaded successfully.`, 'success');
    } catch (error: any) {
      onMessage(error.message || `Unable to generate ${type.toUpperCase()}.`, 'error');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={downloading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 1.5 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 1 }}>
        <Typography variant="h5" fontWeight={800}>
          Post Document - {team?.siteName || 'Selected team'}
        </Typography>
        <Button
          onClick={onClose}
          disabled={Boolean(downloading)}
          sx={{ minWidth: 0, color: '#666', p: 0.5 }}
        >
          <CloseIcon sx={{ fontSize: 28 }} />
        </Button>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pt: 3, pb: 2 }}>
        <Alert
          icon={<InfoIcon sx={{ color: '#0EA5E9' }} />}
          severity="info"
          sx={{
            bgcolor: '#E0F2FE',
            color: '#004366',
            borderRadius: 2,
            mb: 2.5,
            py: 1.5,
            '& .MuiAlert-message': {
              fontSize: 18,
              fontStyle: 'italic',
              lineHeight: 1.45
            }
          }}
        >
          Download a team-specific post audit document with uploaded front, group, before and after images.
        </Alert>

        <Box
          sx={{
            bgcolor: '#F8FAFC',
            borderRadius: 1.5,
            px: 2,
            py: 2.2,
            mb: 5
          }}
        >
          <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
            <Box component="span" sx={{ fontWeight: 800, fontStyle: 'normal' }}>Audit Start:</Box>{' '}
            {formatDate(team?.auditStartDate || team?.createdAt)}
          </Typography>
          <Typography variant="body1" sx={{ fontStyle: 'italic', mt: 0.5 }}>
            <Box component="span" sx={{ fontWeight: 800, fontStyle: 'normal' }}>Audit End:</Box>{' '}
            {team?.status === 'Completed' ? formatDate(team?.auditEndDate || team?.updatedAt) : 'Not completed yet'}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Button
          variant="outlined"
          startIcon={downloading === 'pptx' ? <CircularProgress size={16} /> : <DownloadIcon />}
          disabled={Boolean(downloading)}
          onClick={() => handleDownload('pptx')}
          sx={{
            borderColor: primaryColor,
            color: primaryColor,
            textTransform: 'none',
            fontWeight: 800,
            fontStyle: 'italic',
            px: 2,
            py: 1,
            '&:hover': { borderColor: primaryColor, bgcolor: `${primaryColor}10` }
          }}
        >
          Download PPT
        </Button>
        <Button
          variant="contained"
          startIcon={downloading === 'pdf' ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          disabled={Boolean(downloading)}
          onClick={() => handleDownload('pdf')}
          sx={{
            bgcolor: primaryColor,
            textTransform: 'none',
            fontWeight: 800,
            fontStyle: 'italic',
            px: 2,
            py: 1,
            '&:hover': { bgcolor: '#0066CC' }
          }}
        >
          Download PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PostDocumentDownloadModal;

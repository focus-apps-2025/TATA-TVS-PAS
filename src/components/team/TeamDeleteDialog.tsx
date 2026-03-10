import React from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Avatar,
  Button
} from '@mui/material';
import {
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

interface TeamDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  team: any | null;
  loading: boolean;
  successColor: string;
  errorColor: string;
}

const TeamDeleteDialog: React.FC<TeamDeleteDialogProps> = ({
  open,
  onClose,
  onConfirm,
  team,
  loading,
  successColor,
  errorColor
}) => {
  if (!team) return null;

  const isFinishWork = team._isFinishWorkAction;

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 600 }}>
        {isFinishWork ? 'Confirm Finish Work' : 'Confirm Team Deletion'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: isFinishWork ? `${successColor}20` : `${errorColor}20`,
              color: isFinishWork ? successColor : errorColor,
              mr: 2
            }}
          >
            {isFinishWork ? <CheckCircleIcon /> : <DeleteIcon />}
          </Avatar>
          <Typography variant="body1">
            {isFinishWork
              ? team.confirmationDialog?.message || "Are you sure you want to finish work for this team?"
              : `Are you sure you want to delete the team "${team.siteName}"?`}
          </Typography>
        </Box>

        {!isFinishWork && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            This action cannot be undone. All data associated with this team will be permanently removed.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            color: 'text.secondary',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={isFinishWork ? "success" : "error"}
          sx={{
            borderRadius: 2,
            px: 3,
            bgcolor: isFinishWork ? successColor : errorColor,
            '&:hover': {
              bgcolor: isFinishWork ? successColor : errorColor,
              opacity: 0.9
            }
          }}
        >
          {loading ? 'Processing...' : (isFinishWork ? 'Finish Work' : 'Delete Team')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamDeleteDialog;

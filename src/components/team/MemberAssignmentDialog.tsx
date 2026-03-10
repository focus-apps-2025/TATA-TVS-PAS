import React from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Button,
  TextField
} from '@mui/material';
import { Group as GroupIcon, Search as SearchIcon } from '@mui/icons-material';

import { type User } from '../../services/api';

interface MemberAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  availableMembers: User[];
  selectedMembers: User[];
  onToggleMember: (user: User) => void;
  getInitials: (name: string) => string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const MemberAssignmentDialog: React.FC<MemberAssignmentDialogProps> = ({
  open,
  onClose,
  availableMembers,
  selectedMembers,
  onToggleMember,
  getInitials,
  primaryColor,
  secondaryColor,
  backgroundColor,
  searchQuery,
  onSearchChange
}) => {
  const filteredMembers = availableMembers.filter(member =>
    (member.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (member.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <GroupIcon sx={{ color: primaryColor, mr: 2 }} />
            <Typography variant="h6">Select Team Members</Typography>
          </Box>
          <TextField
            size="small"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
            }}
            sx={{ width: 250 }}
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Select team members from the available list
        </Typography>

        {filteredMembers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <GroupIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {availableMembers.length === 0 ? "No available team members found" : "No members match your search"}
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredMembers.map((member) => {
              const isSelected = selectedMembers.some(m => (m._id || m.id) === (member._id || member.id));
              return (
                <ListItem
                  key={member._id || member.id}
                  onClick={() => onToggleMember(member)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: isSelected ? `${primaryColor}10` : 'transparent',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: isSelected ? `${primaryColor}15` : backgroundColor
                    }
                  }}
                >
                  <ListItemIcon>
                    <Checkbox
                      checked={isSelected}
                      sx={{
                        color: primaryColor,
                        '&.Mui-checked': {
                          color: primaryColor
                        }
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={member.name}
                    secondary={member.email}
                  />
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: primaryColor,
                      fontSize: 14,
                      fontWeight: 'bold'
                    }}
                  >
                    {getInitials(member.name || '')}
                  </Avatar>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: primaryColor,
            '&:hover': { bgcolor: secondaryColor }
          }}
        >
          Done ({selectedMembers.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MemberAssignmentDialog;

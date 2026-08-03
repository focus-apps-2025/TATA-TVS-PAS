import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Container,
  Divider,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import api from '../services/api';

type AuditType = 'before' | 'after';

interface AuditEntryPageProps {
  auditType: AuditType;
}

interface TeamInfo {
  siteName?: string;
  location?: string;
  auditType?: string;
}

interface AuditRow {
  id?: string;
  sNo: number;
  pageNo: number;
  location: string;
  rack: string;
  partNo: string;
  phyQty: number;
  partDescription: string;
  ndp: number;
  mrp: number;
}

const primaryColor = '#004F98';
const TVS_LOCATION_OPTIONS = [
  'LUBRICANTS',
  'PARTS',
  'KIT',
  'CONSUMER PRODUCTS',
  'LOCAL ITEMS',
  'SPARES',
  'ACCESSORIES',
  '3W',
  '2W'
];

const AuditEntryPage: React.FC<AuditEntryPageProps> = ({ auditType }) => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [newRow, setNewRow] = useState<AuditRow>({
    sNo: 1,
    pageNo: 1,
    location: '',
    rack: '',
    partNo: '',
    phyQty: 0,
    partDescription: '',
    ndp: 0,
    mrp: 0
  });
  const [partNoWarning, setPartNoWarning] = useState<string>('');

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId) return;
      setLoading(true);
      setError('');

      try {
        const [teamData, auditsResponse] = await Promise.all([
          api.getTeamById(teamId),
          api.getBeforeAfterAudits(teamId),
        ]);

        setTeam(teamData);

        const existingAudit = (auditsResponse.data || []).find((audit: any) => audit.auditType === auditType);
        setAuditRows((existingAudit?.items || []).map((item: any, index: number) => ({
          id: item._id || `${auditType}-${index}`,
          sNo: Number(item.sNo) || index + 1,
          pageNo: Number(item.pageNo) || 1,
          location: item.location || '',
          rack: item.rack || '',
          partNo: item.partNo || '',
          phyQty: Number(item.phyQty) || 0,
          partDescription: item.partDescription || '',
          ndp: Number(item.ndp) || 0,
          mrp: Number(item.mrp) || 0
        })));
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to load audit page');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [teamId, auditType]);

  const saveCurrentRows = async (rowsToSave: AuditRow[]) => {
    if (!teamId) return;
    setSaving(true);
    setError('');
    try {
      const normalizedRows = rowsToSave.map((item, index) => ({
        ...item,
        sNo: index + 1,
        pageNo: item.pageNo || 1
      }));
      await api.saveBeforeAfterAudit({
        teamId,
        auditType,
        fileName: 'manual_entry',
        items: normalizedRows.map(({ id, ...item }) => item)
      });
      setAuditRows(normalizedRows);
      setMessage(`${auditType === 'before' ? 'Before' : 'After'} audit data saved successfully.`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save audit data');
    } finally {
      setSaving(false);
    }
  };

  const handleNewRowPartNoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setNewRow((prev) => ({ ...prev, partNo: value }));
    setPartNoWarning(''); // clear warning on every keystroke

    if (!value.trim()) {
      return;
    }

    const normalizedPartNo = value.trim().toLowerCase();
    const existingMatch = auditRows.find((row) => row.partNo.trim().toLowerCase() === normalizedPartNo);

    if (existingMatch) {
      setNewRow((prev) => ({
        ...prev,
        partNo: value,
        partDescription: existingMatch.partDescription || prev.partDescription,
        ndp: existingMatch.ndp ?? prev.ndp,
        mrp: existingMatch.mrp ?? prev.mrp
      }));
      return;
    }

    try {
      const response = await api.checkPartNoInMaster(value, team?.siteName || '');
      if (response.success && response.exists) {
        const { description, ndp, mrp } = response.data || {};
        setNewRow((prev) => ({
          ...prev,
          partNo: value,
          partDescription: description || prev.partDescription,
          ndp: Number.isFinite(Number(ndp)) ? Number(ndp) : prev.ndp,
          mrp: Number.isFinite(Number(mrp)) ? Number(mrp) : prev.mrp
        }));
      }
    } catch (lookupError: any) {
      if (lookupError.response?.status === 404) {
        // Show a clear error inside the dialog — the part is not in master data
        setPartNoWarning(`Part number "${value}" is not found in master data. MRP / NDP / Description will not be auto-filled.`);
        setNewRow((prev) => ({ ...prev, partDescription: '', ndp: 0, mrp: 0 }));
      } else {
        console.error('Error fetching part details:', lookupError);
      }
    }
  };

  const handleDeleteRow = async (rowIndex: number) => {
    const nextRows = auditRows.filter((_, index) => index !== rowIndex);
    await saveCurrentRows(nextRows);
  };

  const handleAddRow = async () => {
    const nextRows = [
      ...auditRows,
      {
        ...newRow,
        pageNo: newRow.pageNo || 1,
        id: `${auditType}-${Date.now()}`
      }
    ];
    setAddRowOpen(false);
    await saveCurrentRows(nextRows);
      setNewRow({
        sNo: nextRows.length + 1,
        pageNo: 1,
        location: '',
      rack: '',
      partNo: '',
      phyQty: 0,
      partDescription: '',
      ndp: 0,
      mrp: 0
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F5F7FB' }}>
      <Box sx={{ background: 'linear-gradient(180deg, #0A4E8B 0%, #0A4E8B 55%, #F5F7FB 55%, #F5F7FB 100%)', pb: 4 }}>
        <Container maxWidth="xl" sx={{ pt: 3 }}>
          <Box sx={{ textAlign: 'center', color: '#fff', py: { xs: 4, md: 6 } }}>
            <Typography variant="h2" sx={{ fontWeight: 400, fontStyle: 'italic', lineHeight: 1.1 }}>
              {auditType === 'before' ? 'Before View' : 'After View'}
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              bgcolor: '#0060B8',
              color: '#fff',
              borderRadius: 3,
              px: { xs: 2, md: 4 },
              py: { xs: 3, md: 4 },
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/admin/teams')}
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.55)',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' }
                }}
              >
                Back to Teams
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={800}>
                  {team?.siteName || 'Team'}
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
                  <Chip label={team?.location || 'No location'} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} />
                  <Chip label={auditType === 'before' ? 'Before' : 'After'} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff' }} />
                </Stack>
              </Box>

              <Box sx={{ width: { xs: 0, md: 160 } }} />
            </Stack>
          </Paper>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ mt: -1, pb: 4 }}>
        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack spacing={2}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {error && <Alert severity="error">{error}</Alert>}
                {message && <Alert severity="success">{message}</Alert>}

                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                  <Typography variant="h6" fontWeight={700} color={primaryColor}>
                    {auditType === 'before' ? 'Before View Rows' : 'After View Rows'} ({auditRows.length})
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAddRowOpen(true)}
                    sx={{ bgcolor: primaryColor }}
                  >
                    Add Row
                  </Button>
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  Manage the rows below directly. Use the delete action to remove a single entry.
                </Typography>

                <Divider />

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F1F5F9' }}>
                        <TableCell>S.No</TableCell>
                        <TableCell>Page No</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Rack</TableCell>
                        <TableCell>Part No</TableCell>
                        <TableCell align="right">Phy Qty</TableCell>
                        <TableCell>Part Description</TableCell>
                        <TableCell align="right">NDP</TableCell>
                        <TableCell align="right">MRP</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditRows.length ? auditRows.map((row, index) => (
                        <TableRow key={row.id || `${row.partNo}-${index}`} hover>
                          <TableCell>{row.sNo}</TableCell>
                          <TableCell>{row.pageNo}</TableCell>
                          <TableCell>{row.location}</TableCell>
                          <TableCell>{row.rack}</TableCell>
                          <TableCell>{row.partNo}</TableCell>
                          <TableCell align="right">{row.phyQty}</TableCell>
                          <TableCell>{row.partDescription}</TableCell>
                          <TableCell align="right">{row.ndp.toFixed(2)}</TableCell>
                          <TableCell align="right">{row.mrp.toFixed(2)}</TableCell>
                          <TableCell align="center">
                            <Tooltip title="Delete row">
                              <IconButton color="error" onClick={() => handleDeleteRow(index)} size="small">
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={10} align="center">
                            No rows added yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Stack>
        </Paper>
      </Container>

      <Dialog open={addRowOpen} onClose={() => setAddRowOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Row</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {partNoWarning && (
              <Alert severity="error">
                {partNoWarning}
              </Alert>
            )}
            <TextField label="Rack" value={newRow.rack} onChange={(event) => setNewRow((prev) => ({ ...prev, rack: event.target.value }))} />
            <TextField label="Part No" value={newRow.partNo} onChange={handleNewRowPartNoChange} />
            <TextField
              select
              label="Location"
              value={newRow.location}
              onChange={(event) => setNewRow((prev) => ({ ...prev, location: event.target.value }))}
            >
              {TVS_LOCATION_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Phy Qty" type="number" value={newRow.phyQty} onChange={(event) => setNewRow((prev) => ({ ...prev, phyQty: Number(event.target.value) }))} />
            <TextField
              label="Part Description"
              value={newRow.partDescription}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="NEW NDP"
              type="number"
              value={newRow.ndp}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="NEW MRP"
              type="number"
              value={newRow.mrp}
              InputProps={{ readOnly: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRowOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddRow} sx={{ bgcolor: primaryColor }}>
            Save Row
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditEntryPage;

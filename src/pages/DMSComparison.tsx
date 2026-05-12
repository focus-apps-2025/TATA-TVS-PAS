import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Breadcrumbs,
  Link,
  Tooltip,
  Snackbar,
  Alert as MuiAlert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import api from '../services/api';

const primaryColor = '#004F98';

interface ComparisonRow {
  id: string;
  partNo: string;
  description: string;
  dmsQty: number;
  physicalQty: number;
  short: number;
  excess: number;
  remark: string;
  isResolved: boolean;
  prevShort?: number;
  prevExcess?: number;
  prevPhysicalQty?: number;
  wasAutoResolved?: boolean;
}

const DMSComparison: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [uploadDate, setUploadDate] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [savingRemark, setSavingRemark] = useState<string | null>(null);
  const [resolvingPart, setResolvingPart] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<{ partNo: string; message: string } | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [showRemainingDialog, setShowRemainingDialog] = useState(false);
  const [remainingParts, setRemainingParts] = useState<ComparisonRow[]>([]);
  
  // State for edit mode in remarks
  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [tempRemark, setTempRemark] = useState<string>('');

  // Store previous values for auto-uncheck detection
  const prevDataRef = useRef<Map<string, { short: number; excess: number; physicalQty: number }>>(new Map());
  const lastUploadDateRef = useRef<string | null>(null);

  useEffect(() => {
    // Load snapshot from sessionStorage on mount
    const stored = sessionStorage.getItem(`dms_snapshot_${teamId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.uploadDate) {
          lastUploadDateRef.current = parsed.uploadDate;
          const snap = parsed.snapshot || {};
          const map = new Map<string, { short: number; excess: number; physicalQty: number }>();
          Object.entries(snap).forEach(([partNo, val]: any) => {
            map.set(partNo, val);
          });
          prevDataRef.current = map;
        }
      } catch (e) {
        console.warn('Failed to load DMS snapshot from sessionStorage');
      }
    }

    fetchComparisonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!teamId) return;
      const res = await api.getDMSComparison(teamId);

      // Check if this is a new DMS upload
      const storedUploadDate = lastUploadDateRef.current;
      const isNewUpload = res.uploadDate !== storedUploadDate;

      if (isNewUpload) {
        prevDataRef.current = new Map();
      }

      // Process incoming data and detect changes
      const processedData = res.data.map((row: any) => {
        const prevValues = prevDataRef.current.get(row.partNo);
        return {
          ...row,
          prevShort: prevValues?.short,
          prevExcess: prevValues?.excess,
          prevPhysicalQty: prevValues?.physicalQty
        };
      });

      // Auto-uncheck rows where values changed
      const rowsToAutoUncheck: ComparisonRow[] = [];
      const autoUncheckedData = processedData.map((row: ComparisonRow) => {
        if (row.isResolved) {
          const shortChanged = row.prevShort !== undefined && Number(row.prevShort) !== Number(row.short);
          const excessChanged = row.prevExcess !== undefined && Number(row.prevExcess) !== Number(row.excess);
          if (shortChanged || excessChanged) {
            rowsToAutoUncheck.push(row);
            return { ...row, isResolved: false };
          }
        }
        return row;
      });

      setData(autoUncheckedData);
      setUploadDate(res.uploadDate);
      setFileName(res.fileName);

// Persist auto-uncheck to backend (silent)
      if (rowsToAutoUncheck.length > 0) {
        rowsToAutoUncheck.forEach(row => {
          api.resolveDMSPart({
            teamId: teamId!,
            partNo: row.partNo,
            isResolved: false
          }).catch(err => {
            console.error('Failed to auto-uncheck part', row.partNo, err);
          });
        });
      }

      // Auto-select (resolve) rows where DMS Qty equals Physical Qty
      const rowsToAutoSelect: ComparisonRow[] = [];
      const autoSelectedData = autoUncheckedData.map((row: ComparisonRow) => {
        if (!row.isResolved && row.short === 0 && row.excess === 0 && row.dmsQty === row.physicalQty && row.dmsQty > 0) {
          rowsToAutoSelect.push(row);
          return { ...row, isResolved: true, wasAutoResolved: true };
        }
        return { ...row, wasAutoResolved: false };
      });

      // Split into physical parts (physicalQty > 0) and remaining DMS-only parts
      const physicalParts = autoSelectedData.filter((r: ComparisonRow) => r.physicalQty > 0);
      const dmsOnlyParts = autoSelectedData.filter((r: ComparisonRow) => r.dmsQty > 0 && r.physicalQty === 0);

      setData(physicalParts);
      setRemainingParts(dmsOnlyParts);
      setUploadDate(res.uploadDate);
      setFileName(res.fileName);

      // Show flash message for auto-selected rows
      if (rowsToAutoSelect.length > 0) {
        const partNos = rowsToAutoSelect.map(r => r.partNo).join(', ');
        setFlashMessage(`${rowsToAutoSelect.length} part(s) auto-resolved (DMS = Physical): ${partNos}`);
      }

      // Persist auto-select to backend (silent)
      if (rowsToAutoSelect.length > 0) {
        rowsToAutoSelect.forEach(row => {
          api.resolveDMSPart({
            teamId: teamId!,
            partNo: row.partNo,
            isResolved: true
          }).catch(err => {
            console.error('Failed to auto-select part', row.partNo, err);
          });
        });
      }

      // Update snapshot for all parts (including remaining)
      const newSnapshot = new Map();
      autoUncheckedData.forEach((row: ComparisonRow) => {
        newSnapshot.set(row.partNo, {
          short: Number(row.short),
          excess: Number(row.excess),
          physicalQty: Number(row.physicalQty)
        });
      });
      prevDataRef.current = newSnapshot;
      lastUploadDateRef.current = res.uploadDate;

      // Save to sessionStorage
      try {
        sessionStorage.setItem(`dms_snapshot_${teamId}`, JSON.stringify({
          uploadDate: res.uploadDate,
          snapshot: Object.fromEntries(newSnapshot)
        }));
      } catch (e) {
        // Ignore storage errors
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch comparison data';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemarkSave = async (partNo: string, newRemark: string) => {
    try {
      if (!teamId) return;
      setSavingRemark(partNo);
      await api.updateDMSRemark({ teamId, partNo, remark: newRemark });
      setData(prev => prev.map(row => row.partNo === partNo ? { ...row, remark: newRemark } : row));
      
      // Show success message
      setFlashMessage(`Remark saved for part ${partNo}`);
      
      // Exit edit mode
      setEditingRemark(null);
      setTempRemark('');
    } catch (err: any) {
      alert(err.message || 'Failed to update remark');
    } finally {
      setSavingRemark(null);
    }
  };

  const handleRemarkEdit = (partNo: string, currentRemark: string) => {
    setEditingRemark(partNo);
    setTempRemark(currentRemark || '');
  };

  const handleRemarkCancel = () => {
    setEditingRemark(null);
    setTempRemark('');
  };

  const handleResolveToggle = async (partNo: string, currentStatus: boolean) => {
    const row = data.find(r => r.partNo === partNo);
    if (!row) return;

    // Validation: if trying to check (resolve), ensure remark exists for discrepancies
    if (!currentStatus) {
      const hasDiscrepancy = row.short > 0 || row.excess > 0;
      if (hasDiscrepancy && (!row.remark || row.remark.trim() === '')) {
        setValidationError({
          partNo,
          message: 'Add remark first before marking as resolved'
        });
        return;
      }
    }

    try {
      setResolvingPart(partNo);
      await api.resolveDMSPart({
        teamId: teamId!,
        partNo,
        isResolved: !currentStatus
      });

      setData(prev => prev.map(r =>
        r.partNo === partNo ? { ...r, isResolved: !currentStatus, wasAutoResolved: false } : r
      ));
    } catch (err: any) {
      alert(err.message || 'Failed to update resolved status');
    } finally {
      setResolvingPart(null);
    }
  };

  const handleExport = () => {
    const exportData = [...data, ...remainingParts].map(row => ({
      'Part No': row.partNo,
      'Description': row.description,
      'DMS Qty': row.dmsQty,
      'Physical Qty': row.physicalQty,
      'Short': row.short,
      'Excess': row.excess,
      'Remark': row.remark,
      'Resolved': row.isResolved ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `DMS_Comparison_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
  };

  // Sort data: unresolved at top, resolved at bottom, auto-resolved at very bottom
  const sortedData = [...data].sort((a, b) => {
    // Both resolved: auto-resolved goes after manually resolved
    if (a.isResolved && b.isResolved) {
      if (a.wasAutoResolved && !b.wasAutoResolved) return 1;
      if (!a.wasAutoResolved && b.wasAutoResolved) return -1;
      return a.partNo.localeCompare(b.partNo);
    }
    // One resolved, one not: unresolved first
    if (a.isResolved !== b.isResolved) {
      return a.isResolved ? 1 : -1;
    }
    // Both unresolved: sort by partNo
    return a.partNo.localeCompare(b.partNo);
  });

  const columns: GridColDef[] = [
    {
      field: 'isResolved',
      headerName: 'Resolved',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as ComparisonRow;
        
        // Check if row has ANY discrepancy (short > 0 OR excess > 0)
        const hasDiscrepancy = row.short > 0 || row.excess > 0;
        
        // Check if remark is missing (for discrepancy rows)
        const remarkMissing = hasDiscrepancy && (!row.remark || row.remark.trim() === '');
        
        // Check if physical quantity increased from zero
        const physicalQtyIncreasedFromZero = row.prevPhysicalQty === 0 && row.physicalQty > 0;
        
        // Determine if checkbox should be DISABLED
        // Disabled when:
        // 1. Loading state
        // 2. Physical quantity increased from zero
        // 3. Has discrepancy AND remark is missing AND not already resolved
        const isDisabled = 
          resolvingPart === row.partNo ||
          physicalQtyIncreasedFromZero ||
          (remarkMissing && !row.isResolved);
        
        // Tooltip message based on reason
        let tooltipMessage = '';
        if (remarkMissing && !row.isResolved) {
          tooltipMessage = '✏️ Add remark first before marking as resolved';
        } else if (physicalQtyIncreasedFromZero) {
          tooltipMessage = '⚠️ Physical quantity changed from 0. Cannot resolve.';
        } else if (resolvingPart === row.partNo) {
          tooltipMessage = '⏳ Processing...';
        }
        
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Tooltip title={tooltipMessage} placement="top" arrow>
              <span>
                <input
                  type="checkbox"
                  checked={row.isResolved || false}
                  disabled={isDisabled}
                  onChange={() => handleResolveToggle(row.partNo, row.isResolved)}
                  style={{
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    width: 18,
                    height: 18,
                    opacity: isDisabled ? 0.4 : 1
                  }}
                />
              </span>
            </Tooltip>
          </Box>
        );
      }
    },
    { field: 'partNo', headerName: 'Part No', width: 150 },
    { field: 'description', headerName: 'Description', width: 250 },
    { field: 'dmsQty', headerName: 'DMS Qty', type: 'number', width: 120 },
    { field: 'physicalQty', headerName: 'Physical Qty', type: 'number', width: 120 },
    {
      field: 'short',
      headerName: 'Short',
      type: 'number',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ color: params.value > 0 ? 'error.main' : 'inherit', fontWeight: params.value > 0 ? 'bold' : 'normal' }}>
          {params.value}
        </Box>
      )
    },
    {
      field: 'excess',
      headerName: 'Excess',
      type: 'number',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Box sx={{ color: params.value > 0 ? 'warning.main' : 'inherit', fontWeight: params.value > 0 ? 'bold' : 'normal' }}>
          {params.value}
        </Box>
      )
    },
    {
      field: 'remark',
      headerName: 'Remark',
      width: 350,
      renderCell: (params: GridRenderCellParams) => {
        const row = params.row as ComparisonRow;
        const isEditing = editingRemark === row.partNo;
        
        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            handleRemarkSave(row.partNo, tempRemark);
          } else if (e.key === 'Escape') {
            handleRemarkCancel();
          }
        };
        
        const handleMouseDown = (e: React.MouseEvent) => {
          e.stopPropagation();
        };
        
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation();
        };
        
        if (isEditing) {
          return (
            <div 
              onMouseDown={handleMouseDown}
              onClick={handleClick}
              style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                value={tempRemark}
                onChange={(e) => setTempRemark(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                placeholder={row.short > 0 || row.excess > 0 ? "Required for discrepancy" : "Optional"}
                disabled={savingRemark === row.partNo}
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '0.875rem'
                  }
                }}
              />
              <Tooltip title="Save">
                <IconButton
                  size="small"
                  onClick={() => handleRemarkSave(row.partNo, tempRemark)}
                  disabled={savingRemark === row.partNo}
                  color="primary"
                >
                  {savingRemark === row.partNo ? <CircularProgress size={20} /> : <SaveIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  onClick={handleRemarkCancel}
                  disabled={savingRemark === row.partNo}
                  color="error"
                >
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            </div>
          );
        }
        
        return (
          <Box 
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            sx={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              gap: 1,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                borderRadius: 1
              }
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                flex: 1,
                color: params.value ? 'inherit' : 'text.secondary',
                fontStyle: params.value ? 'normal' : 'italic'
              }}
            >
              {params.value || 'Click to add remark'}
            </Typography>
            <Tooltip title="Edit remark">
              <IconButton
                size="small"
                onClick={() => handleRemarkEdit(row.partNo, params.value)}
                disabled={savingRemark === row.partNo}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link color="inherit" href="/admin/teams" sx={{ display: 'flex', alignItems: 'center' }}>
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Teams
          </Link>
          <Typography color="text.primary">DMS Comparison</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          DMS Stock Comparison
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={data.length === 0 && remainingParts.length === 0}
            sx={{ mr: 2 }}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setShowRemainingDialog(true)}
            disabled={remainingParts.length === 0}
          >
            {remainingParts.length > 0
              ? `View Remaining Parts (${remainingParts.length})`
              : 'No Remaining Parts'}
          </Button>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper elevation={3} sx={{ p: 4, height: 'calc(100vh - 150px)', width: '100%' }}>
          {uploadDate && (
            <Typography variant="body2" color="textSecondary" sx={{ mb: 0}}>
              Latest DMS Upload: {fileName} | Date: {format(new Date(uploadDate), 'dd MMM yyyy, HH:mm')}
            </Typography>
          )}
          <DataGrid
            rows={sortedData}
            columns={columns}
            checkboxSelection={false}
            disableRowSelectionOnClick
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 25 },
              },
            }}
            pageSizeOptions={[25, 50, 100]}
            getRowClassName={(params) => {
              if (params.row.short > 0) return 'row-short';
              if (params.row.excess > 0) return 'row-excess';
              if (params.row.short === 0 && params.row.excess === 0) return 'row-match';
              return '';
            }}
            sx={{
              '& .row-short': {
                bgcolor: 'rgba(239, 68, 68, 0.1)',
              },
              '& .row-excess': {
                bgcolor: 'rgba(245, 158, 11, 0.1)',
              },
              '& .row-match': {
                bgcolor: 'rgba(16, 185, 129, 0.1)',
              }
            }}
          />
        </Paper>
      )}

      {/* Remaining Parts Dialog (DMS parts not in physical) */}
      <Dialog
        open={showRemainingDialog}
        onClose={() => setShowRemainingDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Remaining Parts in DMS Not in Physical ({remainingParts.length})
        </DialogTitle>
        <DialogContent>
          {remainingParts.length > 0 ? (
            <Paper elevation={2} sx={{ p: 2, width: '100%', marginTop: 1 }}>
              <DataGrid
                rows={remainingParts}
                columns={[
                  { field: 'partNo', headerName: 'Part No', width: 150 },
                  { field: 'description', headerName: 'Description', width: 250 },
                  { field: 'dmsQty', headerName: 'DMS Qty', type: 'number', width: 120 },
                  { field: 'physicalQty', headerName: 'Physical Qty', type: 'number', width: 120 },
                  { field: 'short', headerName: 'Short', type: 'number', width: 120 },
                  { field: 'excess', headerName: 'Excess', type: 'number', width: 120 },
                ]}
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: {
                    paginationModel: { page: 0, pageSize: 10 },
                  },
                }}
                getRowClassName={(params) => {
                  if (params.row.short > 0) return 'row-short';
                  if (params.row.excess > 0) return 'row-excess';
                  if (params.row.short === 0 && params.row.excess === 0) return 'row-match';
                  return '';
                }}
                sx={{
                  '& .row-short': {
                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                  },
                  '& .row-excess': {
                    bgcolor: 'rgba(245, 158, 11, 0.08)',
                  },
                  '& .row-match': {
                    bgcolor: 'rgba(16, 185, 129, 0.08)',
                  },
                  '& .MuiDataGrid-row': {
                    minHeight: 40,
                  },
                }}
              />
            </Paper>
          ) : (
            <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
              No remaining parts. All DMS parts have been physically counted.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRemainingDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Validation Error Snackbar */}
      <Snackbar
        open={!!validationError}
        autoHideDuration={3000}
        onClose={() => setValidationError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MuiAlert severity="warning" onClose={() => setValidationError(null)}>
          {validationError?.message}
        </MuiAlert>
      </Snackbar>

      {/* Flash Message Snackbar for Auto-Resolve */}
      <Snackbar
        open={!!flashMessage}
        autoHideDuration={4000}
        onClose={() => setFlashMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MuiAlert severity="info" onClose={() => setFlashMessage(null)}>
          {flashMessage}
        </MuiAlert>
      </Snackbar>
    </Container>
  );
};

export default DMSComparison;
// src/pages/admin/MasterDescriptionScreen.tsx
import React, { useState, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react';
import api from '../services/api';
import {
  Container,
  Paper,
  Typography,
  Button,
  IconButton,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Grid,
  TextField,
  MenuItem,
  Avatar,
  CircularProgress,
  Tooltip,
  Stack,
  Pagination,
  Snackbar,
  Chip,
  type AlertColor
} from '@mui/material';
import {
  AddCircleOutline,
  Refresh,
  UploadFile,
  RuleFolder,
  Dataset,
  Download,
  DeleteOutline,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import * as XLSX from 'xlsx';

// Type definitions
interface UploadedFile {
  _id?: string;
  filename?: string;
  recordCount?: number;
  uploadDate?: string;
  [key: string]: any;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface DeleteDialogState {
  open: boolean;
  file: UploadedFile | null;
}

interface ManualPartForm {
  auditType: 'TVS' | 'TATA';
  partNo: string;
  description: string;
  ndp: string;
  mrp: string;
}

interface ColumnIndexMap {
  partNo?: number;
  description?: number;
  ndp?: number;
  mrp?: number;
}

interface ProcessedRow {
  partNo: string;
  description: string;
  ndp: number;
  mrp: number;
  itemType: null;
  division: null;
  sourceRow: number;
}

import { useNavigate } from 'react-router-dom';
import {
  Dashboard as DashboardIcon,
  NavigateNext,
  Schedule
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const PRIMARY = '#004F98';
const PER_PAGE = 8;
const initialManualPartForm: ManualPartForm = {
  auditType: 'TVS',
  partNo: '',
  description: '',
  ndp: '',
  mrp: ''
};

const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #004F98 0%, #002D5B 100%)',
  Height: '100px',
  padding: theme.spacing(8, 0),
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(4, 0),
    minHeight: '180px',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 40%)',
    pointerEvents: 'none',
  }
}));

const MasterDescriptionScreen: React.FC = () => {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progressOpen, setProgressOpen] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    file: null
  });
  const [manualPartOpen, setManualPartOpen] = useState<boolean>(false);
  const [manualPartForm, setManualPartForm] = useState<ManualPartForm>(initialManualPartForm);
  const [isSavingManualPart, setIsSavingManualPart] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  useEffect(() => {
    const handleRefreshEvent = () => {
      fetchUploadedFiles();
    };
    window.addEventListener('admin-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('admin-refresh', handleRefreshEvent);
    };
  }, []);

  const fetchUploadedFiles = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await api.getUploadedFilesMetadata();
      const files: UploadedFile[] = (result && result.data && Array.isArray(result.data))
        ? result.data
        : [];
      setUploadedFiles(files);
    } catch (err: any) {
      console.error('Fetch uploaded files error', err);
      showSnackbar('Failed to load uploaded files', 'error');
      setUploadedFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: AlertColor = 'success'): void => {
    setSnackbar({ open: true, message, severity });
    setTimeout(() => setSnackbar({ open: false, message: '', severity: 'success' }), 3500);
  };

  // ---------- Upload handling ----------
  const openFilePicker = (): void => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const onFileSelected = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await handleUploadFile(file);
  };

  const handleUploadFile = async (file: File): Promise<void> => {
    setUploadProgress(0);
    setProgressOpen(true);
    try {
      const filename = file.name;
      setUploadProgress(10);

      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress(35);

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      if (!workbook.SheetNames.length) throw new Error('Excel file contains no sheets');

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      setUploadProgress(60);

      if (!rows || rows.length < 2) throw new Error('Excel must contain header row and at least one data row');

      const processed = processExcelData(rows);
      if (!processed.length) throw new Error('No valid data parsed from Excel');

      setUploadProgress(80);

      const resp = await api.uploadMasterDescriptions(processed, filename);
      setUploadProgress(95);

      if (!resp || !resp.success) throw new Error(resp?.message || 'Upload failed');

      showSnackbar(
        `Uploaded ${filename} — ${processed.length} records (inserted: ${resp.insertedCount || 0})`,
        'success'
      );
      await fetchUploadedFiles();
    } catch (err: any) {
      console.error('Upload error', err);
      showSnackbar(err.message || 'Upload failed', 'error');
    } finally {
      setProgressOpen(false);
      setUploadProgress(0);
    }
  };

  // drag & drop
  useEffect(() => {
    const dropArea = dropRef.current;
    if (!dropArea) return;

    const onDragOver = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dropArea.style.background = 'rgba(0,0,0,0.03)';
    };

    const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dropArea.style.background = 'transparent';
    };

    const onDrop = async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dropArea.style.background = 'transparent';
      const file = e.dataTransfer.files?.[0];
      if (file) await handleUploadFile(file);
    };

    // Type assertion for event listeners
    dropArea.addEventListener('dragover', onDragOver as any);
    dropArea.addEventListener('dragleave', onDragLeave as any);
    dropArea.addEventListener('drop', onDrop as any);

    return () => {
      dropArea.removeEventListener('dragover', onDragOver as any);
      dropArea.removeEventListener('dragleave', onDragLeave as any);
      dropArea.removeEventListener('drop', onDrop as any);
    };
  }, []);

  // ---------- Excel processing ----------
  const processExcelData = (excelData: any[][]): ProcessedRow[] => {
    const headerRow = excelData[0] || [];
    const dataRows = excelData.slice(1);
    const columnIndexMap = createColumnIndexMap(headerRow);

    if (!columnIndexMap.partNo && !columnIndexMap.description && !columnIndexMap.ndp && !columnIndexMap.mrp) {
      console.warn('Header mapping incomplete:', columnIndexMap);
    }

    const json: ProcessedRow[] = [];
    dataRows.forEach((row, idx) => {
      if (isRowEmpty(row)) return;
      const partNo = getCellValue(row, columnIndexMap.partNo);
      if (!partNo) return;
      const description = getCellValue(row, columnIndexMap.description);
      const ndp = getCellNumericValue(row, columnIndexMap.ndp);
      const mrp = getCellNumericValue(row, columnIndexMap.mrp);
      json.push({
        partNo,
        description,
        ndp,
        mrp,
        itemType: null,
        division: null,
        sourceRow: idx + 2
      });
    });
    return json;
  };

  const createColumnIndexMap = (headerRow: any[]): ColumnIndexMap => {
    const columnIndexMap: ColumnIndexMap = {};
    const headerVariations: Record<string, string[]> = {
      partNo: ['part no#3', 'partno', 'part number', 'part_no', '000000000000002219', '000000000000002221'],
      description: ['material description', 'description', 'desc'],
      ndp: ['new ndp', 'ndp', 'net dealer price'],
      mrp: ['new mrp', 'mrp', 'max retail price'],
    };

    headerRow.forEach((cell, index) => {
      if (!cell) return;
      const txt = cell.toString().trim().toLowerCase();
      for (const [key, variants] of Object.entries(headerVariations)) {
        if (variants.includes(txt)) {
          columnIndexMap[key as keyof ColumnIndexMap] = index;
          break;
        }
      }
    });
    return columnIndexMap;
  };

  const isRowEmpty = (row: any[]): boolean => {
    return row.every(cell => cell == null || cell.toString().trim() === '');
  };

  const getCellValue = (row: any[], idx?: number): string => {
    if (idx == null || idx >= row.length || row[idx] == null) return '';
    return row[idx].toString().trim();
  };

  const getCellNumericValue = (row: any[], idx?: number): number => {
    if (idx == null || idx >= row.length || row[idx] == null) return 0.0;
    const s = row[idx].toString().trim().replace(/,/g, '');
    return parseFloat(s) || 0.0;
  };

  const updateManualPartForm = (field: keyof ManualPartForm, value: string): void => {
    setManualPartForm(prev => ({ ...prev, [field]: value }));
  };

  const closeManualPartModal = (): void => {
    if (isSavingManualPart) return;
    setManualPartOpen(false);
    setManualPartForm(initialManualPartForm);
  };

  const saveManualPart = async (): Promise<void> => {
    const partNo = manualPartForm.partNo.trim();
    const description = manualPartForm.description.trim();
    const ndp = Number(manualPartForm.ndp);
    const mrp = Number(manualPartForm.mrp);

    if (!partNo || !description) {
      showSnackbar('Part No and description are required', 'error');
      return;
    }

    if (!Number.isFinite(ndp) || !Number.isFinite(mrp)) {
      showSnackbar('Enter valid NDP and MRP values', 'error');
      return;
    }

    setIsSavingManualPart(true);
    try {
      const result = await api.addManualMasterPart({
        auditType: manualPartForm.auditType,
        partNo,
        description,
        ndp,
        mrp
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to save part');
      }

      showSnackbar(`${manualPartForm.auditType} part saved`, 'success');
      setManualPartOpen(false);
      setManualPartForm(initialManualPartForm);
      await fetchUploadedFiles();
    } catch (err) {
      console.error('manual part save error', err);
      showSnackbar('Failed to save manual part', 'error');
    } finally {
      setIsSavingManualPart(false);
    }
  };

  // ---------- delete flow ----------
  const confirmDelete = async (): Promise<void> => {
    const id = deleteDialog.file?._id;
    if (!id) return;
    try {
      const res = await api.deleteUploadedFile(id);
      if (res && res.success) {
        showSnackbar('File deleted', 'success');
        await fetchUploadedFiles();
      } else {
        showSnackbar(res?.message || 'Delete failed', 'error');
      }
    } catch (err: any) {
      console.error('delete error', err);
      showSnackbar('Delete failed', 'error');
    } finally {
      setDeleteDialog({ open: false, file: null });
    }
  };

  const handleDownloadFile = async (file: UploadedFile): Promise<void> => {
    const id = file._id;
    if (!id) {
      showSnackbar('Download failed: missing file id', 'error');
      return;
    }

    try {
      const blob = await api.downloadUploadedFile(id);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseFilename = file.filename || 'master-descriptions';
      const filename = baseFilename.toLowerCase().endsWith('.xlsx')
        ? baseFilename
        : `${baseFilename.replace(/\.(xls|xlsx)$/i, '')}.xlsx`;

      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showSnackbar('Download started', 'success');
    } catch (err) {
      console.error('download error', err);
      showSnackbar('Download failed', 'error');
    }
  };

  // ---------- pagination ----------
  const pageCount = Math.max(1, Math.ceil(uploadedFiles.length / PER_PAGE));
  const visibleFiles = uploadedFiles.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handlePageChange = (event: ChangeEvent<unknown>, value: number): void => {
    setPage(value);
  };

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <HeroSection>
        <Container maxWidth="xl">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'white', mb: 1 }}>
              Master Descriptions
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 100, maxWidth: 700, mx: 'auto', mb: 1, color: 'white', fontSize: { xs: '1rem', md: '1rem' } }}>
              Upload and manage your global part description database
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddCircleOutline />}
              onClick={() => setManualPartOpen(true)}
              sx={{
                mt: 2,
                bgcolor: 'white',
                color: PRIMARY,
                fontWeight: 700,
                '&:hover': { bgcolor: '#EAF4FF' }
              }}
            >
              Add Part No
            </Button>
          </Box>
        </Container>
      </HeroSection>

      <Container maxWidth="xl" sx={{ mt: 0.5, pb: 8, position: 'relative', zIndex: 2 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%', }}>
          <Grid container spacing={4}>
            {/* Upload column */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 4,
                  boxShadow: '0 10px 25px rgba(0, 79, 152, 0.05)',
                  border: '1px solid #F1F5F9'
                }}
                elevation={0}
              >
                <Stack spacing={2} alignItems="center">
                  <Box
                    ref={dropRef}
                    sx={{
                      width: 140,
                      height: 140,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px dashed ${PRIMARY}33`,
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={openFilePicker}
                  >
                    <RuleFolder sx={{ fontSize: 56, color: PRIMARY }} />
                  </Box>

                  <Typography variant="h6" fontWeight={700} color={PRIMARY}>
                    Upload Master Descriptions
                  </Typography>

                  <Typography variant="body2" color="text.secondary" align="center">
                    Click the box or drop an Excel file (.xls/.xlsx) to convert and upload.
                  </Typography>

                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      startIcon={<UploadFile />}
                      onClick={openFilePicker}
                      sx={{ backgroundColor: PRIMARY }}
                    >
                      Upload Excel
                    </Button>
                    <Button variant="outlined" startIcon={<Refresh />} onClick={fetchUploadedFiles}>
                      Refresh
                    </Button>
                  </Stack>

                  <Box sx={{ width: '100%', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">Flexible Column Headers :</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Part No#3, MATERIAL DESCRIPTION, New NDP, New MRP
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            {/* Files list */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 4,
                  boxShadow: '0 10px 25px rgba(0, 79, 152, 0.05)',
                  border: '1px solid #F1F5F9',
                  minHeight: 500
                }}
                elevation={0}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B', letterSpacing: '-0.5px' }}>
                    Uploaded Repositories
                  </Typography>
                  <Chip
                    label={`${uploadedFiles.length} Databases`}
                    sx={{ bgcolor: '#F1F5F9', fontWeight: 700, color: PRIMARY }}
                  />
                </Stack>

                {isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    {uploadedFiles.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 6 }}>
                        <Typography variant="h6" color="text.secondary">
                          No uploads yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Use Upload Excel to add master descriptions
                        </Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={2}>
                        {visibleFiles.map((file: UploadedFile) => (
                          <Grid size={{ xs: 12, sm: 6 }} key={file._id || file.filename}>
                            <Paper sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                              <Box sx={{
                                width: 56,
                                height: 56,
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: `linear-gradient(135deg, ${PRIMARY}, #0066CC)`
                              }}>
                                <Dataset sx={{ color: 'white' }} />
                              </Box>

                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography noWrap fontWeight={700}>
                                  {file.filename || 'Untitled'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Records: {file.recordCount || 0} •
                                  Uploaded: {file.uploadDate ? new Date(file.uploadDate).toLocaleDateString() : '—'}
                                </Typography>
                              </Box>

                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Tooltip title="Download file">
                                  <IconButton
                                    onClick={() => handleDownloadFile(file)}
                                    aria-label={`download-${file.filename}`}
                                  >
                                    <Download />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete file">
                                  <IconButton
                                    onClick={() => setDeleteDialog({ open: true, file })}
                                    aria-label={`delete-${file.filename}`}
                                  >
                                    <DeleteOutline />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    )}

                    {uploadedFiles.length > PER_PAGE && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                        <Pagination
                          count={pageCount}
                          page={page}
                          onChange={handlePageChange}
                          color="primary"
                        />
                      </Box>
                    )}
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* progress dialog */}
      <Dialog open={progressOpen} onClose={() => setProgressOpen(false)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: PRIMARY }}><Dataset /></Avatar>
            <Box>
              <Typography variant="subtitle1">Processing upload</Typography>
              <Typography variant="caption" color="text.secondary">
                Converting Excel → JSON → uploading to server
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ width: 420 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="body2" align="center" sx={{ mt: 1 }}>
            {Math.round(uploadProgress)}%
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* delete confirm */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, file: null })}
      >
        <DialogTitle>Confirm delete</DialogTitle>
        <DialogContent>
          <Typography>Delete "{deleteDialog.file?.filename}" and its data?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, file: null })}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* manual part modal */}
      <Dialog
        open={manualPartOpen}
        onClose={closeManualPartModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Part No</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Audit Type"
                value={manualPartForm.auditType}
                onChange={(event) => updateManualPartForm('auditType', event.target.value)}
              >
                <MenuItem value="TVS">TVS</MenuItem>
                <MenuItem value="TATA">TATA</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Part No"
                value={manualPartForm.partNo}
                onChange={(event) => updateManualPartForm('partNo', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Material Description"
                value={manualPartForm.description}
                onChange={(event) => updateManualPartForm('description', event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="New NDP"
                type="number"
                value={manualPartForm.ndp}
                onChange={(event) => updateManualPartForm('ndp', event.target.value)}
                inputProps={{ min: 0, step: '0.01' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="New MRP"
                type="number"
                value={manualPartForm.mrp}
                onChange={(event) => updateManualPartForm('mrp', event.target.value)}
                inputProps={{ min: 0, step: '0.01' }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeManualPartModal} disabled={isSavingManualPart}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveManualPart}
            disabled={isSavingManualPart}
            sx={{ bgcolor: PRIMARY }}
          >
            {isSavingManualPart ? 'Saving...' : 'Save Part'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xls,.xlsx"
        style={{ display: 'none' }}
        onChange={onFileSelected}
      />

      {/* snackbar */}
      <Snackbar
        open={snackbar.open}
        message={<span>{snackbar.message}</span>}
        onClose={() => setSnackbar({ open: false, message: '', severity: 'success' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={3500}
      />
    </Box>
  );
};

export default MasterDescriptionScreen; 

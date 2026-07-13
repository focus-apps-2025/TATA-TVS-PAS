import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem as SelectMenuItem,
  Divider
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  TableChart as TableChartIcon
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api from '../../services/api';

interface AuditUploadModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName?: string;
  onSuccess: () => void;
}

const primaryColor = '#004F98';

const normalizeHeader = (value: string): string =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getRowValue = (row: Record<string, unknown>, aliases: string[]): unknown => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const key = Object.keys(row).find((header) =>
    normalizedAliases.includes(normalizeHeader(header))
  );
  return key ? row[key] : undefined;
};

const toNumber = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const AuditUploadModal: React.FC<AuditUploadModalProps> = ({ open, onClose, teamId, teamName, onSuccess }) => {
  const [auditType, setAuditType] = useState<'before' | 'after'>('before');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [existingAudits, setExistingAudits] = useState<{ before?: any; after?: any }>({});
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (open && teamId) {
      fetchExistingAudits();
      setShowUpload(false);
    } else {
      setFile(null);
      setError('');
      setPreview([]);
      setShowUpload(false);
    }
  }, [open, teamId]);

  const fetchExistingAudits = async (): Promise<void> => {
    setLoadingExisting(true);
    try {
      const response = await api.getBeforeAfterAudits(teamId);
      const auditsMap: { before?: any; after?: any } = {};
      (response.data || []).forEach((audit: any) => {
        if (audit.auditType === 'before') auditsMap.before = audit;
        if (audit.auditType === 'after') auditsMap.after = audit;
      });
      setExistingAudits(auditsMap);
    } catch {
      setExistingAudits({});
    } finally {
      setLoadingExisting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    setPreview([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).slice(0, 5);
        setPreview(rawJson);
      } catch {
        // ignore preview errors
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleUpload = async (): Promise<void> => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    setLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        const items = rawJson.map((row, index) => ({
          sNo: toNumber(getRowValue(row, ['S.No', 'SNo', 'Serial No', 'Sr No', 'Sl No', 'Sl.No', 'S No'])) || index + 1,
          pageNo: toNumber(getRowValue(row, ['Page No', 'PageNo', 'Page Number', 'Page'])),
          location: String(getRowValue(row, ['Location', 'Loc', 'Store Location']) ?? '').trim(),
          rack: String(getRowValue(row, ['Rack', 'Rack No', 'Rack Number', 'Rack Code']) ?? '').trim(),
          partNo: String(getRowValue(row, ['Part No', 'PartNo', 'Part Number', 'Part Code', 'Item', 'Part #']) ?? '').trim(),
          phyQty: toNumber(getRowValue(row, ['Physical Qty', 'Phy Qty', 'Qty', 'Quantity', 'Phys Qty', 'Counted Qty', 'Actual Qty'])),
          partDescription: String(getRowValue(row, ['Part Description', 'Description', 'Desc', 'Item Description', 'Material Description', 'Part Name']) ?? '').trim(),
          ndp: toNumber(getRowValue(row, ['NEW NDP', 'NDP', 'Net Dealer Price', 'Unit Price', 'Unit Value', 'Price'])),
          mrp: toNumber(getRowValue(row, ['NEW MRP', 'MRP', 'Max Retail Price', 'Retail Price']))
        })).filter(item => item.partNo);

        if (items.length === 0) {
          setError('No valid data found. Ensure the file has a "Part No" column with data.');
          setLoading(false);
          return;
        }

        await api.saveBeforeAfterAudit({
          teamId,
          auditType,
          fileName: file.name,
          items
        });

        await fetchExistingAudits();
        onSuccess();
        setFile(null);
        setPreview([]);
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to process file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    setError('');
    try {
      await api.deleteBeforeAfterAudit(teamId, auditType);
      setExistingAudits(prev => ({ ...prev, [auditType]: undefined }));
      setShowUpload(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete audit');
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectNew = (): void => {
    setShowUpload(true);
    setFile(null);
    setPreview([]);
  };

  const existingAudit = existingAudits[auditType];

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={800} color={primaryColor}>
            Upload Audit Excel
          </Typography>
          {teamName && (
            <Typography variant="caption" color="text.secondary" display="block">
              {teamName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Audit Type Selector */}
        <FormControl fullWidth sx={{ mb: 2.5, mt: 1 }}>
          <InputLabel>Audit Type</InputLabel>
          <Select
            value={auditType}
            label="Audit Type"
            onChange={(e) => {
              setAuditType(e.target.value as 'before' | 'after');
              setFile(null);
              setPreview([]);
            }}
          >
            <SelectMenuItem value="before">Before Audit</SelectMenuItem>
            <SelectMenuItem value="after">After Audit</SelectMenuItem>
          </Select>
        </FormControl>

        {/* Existing audit info — show when there's an existing upload and not in upload mode */}
        {!loadingExisting && existingAudit && !showUpload && (
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(0, 79, 152, 0.04)', borderColor: 'rgba(0, 79, 152, 0.2)' }}
          >
            <Typography variant="subtitle2" fontWeight={700} color={primaryColor} gutterBottom>
              Previously Uploaded — {auditType === 'before' ? 'Before' : 'After'} Audit
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Box sx={{ p: 0.8, bgcolor: 'rgba(0, 79, 152, 0.1)', borderRadius: 1, color: primaryColor, display: 'flex' }}>
                <TableChartIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={600}>{existingAudit.fileName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {existingAudit.items?.length || 0} rows &nbsp;·&nbsp;
                  Uploaded: {new Date(existingAudit.updatedAt || existingAudit.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSelectNew}
                sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: '#0066CC' } }}
              >
                Upload New File
              </Button>
            </Box>
          </Paper>
        )}

        {/* File Upload Zone — show when no existing or in upload mode */}
        {(!existingAudit || showUpload) && (<Box
          sx={{
            border: `2px dashed ${file ? primaryColor : '#CBD5E1'}`,
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            bgcolor: file ? 'rgba(0, 79, 152, 0.03)' : '#FAFAFA',
            cursor: file ? 'default' : 'pointer',
            transition: 'all 0.2s',
            '&:hover': { borderColor: primaryColor, bgcolor: 'rgba(0, 79, 152, 0.04)' }
          }}
          onClick={() => !file && document.getElementById('audit-file-input')?.click()}
        >
          <input
            id="audit-file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {file ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                <Box sx={{ p: 0.8, bgcolor: 'rgba(0, 79, 152, 0.12)', borderRadius: 1, color: primaryColor, display: 'flex' }}>
                  <TableChartIcon />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{(file.size / 1024).toFixed(1)} KB</Typography>
                </Box>
              </Box>
              <IconButton
                onClick={(e) => { e.stopPropagation(); setFile(null); setPreview([]); }}
                color="error"
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 40, color: '#94A3B8', mb: 1 }} />
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                Click to select Excel file
              </Typography>
              <Typography variant="caption" color="text.disabled">
                .xlsx, .xls, .csv — Required: Part No, Physical Qty
              </Typography>
            </>
          )}
        </Box>)}

        {/* Preview table */}
        {preview.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              PREVIEW (first {preview.length} rows)
            </Typography>
            <Box sx={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {Object.keys(preview[0]).map((col) => (
                      <th key={col} style={{ padding: '4px 8px', background: '#F1F5F9', borderBottom: '1px solid #E5E7EB', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} style={{ padding: '4px 8px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>
                          {String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        )}
      </DialogContent>

      <Divider sx={{ mt: 2 }} />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!file || loading}
          onClick={handleUpload}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
          sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: '#0066CC' }, textTransform: 'none', fontWeight: 700 }}
        >
          {loading ? 'Uploading...' : `Upload ${auditType === 'before' ? 'Before' : 'After'} Audit`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AuditUploadModal;

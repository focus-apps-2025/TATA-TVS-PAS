import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api, { type Team } from '../../services/api';

type AuditType = 'before' | 'after';

interface AuditRow {
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

interface ExistingAuditUpload {
  fileName?: string;
  createdAt?: string;
  items?: AuditRow[];
}

interface BeforeAfterAuditUploadModalProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
}

const primaryColor = '#004F98';

const normalizeHeader = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const getRowValue = (row: Record<string, any>, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const key = Object.keys(row).find((header) => normalizedAliases.includes(normalizeHeader(header)));
  return key ? row[key] : undefined;
};

const toNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseAuditFile = async (file: File): Promise<AuditRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  return rows
    .map((row, index) => ({
      sNo: toNumber(getRowValue(row, ['S.No', 'Sl No', 'SNo'])) || index + 1,
      pageNo: toNumber(getRowValue(row, ['Page No', 'PageNo'])),
      location: String(getRowValue(row, ['Location']) || '').trim(),
      rack: String(getRowValue(row, ['Rack', 'Rack No', 'RackNo']) || '').trim(),
      partNo: String(getRowValue(row, ['PartNo', 'Part No', 'Part Number', 'Part Code']) || '').trim(),
      phyQty: toNumber(getRowValue(row, ['Phy Qty', 'Quantity', 'Qty', 'Stock', 'Count'])),
      partDescription: String(getRowValue(row, ['Part Description', 'Description', 'Material Description']) || '').trim(),
      ndp: toNumber(getRowValue(row, ['NEW NDP', 'NDP', 'Unit Price', 'Unit Value'])),
      mrp: toNumber(getRowValue(row, ['NEW MRP', 'MRP', 'Total Value', 'Retail Price'])),
    }))
    .filter((row) => row.partNo || row.partDescription);
};

const BeforeAfterAuditUploadModal: React.FC<BeforeAfterAuditUploadModalProps> = ({ open, team, onClose }) => {
  const [files, setFiles] = useState<Record<AuditType, File | null>>({ before: null, after: null });
  const [existingUploads, setExistingUploads] = useState<Record<AuditType, ExistingAuditUpload | null>>({ before: null, after: null });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadExistingUploads = async () => {
      const teamId = team?._id || team?.id;
      if (!open || !teamId) {
        setExistingUploads({ before: null, after: null });
        setFiles({ before: null, after: null });
        return;
      }

      try {
        const response = await api.getBeforeAfterAudits(teamId);
        const nextUploads: Record<AuditType, ExistingAuditUpload | null> = { before: null, after: null };

        (response.data || []).forEach((audit: any) => {
          const auditType = audit.auditType as AuditType | undefined;
          if (auditType === 'before' || auditType === 'after') {
            nextUploads[auditType] = {
              fileName: audit.fileName,
              createdAt: audit.createdAt,
              items: audit.items || []
            };
          }
        });

        setExistingUploads(nextUploads);
      } catch {
        setExistingUploads({ before: null, after: null });
      }
    };

    loadExistingUploads();
  }, [open, team]);

  const handleFileChange = (auditType: AuditType, fileList: FileList | null) => {
    setFiles((previous) => ({ ...previous, [auditType]: fileList?.[0] || null }));
    setMessage('');
    setError('');
  };

  const handleDelete = async (auditType: AuditType) => {
    const teamId = team?._id || team?.id;
    if (!teamId) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      await api.deleteBeforeAfterAudit(teamId, auditType);
      setExistingUploads((previous) => ({ ...previous, [auditType]: null }));
      setFiles((previous) => ({ ...previous, [auditType]: null }));
      setMessage(`${auditType === 'before' ? 'Before' : 'After'} audit data deleted successfully.`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to delete audit data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const teamId = team?._id || team?.id;
    if (!teamId) return;
    if (!files.before && !files.after) {
      setError('Please choose Before Audit or After Audit Excel file.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      for (const auditType of ['before', 'after'] as AuditType[]) {
        const file = files[auditType];
        if (!file) continue;
        const items = await parseAuditFile(file);
        if (!items.length) {
          throw new Error(`${auditType === 'before' ? 'Before' : 'After'} Audit file has no valid rows.`);
        }
        await api.saveBeforeAfterAudit({
          teamId,
          auditType,
          fileName: file.name,
          items
        });
      }
      setFiles({ before: null, after: null });
      setMessage('Before/After audit data saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save audit data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Before / After Audit Upload - {team?.siteName || ''}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

        {(['before', 'after'] as AuditType[]).map((auditType) => (
          <Box
            key={auditType}
            sx={{
              p: 2,
              mb: 2,
              border: '1px solid #E5E7EB',
              borderRadius: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700}>
                {auditType === 'before' ? 'Before Audit Excel' : 'After Audit Excel'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {existingUploads[auditType]?.fileName || 'No uploaded file'}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {existingUploads[auditType]?.createdAt
                  ? `Uploaded: ${new Date(existingUploads[auditType].createdAt as string).toLocaleString()}`
                  : 'No file uploaded yet'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Selected: {files[auditType]?.name || 'No new file selected'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                {existingUploads[auditType] && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(auditType)}
                    disabled={loading}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  component="label"
                  size="small"
                  variant="contained"
                  startIcon={<CloudUploadIcon />}
                  sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: '#003F7A' } }}
                >
                  {existingUploads[auditType] ? 'Upload New File' : 'Choose'}
                  <input
                    hidden
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(event) => handleFileChange(auditType, event.target.files)}
                  />
                </Button>
              </Box>
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={loading}
          sx={{ bgcolor: primaryColor }}
        >
          {loading ? 'Saving...' : 'Save Audit Data'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BeforeAfterAuditUploadModal;

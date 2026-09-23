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
  Paper
} from '@mui/material';
import { CloudUpload as CloudUploadIcon, Delete as DeleteIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import api from '../../services/api';

interface DMSUploadModalProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  onSuccess: () => void;
}

interface ExistingUpload {
  _id: string;
  fileName: string;
  createdAt: string;
  items: Array<{ partNo: string; quantity: number; description?: string; ndp?: number; mrp?: number }>;
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
// Column order is intentionally irrelevant.  Different DMS/SAP exports use different headings.
const partNoAliases = [
  'Part No', 'Part Number', 'Part Code', 'Item', 'Item Code', 'Item Number',
  'Material', 'Material Code', 'Material Number', 'Spare Part No', 'Spare Part Number'
];
const quantityAliases = [
  'Quantity', 'Qty', 'Total Stock', 'Stock', 'Free Qty', 'Free Stock',
  'System Qty', 'System Quantity', 'Available Qty', 'Available Quantity',
  'Closing Stock', 'On Hand Qty', 'On Hand Quantity', 'Unrestricted Stock', 'Unrestricted',
  'Quantity Unrestricted', 'Qty Unrestricted', 'Unrestricted Quantity'
];
const descriptionAliases = [
  'Description', 'Desc', 'Part Description', 'Material Description', 'Item Description'
];

const matchesAlias = (header: string, aliases: string[]) => {
  const normalizedHeader = normalizeHeader(header);
  return aliases.map(normalizeHeader).some((alias) => (
    normalizedHeader === alias
    // SAP may suffix duplicate headings, for example Part No#3. Only a
    // numeric suffix is accepted so "Material Description" never matches
    // the separate "Material" (Part No) column.
    || (alias !== 'item' && alias.length > 3 && normalizedHeader.startsWith(alias) && /^\d+$/.test(normalizedHeader.slice(alias.length)))
  ));
};

const getRowValue = (row: any, aliases: string[]) => {
  const key = Object.keys(row).find((header) => matchesAlias(header, aliases));
  return key ? row[key] : undefined;
};

const toNumber = (value: any): number => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const findHeaderRow = (sheet: XLSX.WorkSheet) => {
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

  return rows.findIndex((row) => {
    const headers = (Array.isArray(row) ? row : []).map((cell) => String(cell));
    return headers.some((header) => matchesAlias(header, partNoAliases))
      && headers.some((header) => matchesAlias(header, quantityAliases));
  });
};

const DMSUploadModal: React.FC<DMSUploadModalProps> = ({ open, onClose, teamId, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingUpload, setExistingUpload] = useState<ExistingUpload | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch existing upload when modal opens
  useEffect(() => {
    if (open && teamId) {
      fetchExistingUpload();
    } else {
      setExistingUpload(null);
      setFile(null);
    }
  }, [open, teamId]);

  const fetchExistingUpload = async () => {
    try {
      const response = await api.getDMSUpload(teamId);
      if (response.success && response.data) {
        setExistingUpload(response.data);
      } else {
        setExistingUpload(null);
      }
    } catch (err) {
      setExistingUpload(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          // SAP/DMS workbooks can open on a cover sheet or include a metadata tab.
          // Search every worksheet and use the one containing the stock headers.
          const matchedSheet = workbook.SheetNames
            .map((sheetName) => ({ sheet: workbook.Sheets[sheetName], headerRow: findHeaderRow(workbook.Sheets[sheetName]) }))
            .find(({ headerRow }) => headerRow !== -1);
          if (!matchedSheet) {
            setError('DMS file must contain Material/Part No and Unrestricted/Quantity columns.');
            setLoading(false);
            return;
          }
          const rawJson = XLSX.utils.sheet_to_json(matchedSheet.sheet, { range: matchedSheet.headerRow, defval: '' });

          const items = rawJson.map((row: any) => {
            const partNo = getRowValue(row, partNoAliases);
            const rawQty = getRowValue(row, quantityAliases);
            const rawNdp = getRowValue(row, ['NEW NDP', 'NDP', 'Unit Value', 'Unit Price', 'Net Dealer Price']);
            const rawMrp = getRowValue(row, ['NEW MRP', 'MRP', 'Total Value', 'Max Retail Price', 'Retail Price']);
            const description = getRowValue(row, descriptionAliases) || '';
            
            return {
              partNo: String(partNo || '').trim(),
              quantity: toNumber(rawQty),
              ndp: toNumber(rawNdp),
              mrp: toNumber(rawMrp),
              description: String(description).trim()
            };
          }).filter(item => item.partNo);

          if (items.length === 0) {
            setError('No valid data found in the Excel file.');
            setLoading(false);
            return;
          }

          console.log('Uploading DMS data:', { teamId, fileName: file.name, itemsCount: items.length });
          
          await api.uploadDMS({
            teamId,
            fileName: file.name,
            items
          });

          onSuccess();
          onClose();
        } catch (err: any) {
          setError(err.message || 'Failed to process Excel file');
        } finally {
          setLoading(false);
        }
      };
      
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setError(err.message || 'Failed to upload');
      setLoading(false);
    }
  };

  const handleDeleteUpload = async () => {
    if (!existingUpload) return;
    
    setDeleting(true);
    setError('');
    
    try {
      await api.deleteDMSUpload(existingUpload._id);
      setExistingUpload(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete upload');
    } finally {
      setDeleting(false);
    }
  };

  const handleSelectNew = () => {
    setExistingUpload(null);
    setFile(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload DMS Stock Data</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* Show existing upload info */}
        {existingUpload && !file && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(0, 79, 152, 0.04)' }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Previously Uploaded File
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box sx={{ p: 1, bgcolor: 'rgba(0, 79, 152, 0.1)', borderRadius: 1, mr: 2, color: '#004F98', display: 'flex' }}>
                <CloudUploadIcon />
              </Box>
              <Box>
                <Typography variant="body2" fontWeight="medium">{existingUpload.fileName}</Typography>
                <Typography variant="caption" color="textSecondary">
                  Uploaded: {new Date(existingUpload.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
            <Typography variant="caption" color="textSecondary">
              Items: {existingUpload.items?.length || 0} | 
              Total Quantity: {existingUpload.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button size="small" variant="outlined" color="error" onClick={handleDeleteUpload} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button size="small" variant="contained" onClick={handleSelectNew}>
                Upload New File
              </Button>
            </Box>
          </Paper>
        )}
        
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            accept=".xlsx, .xls, .csv"
            style={{ display: 'none' }}
            id="raised-button-file"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="raised-button-file">
            {!file && !existingUpload && (
              <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />} sx={{ mb: 2 }}>
                Select Excel File
              </Button>
            )}
          </label>
          
          {file && (
            <Paper variant="outlined" sx={{ mt: 2, mb: 2, p: 2, display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                <Box sx={{ p: 1, bgcolor: 'rgba(0, 79, 152, 0.1)', borderRadius: 1, mr: 2, color: '#004F98', display: 'flex' }}>
                  <CloudUploadIcon />
                </Box>
                <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                  <Typography variant="body2" fontWeight="bold" noWrap title={file.name}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {(file.size / 1024).toFixed(2)} KB
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={() => setFile(null)} color="error" size="small">
                <DeleteIcon />
              </IconButton>
            </Paper>
          )}
          
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
            Required columns: Material or Part No, plus Unrestricted/Quantity/Quantity Unrestricted. Optional: Description or Material Description, NDP/Unit Value, MRP/Total Value
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button 
          onClick={handleUpload} 
          variant="contained" 
          disabled={!file || loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DMSUploadModal;

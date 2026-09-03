import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { CloudUpload as CloudUploadIcon, DeleteOutline as DeleteOutlineIcon, Download as DownloadIcon, EditOutlined as EditOutlinedIcon, InsertDriveFileOutlined as FileIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import api from '../services/api';

type AuditFile = { _id: string; fileName: string; mimeType: string; createdAt: string; updatedAt: string };
const formatDateTime = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const AuditFileUploads = () => {
  const [files, setFiles] = useState<AuditFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fileToRename, setFileToRename] = useState<AuditFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [fileToDelete, setFileToDelete] = useState<AuditFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await api.getAuditFiles();
      if (!response.success) throw new Error(response.message || 'Unable to load saved audit files.');
      setFiles(response.data as AuditFile[]);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load saved audit files.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadFiles(); }, []);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError('Only Excel files (.xlsx or .xls) can be uploaded.'); return; }
    setUploading(true); setError(''); setMessage('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('Unable to read the selected file.')); reader.readAsDataURL(file); });
      const response = await api.uploadAuditFile({ fileName: file.name, mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileBase64: base64 });
      if (!response.success) throw new Error(response.message || 'Unable to save the audit file.');
      setMessage(`Saved “${file.name}”. Uploading the same filename again replaces its saved copy.`);
      await loadFiles();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the audit file.'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (file: AuditFile) => {
    try {
      const blob = await api.downloadAuditFile(file._id);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the audit file.'); }
  };
  const handleRename = async () => {
    if (!fileToRename || !newFileName.trim()) return;
    try {
      const response = await api.renameAuditFile(fileToRename._id, newFileName.trim());
      if (!response.success) throw new Error(response.message || 'Unable to rename the audit file.');
      setFiles((current) => current.map((file) => file._id === fileToRename._id ? response.data as AuditFile : file));
      setFileToRename(null); setNewFileName(''); setMessage('Filename updated successfully.');
    } catch (renameError) { setError(renameError instanceof Error ? renameError.message : 'Unable to rename the audit file.'); }
  };
  const handleDelete = async () => {
    if (!fileToDelete) return;
    try {
      const response = await api.deleteAuditFile(fileToDelete._id);
      if (!response.success) throw new Error(response.message || 'Unable to delete the audit file.');
      setFiles((current) => current.filter((file) => file._id !== fileToDelete._id));
      setFileToDelete(null); setMessage('Audit file deleted.');
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the audit file.'); }
  };

  return <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, pb: 8 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2.5} sx={{ mb: 3 }}><Box><Typography variant="h4" fontWeight={850} color="#123B45">Audit File Uploads</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Keep completed audit Excel files available for download.</Typography></Box><Button variant="contained" component="label" startIcon={<CloudUploadIcon />} disabled={uploading} sx={{ bgcolor: '#0054A6' }}>Upload Excel<input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={handleUpload} /></Button></Stack>
    {uploading && <LinearProgress sx={{ mb: 2 }} />}{error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
    <Card variant="outlined"><CardContent sx={{ p: 0 }}><Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Box><Typography variant="h6" fontWeight={800}>Saved Excel Files</Typography><Typography variant="body2" color="text.secondary">Files are saved by filename. A repeat upload replaces the existing file.</Typography></Box><Chip label={`${files.length} files`} color="primary" variant="outlined" /></Box><TableContainer><Table size="small"><TableHead><TableRow>{['File Name', 'Uploaded / Updated', 'Action'].map((header) => <TableCell key={header} sx={{ bgcolor: '#E7F0FB', color: '#0054A6', fontWeight: 800, py: 1.5 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{files.length ? files.map((file) => <TableRow key={file._id} hover><TableCell><Stack direction="row" spacing={1.25} alignItems="center"><FileIcon color="primary" /><Typography fontWeight={700}>{file.fileName}</Typography></Stack></TableCell><TableCell>{formatDateTime(file.updatedAt)}</TableCell><TableCell><Stack direction="row" spacing={0.5}><Tooltip title="Download"><IconButton size="small" color="primary" onClick={() => handleDownload(file)}><DownloadIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Rename"><IconButton size="small" color="primary" onClick={() => { setFileToRename(file); setNewFileName(file.fileName); }}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setFileToDelete(file)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></Stack></TableCell></TableRow>) : <TableRow><TableCell colSpan={3} align="center" sx={{ py: 7, color: 'text.secondary' }}>{loading ? 'Loading saved audit files...' : 'No Excel files have been uploaded yet.'}</TableCell></TableRow>}</TableBody></Table></TableContainer></CardContent></Card>
    <Dialog open={Boolean(fileToRename)} onClose={() => setFileToRename(null)} maxWidth="sm" fullWidth><DialogTitle fontWeight={800}>Rename audit file</DialogTitle><DialogContent dividers><TextField fullWidth autoFocus label="Excel filename" value={newFileName} onChange={(event) => setNewFileName(event.target.value)} helperText="Use an .xlsx or .xls filename." /></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setFileToRename(null)}>Cancel</Button><Button variant="contained" onClick={handleRename}>Save Name</Button></DialogActions></Dialog>
    <Dialog open={Boolean(fileToDelete)} onClose={() => setFileToDelete(null)} maxWidth="xs" fullWidth><DialogTitle fontWeight={800}>Delete audit file?</DialogTitle><DialogContent dividers><Typography>This permanently removes “{fileToDelete?.fileName}”.</Typography></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setFileToDelete(null)}>Cancel</Button><Button variant="contained" color="error" onClick={handleDelete}>Delete</Button></DialogActions></Dialog>
  </Container>;
};

export default AuditFileUploads;

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Add as AddIcon, CloudUpload as CloudUploadIcon, DeleteOutline as DeleteIcon, Download as DownloadIcon, EditOutlined as EditIcon, FolderOutlined as FolderIcon, InsertDriveFileOutlined as FileIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import api from '../services/api';

type AuditFile = { _id: string; financialYear: string; month: string; fileName: string; mimeType: string; createdAt: string; updatedAt: string };
type FinancialYear = { _id: string; title: string; createdAt: string };
const currentMonth = () => new Date().toISOString().slice(0, 7);
const dateTime = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const AuditFileUploads = () => {
  const [files, setFiles] = useState<AuditFile[]>([]);
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newYearOpen, setNewYearOpen] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [renameFile, setRenameFile] = useState<AuditFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [deleteFile, setDeleteFile] = useState<AuditFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadYears = async () => {
    const response = await api.getAuditFinancialYears();
    if (!response.success) throw new Error(response.message || 'Unable to load financial year folders.');
    const loaded = response.data as FinancialYear[];
    setYears(loaded); setYear((current) => current || loaded[0]?.title || '');
  };
  const loadFiles = async () => {
    if (!year || !month) { setFiles([]); setLoading(false); return; }
    setLoading(true);
    try { const response = await api.getAuditFiles(year, month); if (!response.success) throw new Error(response.message || 'Unable to load saved audit files.'); setFiles(response.data as AuditFile[]); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load saved audit files.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadYears().catch((loadError) => { setError(loadError instanceof Error ? loadError.message : 'Unable to load financial year folders.'); setLoading(false); }); }, []);
  useEffect(() => { void loadFiles(); }, [year, month]);
  useEffect(() => { setPage(0); }, [year, month, search]);

  const createYear = async () => {
    const title = newYear.trim(); if (!title) return;
    try { const response = await api.createAuditFinancialYear(title); if (!response.success) throw new Error(response.message || 'Unable to create financial year folder.'); const created = response.data as FinancialYear; setYears((current) => [created, ...current]); setYear(created.title); setNewYear(''); setNewYearOpen(false); setMessage(`Created ${title}.`); }
    catch (createError) { setError(createError instanceof Error ? createError.message : 'Unable to create financial year folder.'); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!year) { setError('Create or select a financial year folder first.'); return; }
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError('Only Excel files (.xlsx or .xls) can be uploaded.'); return; }
    setUploading(true); setError(''); setMessage('');
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('Unable to read the selected file.')); reader.readAsDataURL(file); });
      const response = await api.uploadAuditFile({ financialYear: year, month, fileName: file.name, mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileBase64 });
      if (!response.success) throw new Error(response.message || 'Unable to save audit file.'); setMessage(`Saved “${file.name}” in ${year} · ${month}.`); await loadFiles();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload audit file.'); }
    finally { setUploading(false); }
  };
  const download = async (file: AuditFile) => {
    try { const blob = await api.downloadAuditFile(file._id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.fileName; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
    catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : 'Unable to download audit file.'); }
  };
  const rename = async () => {
    if (!renameFile || !newFileName.trim()) return;
    try { const response = await api.renameAuditFile(renameFile._id, newFileName.trim()); if (!response.success) throw new Error(response.message || 'Unable to rename audit file.'); setFiles((current) => current.map((file) => file._id === renameFile._id ? response.data as AuditFile : file)); setRenameFile(null); setMessage('Filename updated.'); }
    catch (renameError) { setError(renameError instanceof Error ? renameError.message : 'Unable to rename audit file.'); }
  };
  const remove = async () => {
    if (!deleteFile) return;
    try { const response = await api.deleteAuditFile(deleteFile._id); if (!response.success) throw new Error(response.message || 'Unable to delete audit file.'); setFiles((current) => current.filter((file) => file._id !== deleteFile._id)); setDeleteFile(null); setMessage('Audit file deleted.'); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete audit file.'); }
  };
  const filteredFiles = files.filter((file) => file.fileName.toLowerCase().includes(search.trim().toLowerCase()));
  const pagedFiles = filteredFiles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 }, pb: 8 }}>
    <Box sx={{ mb: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}><Box><Typography variant="h4" fontWeight={800} color="primary.main">Audit Files</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Keep audit Excel files organised by financial year and month.</Typography></Box><Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewYearOpen(true)}>New Financial Year</Button></Stack></Box>
    <Card variant="outlined" sx={{ mb: 2.5 }}><CardContent sx={{ p: { xs: 2, md: 2.25 } }}><Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }}><Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: { lg: 165 } }}><FolderIcon color="primary" /><Typography fontWeight={750}>File location</Typography></Stack><TextField select size="small" label="Financial Year" value={year} onChange={(event) => setYear(event.target.value)} sx={{ minWidth: { lg: 230 }, flexGrow: 1 }}>{years.length ? years.map((item) => <MenuItem key={item._id} value={item.title}>{item.title}</MenuItem>) : <MenuItem disabled value="">No folders created yet</MenuItem>}</TextField><TextField size="small" label="Month" type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth())} InputLabelProps={{ shrink: true }} sx={{ minWidth: { lg: 175 } }} /><Button variant="contained" component="label" startIcon={<CloudUploadIcon />} disabled={uploading || !year} sx={{ whiteSpace: 'nowrap' }}>Upload Excel<input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={upload} /></Button></Stack></CardContent></Card>
    {uploading && <LinearProgress sx={{ mb: 2 }} />}{error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
    <Card variant="outlined"><CardContent sx={{ p: 0 }}><Box sx={{ px: 2.5, py: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}><Box><Typography variant="h6" fontWeight={800}>Saved Excel Files</Typography><Typography variant="body2" color="text.secondary">{year ? `${year} · ${month}` : 'Select a financial year folder to view files.'}</Typography></Box><Stack direction="row" spacing={1.25} alignItems="center"><TextField size="small" placeholder="Search files" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <SearchIcon color="action" fontSize="small" sx={{ mr: 0.75 }} /> }} sx={{ width: { xs: '100%', sm: 220 } }} /><Chip label={`${filteredFiles.length} files`} color="primary" variant="outlined" /></Stack></Box><TableContainer><Table size="small"><TableHead><TableRow>{['File Name', 'Uploaded / Updated', 'Action'].map((header) => <TableCell key={header} sx={{ bgcolor: '#E7F0FB', color: '#0054A6', fontWeight: 800, py: 1.5 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{filteredFiles.length ? pagedFiles.map((file) => <TableRow key={file._id} hover><TableCell><Stack direction="row" spacing={1.25} alignItems="center"><FileIcon color="primary" /><Typography fontWeight={700}>{file.fileName}</Typography></Stack></TableCell><TableCell>{dateTime(file.updatedAt)}</TableCell><TableCell><Stack direction="row" spacing={0.5}><Tooltip title="Download"><IconButton size="small" color="primary" onClick={() => download(file)}><DownloadIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Rename"><IconButton size="small" color="primary" onClick={() => { setRenameFile(file); setNewFileName(file.fileName); }}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteFile(file)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Stack></TableCell></TableRow>) : <TableRow><TableCell colSpan={3} align="center" sx={{ py: 7, color: 'text.secondary' }}>{loading ? 'Loading saved audit files...' : search ? 'No files match your search.' : year ? 'No Excel files uploaded for this month.' : 'Create a financial year folder to get started.'}</TableCell></TableRow>}</TableBody></Table></TableContainer>{filteredFiles.length > 0 && <TablePagination component="div" count={filteredFiles.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />}</CardContent></Card>
    <Dialog open={newYearOpen} onClose={() => setNewYearOpen(false)} maxWidth="sm" fullWidth><DialogTitle fontWeight={800}>Create Financial Year Folder</DialogTitle><DialogContent dividers><TextField fullWidth autoFocus label="Financial Year Title" placeholder="Example: FY 2026-27" value={newYear} onChange={(event) => setNewYear(event.target.value)} helperText="This folder contains month-wise audit files." /></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setNewYearOpen(false)}>Cancel</Button><Button variant="contained" onClick={createYear}>Create Folder</Button></DialogActions></Dialog>
    <Dialog open={Boolean(renameFile)} onClose={() => setRenameFile(null)} maxWidth="sm" fullWidth><DialogTitle fontWeight={800}>Rename audit file</DialogTitle><DialogContent dividers><TextField fullWidth autoFocus label="Excel filename" value={newFileName} onChange={(event) => setNewFileName(event.target.value)} helperText="Use an .xlsx or .xls filename." /></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setRenameFile(null)}>Cancel</Button><Button variant="contained" onClick={rename}>Save Name</Button></DialogActions></Dialog>
    <Dialog open={Boolean(deleteFile)} onClose={() => setDeleteFile(null)} maxWidth="xs" fullWidth><DialogTitle fontWeight={800}>Delete audit file?</DialogTitle><DialogContent dividers><Typography>This permanently removes “{deleteFile?.fileName}”.</Typography></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setDeleteFile(null)}>Cancel</Button><Button variant="contained" color="error" onClick={remove}>Delete</Button></DialogActions></Dialog>
  </Container>;
};

export default AuditFileUploads;

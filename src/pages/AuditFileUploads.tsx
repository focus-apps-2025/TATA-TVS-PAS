import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Add as AddIcon, CloudUpload as CloudUploadIcon, DeleteOutline as DeleteIcon, Download as DownloadIcon, EditOutlined as EditIcon, FolderOutlined as FolderIcon, InsertDriveFileOutlined as FileIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import api from '../services/api';

type AuditFile = { _id: string; financialYear: string; month: string; fileName: string; mimeType: string; createdAt: string; updatedAt: string };
type AuditFolder = { _id: string; name: string; parentFolder?: string | null; createdAt: string };
const dateTime = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const AuditFileUploads = () => {
  const [files, setFiles] = useState<AuditFile[]>([]);
  const [folders, setFolders] = useState<AuditFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<AuditFolder | null>(null);
  const [folderTrail, setFolderTrail] = useState<AuditFolder[]>([]);
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

  const loadFiles = async () => {
    setLoading(true);
    try { const response = await api.getAuditFolderContents(currentFolder?._id); if (!response.success) throw new Error(response.message || 'Unable to load folder contents.'); const data = response.data as { folders: AuditFolder[]; files: AuditFile[] }; setFolders(data.folders); setFiles(data.files); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load saved audit files.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadFiles(); }, [currentFolder]);
  useEffect(() => { setPage(0); }, [currentFolder, search]);

  const createYear = async () => {
    const title = newYear.trim(); if (!title) return;
    try { const response = await api.createAuditFolder(title, currentFolder?._id); if (!response.success) throw new Error(response.message || 'Unable to create folder.'); setNewYear(''); setNewYearOpen(false); setMessage(`Created folder “${title}”.`); await loadFiles(); }
    catch (createError) { setError(createError instanceof Error ? createError.message : 'Unable to create financial year folder.'); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setUploading(true); setError(''); setMessage('');
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.onerror = () => reject(new Error('Unable to read the selected file.')); reader.readAsDataURL(file); });
      const response = await api.uploadAuditFile({ folder: currentFolder?._id, financialYear: currentFolder ? `folder:${currentFolder._id}` : 'root', month: '0000-00', fileName: file.name, mimeType: file.type || 'application/octet-stream', fileBase64 });
      if (!response.success) throw new Error(response.message || 'Unable to save audit file.'); setMessage(`Saved “${file.name}”.`); await loadFiles();
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
    <Box sx={{ mb: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}><Box><Typography variant="h4" fontWeight={800} color="primary.main">Audit File Explorer</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Create folders and nested subfolders exactly as needed for your audit documents.</Typography></Box><Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewYearOpen(true)}>New folder</Button><Button variant="contained" component="label" startIcon={<CloudUploadIcon />} disabled={uploading}>Upload file<input ref={inputRef} hidden type="file" onChange={upload} /></Button></Stack></Stack></Box>
    <Card variant="outlined" sx={{ mb: 2.5 }}><CardContent sx={{ p: { xs: 1.5, md: 2 } }}><Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap"><Button size="small" startIcon={<FolderIcon />} onClick={() => { setCurrentFolder(null); setFolderTrail([]); }}>Audit uploads</Button>{folderTrail.map((folder) => <Button key={folder._id} size="small" onClick={() => { const index = folderTrail.findIndex((item) => item._id === folder._id); setCurrentFolder(folder); setFolderTrail(folderTrail.slice(0, index + 1)); }}> / {folder.name}</Button>)}{currentFolder && <Typography fontWeight={700} sx={{ ml: 0.5 }}>{currentFolder.name}</Typography>}</Stack></CardContent></Card>
    {uploading && <LinearProgress sx={{ mb: 2 }} />}{error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
    <Card variant="outlined"><CardContent sx={{ p: 0 }}><Box sx={{ px: 2.5, py: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}><Box><Typography variant="h6" fontWeight={800}>Contents</Typography><Typography variant="body2" color="text.secondary">{folders.length} folders · {filteredFiles.length} files</Typography></Box><Stack direction="row" spacing={1.25} alignItems="center"><TextField size="small" placeholder="Search files" value={search} onChange={(event) => setSearch(event.target.value)} InputProps={{ startAdornment: <SearchIcon color="action" fontSize="small" sx={{ mr: 0.75 }} /> }} sx={{ width: { xs: '100%', sm: 220 } }} /><Chip label={`${folders.length + filteredFiles.length} items`} color="primary" variant="outlined" /></Stack></Box><Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1 }}>{folders.map((folder) => <Button key={folder._id} onDoubleClick={() => { setCurrentFolder(folder); setFolderTrail((trail) => [...trail, folder]); }} onClick={() => { setCurrentFolder(folder); setFolderTrail((trail) => [...trail, folder]); }} sx={{ minHeight: 94, justifyContent: 'flex-start', textAlign: 'left', border: '1px solid #DCE6F2', borderRadius: 2, px: 1.5, color: '#17324D', textTransform: 'none' }} startIcon={<FolderIcon color="primary" />}><Typography fontWeight={700} noWrap>{folder.name}</Typography></Button>)}</Box><TableContainer><Table size="small"><TableHead><TableRow>{['File Name', 'Uploaded / Updated', 'Action'].map((header) => <TableCell key={header} sx={{ bgcolor: '#E7F0FB', color: '#0054A6', fontWeight: 800, py: 1.5 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{filteredFiles.length ? pagedFiles.map((file) => <TableRow key={file._id} hover><TableCell><Stack direction="row" spacing={1.25} alignItems="center"><FileIcon color="primary" /><Typography fontWeight={700}>{file.fileName}</Typography></Stack></TableCell><TableCell>{dateTime(file.updatedAt)}</TableCell><TableCell><Stack direction="row" spacing={0.5}><Tooltip title="Download"><IconButton size="small" color="primary" onClick={() => download(file)}><DownloadIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Rename"><IconButton size="small" color="primary" onClick={() => { setRenameFile(file); setNewFileName(file.fileName); }}><EditIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteFile(file)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Stack></TableCell></TableRow>) : !folders.length && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 7, color: 'text.secondary' }}>{loading ? 'Loading folder contents...' : search ? 'No files match your search.' : 'This folder is empty. Create a subfolder or upload a file.'}</TableCell></TableRow>}</TableBody></Table></TableContainer>{filteredFiles.length > 0 && <TablePagination component="div" count={filteredFiles.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />}</CardContent></Card>
    <Dialog open={newYearOpen} onClose={() => setNewYearOpen(false)} maxWidth="sm" fullWidth><DialogTitle fontWeight={800}>Create folder</DialogTitle><DialogContent dividers><TextField fullWidth autoFocus label="Folder name" placeholder="Example: September 2026 or Dealer reports" value={newYear} onChange={(event) => setNewYear(event.target.value)} helperText="The new folder is created inside the folder you are currently viewing." /></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setNewYearOpen(false)}>Cancel</Button><Button variant="contained" onClick={createYear}>Create Folder</Button></DialogActions></Dialog>
    <Dialog open={Boolean(renameFile)} onClose={() => setRenameFile(null)} maxWidth="sm" fullWidth><DialogTitle fontWeight={800}>Rename audit file</DialogTitle><DialogContent dividers><TextField fullWidth autoFocus label="Excel filename" value={newFileName} onChange={(event) => setNewFileName(event.target.value)} helperText="Use an .xlsx or .xls filename." /></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setRenameFile(null)}>Cancel</Button><Button variant="contained" onClick={rename}>Save Name</Button></DialogActions></Dialog>
    <Dialog open={Boolean(deleteFile)} onClose={() => setDeleteFile(null)} maxWidth="xs" fullWidth><DialogTitle fontWeight={800}>Delete audit file?</DialogTitle><DialogContent dividers><Typography>This permanently removes “{deleteFile?.fileName}”.</Typography></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setDeleteFile(null)}>Cancel</Button><Button variant="contained" color="error" onClick={remove}>Delete</Button></DialogActions></Dialog>
  </Container>;
};

export default AuditFileUploads;

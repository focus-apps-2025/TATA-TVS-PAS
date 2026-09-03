import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Add as AddIcon, DeleteOutline as DeleteOutlineIcon, Download as DownloadIcon, EditOutlined as EditOutlinedIcon, UploadFile as UploadFileIcon } from '@mui/icons-material';
import { Alert, Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import api from '../services/api';

type CompletionRecord = { _id?: string; serialNo: string; dealerCode: string; siteName: string; auditType: string; state: string; startingDate: string; endDate: string; lineItem: string; uniqueCount: string };
type CompletionKey = Exclude<keyof CompletionRecord, '_id'>;

const headers = ['S.No.', 'Dealer Code', 'Site Name', 'Audit Type', 'State', 'Starting Date', 'End Date', 'Line Item', 'Unique Count', 'Actions'];
const keys: CompletionKey[] = ['serialNo', 'dealerCode', 'siteName', 'auditType', 'state', 'startingDate', 'endDate', 'lineItem', 'uniqueCount'];
const widths = [80, 130, 260, 115, 90, 140, 140, 120, 140, 112];
const emptyRecord = (): CompletionRecord => ({ serialNo: '', dealerCode: '', siteName: '', auditType: '', state: '', startingDate: '', endDate: '', lineItem: '', uniqueCount: '' });
const monthValue = () => new Date().toISOString().slice(0, 7);
const asString = (value: unknown) => value === null || value === undefined ? '' : String(value).trim();
const aliases: Record<CompletionKey, string[]> = {
  serialNo: ['sno', 'serialno', 'slno'], dealerCode: ['dealercode'], siteName: ['sitename', 'dealername'], auditType: ['audittype'], state: ['state'], startingDate: ['startingdate', 'startdate'], endDate: ['enddate', 'closingdate'], lineItem: ['lineitem', 'lineitems'], uniqueCount: ['uniquecount'],
};
const labelFor = (key: CompletionKey) => headers[keys.indexOf(key)];

const AuditCompletion = () => {
  const [month, setMonth] = useState(monthValue);
  const [records, setRecords] = useState<CompletionRecord[]>([]);
  const [form, setForm] = useState<CompletionRecord>(emptyRecord());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CompletionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const uploadInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.getAuditCompletions(month);
        if (!response.success) throw new Error(response.message || 'Unable to load audit completion records.');
        setRecords(response.data as CompletionRecord[]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load audit completion records.');
      } finally { setLoading(false); }
    };
    void load();
  }, [month]);

  const summary = useMemo(() => {
    const groups = new Map<string, { auditCount: number; uniqueItems: number }>();
    records.forEach((record) => {
      const state = record.state.trim().toUpperCase() || 'UNSPECIFIED';
      const current = groups.get(state) || { auditCount: 0, uniqueItems: 0 };
      current.auditCount += 1;
      current.uniqueItems += Number(String(record.uniqueCount).replace(/,/g, '')) || 0;
      groups.set(state, current);
    });
    return [...groups.entries()].map(([state, values]) => ({ state, ...values }));
  }, [records]);
  const totalUniqueItems = summary.reduce((total, item) => total + item.uniqueItems, 0);
  const paginatedRecords = records.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const chartColors = ['#A9C9F5', '#9FE3D4', '#FFD39A', '#D7C7F4', '#F6B8C8', '#BFE7EC'];
  const pieBackground = useMemo(() => {
    let start = 0;
    const total = summary.reduce((sum, item) => sum + item.auditCount, 0);
    if (!total) return '#E5EEF5';
    return `conic-gradient(${summary.map((item, index) => { const end = start + (item.auditCount / total) * 100; const value = `${chartColors[index % chartColors.length]} ${start}% ${end}%`; start = end; return value; }).join(', ')})`;
  }, [summary]);

  const handleAdd = () => { setEditingRecordId(null); setForm({ ...emptyRecord(), serialNo: String(records.length + 1) }); setDialogOpen(true); };
  const handleEdit = (record: CompletionRecord) => { setEditingRecordId(record._id || null); setForm({ ...emptyRecord(), ...record }); setDialogOpen(true); };
  const handleSave = async () => {
    try {
      const response = editingRecordId
        ? await api.updateAuditCompletion(editingRecordId, form)
        : await api.createAuditCompletion({ ...form, month });
      if (!response.success) throw new Error(response.message || 'Unable to save audit completion.');
      const savedRecord = response.data as CompletionRecord;
      setRecords((current) => editingRecordId ? current.map((record) => record._id === editingRecordId ? savedRecord : record) : [...current, savedRecord]);
      setDialogOpen(false);
      setEditingRecordId(null);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save audit completion.'); }
  };
  const handleDelete = async () => {
    if (!recordToDelete?._id) return;
    try {
      const response = await api.deleteAuditCompletion(recordToDelete._id);
      if (!response.success) throw new Error(response.message || 'Unable to delete audit completion.');
      setRecords((current) => current.filter((record) => record._id !== recordToDelete._id));
      setRecordToDelete(null);
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete audit completion.'); }
  };
  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const sourceHeaders = rows[0]?.map((value) => asString(value).toLowerCase().replace(/[^a-z0-9]/g, '')) || [];
      const indexes = Object.fromEntries(keys.map((key, fallback) => [key, Math.max(0, sourceHeaders.findIndex((header) => aliases[key].includes(header))) || fallback])) as Record<CompletionKey, number>;
      const uploaded = rows.slice(1).map((row) => Object.fromEntries(keys.map((key) => [key, asString(row[indexes[key]])])) as CompletionRecord).filter((record) => Object.values(record).some(Boolean));
      if (!uploaded.length) throw new Error('No audit completion records were found in the uploaded file.');
      const response = await api.replaceAuditCompletions(month, uploaded);
      if (!response.success) throw new Error(response.message || 'Unable to save uploaded completion records.');
      setRecords(response.data as CompletionRecord[]);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : 'Unable to import the Excel file.'); }
  };
  const handleDownload = () => {
    const workbook = XLSX.utils.book_new();
    const detail = XLSX.utils.aoa_to_sheet([headers, ...records.map((record) => keys.map((key) => record[key]))]);
    detail['!cols'] = widths.map((width) => ({ wch: Math.ceil(width / 8) }));
    const summarySheet = XLSX.utils.aoa_to_sheet([['S.No.', 'State', 'No. of Audits', 'Total No. of Unique Items'], ...summary.map((item, index) => [index + 1, item.state, item.auditCount, item.uniqueItems]), ['', 'Total', records.length, totalUniqueItems]]);
    summarySheet['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(workbook, detail, 'Audit Completion'); XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    XLSX.writeFile(workbook, `Audit_Completion_${month}.xlsx`);
  };

  return <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 }, pb: 8 }}>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} spacing={2.5} sx={{ mb: 3 }}><Box><Typography variant="h4" fontWeight={850} color="#123B45">Audit Completion</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Manage completed audits month by month.</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} width={{ xs: '100%', lg: 'auto' }}><TextField label="Completion month" type="month" value={month} onChange={(event) => { setMonth(event.target.value || monthValue()); setPage(0); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 180 }} /><Button variant="outlined" startIcon={<DownloadIcon />} disabled={!records.length} onClick={handleDownload}>Download Excel</Button><Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={loading}>Upload Excel<input ref={uploadInput} hidden type="file" accept=".xlsx,.xls" onChange={handleUpload} /></Button><Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>Add Completion</Button></Stack></Stack>
    {error && <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError('')}>{error}</Alert>}
    <Grid container spacing={2.5} sx={{ mb: 3 }}><Grid size={{ xs: 12, lg: 7 }}><Card variant="outlined" sx={{ height: '100%' }}><CardContent><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Monthly overview</Typography><Typography variant="h3" fontWeight={850} color="#0054A6">{records.length}</Typography><Typography variant="body2" color="text.secondary">Completed audits in {month}</Typography></Box><Chip label={`${totalUniqueItems.toLocaleString()} unique items`} color="primary" variant="outlined" /></Stack><Divider sx={{ my: 2 }} /><Table size="small"><TableHead><TableRow>{['S.No.', 'State', 'No. of Audits', 'Total No. of Unique Items'].map((header) => <TableCell key={header} sx={{ bgcolor: '#E7F0FB', color: '#0054A6', fontWeight: 800 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{summary.length ? summary.map((item, index) => <TableRow key={item.state}><TableCell>{index + 1}</TableCell><TableCell>{item.state}</TableCell><TableCell>{item.auditCount}</TableCell><TableCell>{item.uniqueItems.toLocaleString()}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No records for this month.</TableCell></TableRow>}<TableRow sx={{ bgcolor: '#DCEAF7' }}><TableCell /><TableCell sx={{ fontWeight: 800, color: '#004F98' }}>Total</TableCell><TableCell sx={{ fontWeight: 800, color: '#004F98' }}>{records.length}</TableCell><TableCell sx={{ fontWeight: 800, color: '#004F98' }}>{totalUniqueItems.toLocaleString()}</TableCell></TableRow></TableBody></Table></CardContent></Card></Grid><Grid size={{ xs: 12, lg: 5 }}><Card variant="outlined" sx={{ height: '100%' }}><CardContent><Typography fontWeight={800}>Completed Audits by State</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Distribution for the selected month</Typography>{summary.length ? <Stack direction="row" spacing={3} alignItems="center"><Box sx={{ width: 150, height: 150, flexShrink: 0, borderRadius: '50%', background: pieBackground }} /><Stack spacing={1} sx={{ flex: 1 }}>{summary.map((item, index) => <Stack key={item.state} direction="row" justifyContent="space-between" spacing={1}><Stack direction="row" spacing={0.8} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: chartColors[index % chartColors.length] }} /><Typography variant="body2" fontWeight={700}>{item.state}</Typography></Stack><Typography variant="body2" color="text.secondary">{item.auditCount} · {((item.auditCount / records.length) * 100).toFixed(1)}%</Typography></Stack>)}</Stack></Stack> : <Typography variant="body2" color="text.secondary">Add or upload records to see the chart.</Typography>}</CardContent></Card></Grid></Grid>
    <Card variant="outlined"><CardContent sx={{ p: 0 }}><Box sx={{ px: 2.5, py: 2 }}><Typography variant="h6" fontWeight={800}>Completion Records</Typography><Typography variant="body2" color="text.secondary">Showing entries for {month}.</Typography></Box><Divider /><TableContainer sx={{ maxHeight: 560, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}><Table stickyHeader size="small" sx={{ minWidth: widths.reduce((sum, width) => sum + width, 0), tableLayout: 'fixed' }}><TableHead><TableRow>{headers.map((header, index) => <TableCell key={header} align={header === 'Actions' ? 'center' : 'left'} sx={{ width: widths[index], minWidth: widths[index], bgcolor: '#E7F0FB', color: '#0054A6', fontWeight: 800, whiteSpace: 'nowrap', py: 1.5 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{records.length ? paginatedRecords.map((record, index) => <TableRow key={record._id || index} hover>{keys.map((key, keyIndex) => <TableCell key={key} sx={{ width: widths[keyIndex], minWidth: widths[keyIndex], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record[key]}>{record[key]}</TableCell>)}<TableCell align="center" sx={{ width: widths[9], minWidth: widths[9] }}><Tooltip title="Edit completion"><IconButton size="small" color="primary" onClick={() => handleEdit(record)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Delete completion"><IconButton size="small" color="error" onClick={() => setRecordToDelete(record)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>) : <TableRow><TableCell colSpan={headers.length} align="center" sx={{ py: 7, color: 'text.secondary' }}>{loading ? 'Loading completion records...' : 'No completion records for this month.'}</TableCell></TableRow>}</TableBody></Table></TableContainer><TablePagination component="div" count={records.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} /></CardContent></Card>
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle fontWeight={800}>{editingRecordId ? 'Edit Audit Completion' : 'Add Audit Completion'}</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>This record will be saved to {month}.</Typography><Grid container spacing={2}>{keys.map((key) => <Grid key={key} size={{ xs: 12, sm: key === 'siteName' ? 12 : 6 }}><TextField fullWidth label={labelFor(key)} value={form[key]} type={key === 'startingDate' || key === 'endDate' ? 'date' : 'text'} InputLabelProps={key === 'startingDate' || key === 'endDate' ? { shrink: true } : undefined} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></Grid>)}</Grid></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => { setDialogOpen(false); setEditingRecordId(null); }}>Cancel</Button><Button variant="contained" onClick={handleSave}>{editingRecordId ? 'Save Changes' : 'Save Completion'}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(recordToDelete)} onClose={() => setRecordToDelete(null)} fullWidth maxWidth="xs"><DialogTitle fontWeight={800}>Delete completion?</DialogTitle><DialogContent dividers><Typography>This will permanently remove the selected audit completion record.</Typography></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setRecordToDelete(null)}>Cancel</Button><Button variant="contained" color="error" onClick={handleDelete}>Delete</Button></DialogActions></Dialog>
  </Container>;
};

export default AuditCompletion;

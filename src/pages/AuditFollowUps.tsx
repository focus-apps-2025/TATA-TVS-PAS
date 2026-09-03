import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Add as AddIcon,
  Assessment as AssessmentIcon,
  DeleteOutline as DeleteOutlineIcon,
  Download as DownloadIcon,
  EditOutlined as EditOutlinedIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import {
  Alert, Box, Button, Card, CardContent, Chip, Container, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, IconButton, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import api from '../services/api';

type FollowUpRecord = {
  _id?: string;
  serialNo: string;
  quoteDate: string;
  dealerCode: string;
  siteName: string;
  auditType: string;
  place: string;
  state: string;
  lineItem: string;
  uniqueCount: string;
  contactPersonName: string;
  contactNumber: string;
  remarks: string;
};
type FollowUpInputKey = Exclude<keyof FollowUpRecord, '_id'>;

const headers = [
  'S.No.', 'Quote Date', 'Dealer Code', 'Site Name', 'Audit Type', 'Place', 'State',
  'Line Item', 'Unique Count', 'Contact Person', 'Contact No.', 'Remarks', 'Actions',
];
const columnWidths = [76, 126, 116, 236, 104, 176, 82, 108, 118, 190, 142, 280, 112];
const emptyRecord = (): FollowUpRecord => ({
  serialNo: '', quoteDate: '', dealerCode: '', siteName: '', auditType: '', place: '',
  state: '', lineItem: '', uniqueCount: '', contactPersonName: '', contactNumber: '', remarks: '',
});

const normalizeHeader = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const stringValue = (value: unknown) => value === null || value === undefined ? '' : String(value).trim();
const quoteMonth = (value: string) => {
  const iso = value.match(/^(\d{4})[-/]?(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const dayFirst = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}` : '';
};

const headerAliases: Record<FollowUpInputKey, string[]> = {
  serialNo: ['sno', 'serialno', 'slno'],
  quoteDate: ['quotedate'],
  dealerCode: ['dealercode'],
  siteName: ['sitename', 'dealername'],
  auditType: ['audittype'],
  place: ['place', 'location'],
  state: ['state'],
  lineItem: ['lineitem', 'lineitems'],
  uniqueCount: ['uniquecount'],
  contactPersonName: ['contactpersonname', 'contactperson'],
  contactNumber: ['contactnumber', 'contactno', 'contactmobile'],
  remarks: ['remarks', 'remark'],
};

const fieldDefinitions: Array<{ key: FollowUpInputKey; label: string; type?: string; inputMode?: 'numeric' | 'text' }> = [
  { key: 'serialNo', label: 'S.No.', inputMode: 'numeric' },
  { key: 'quoteDate', label: 'Quote Date', type: 'date' },
  { key: 'dealerCode', label: 'Dealer Code', inputMode: 'numeric' },
  { key: 'siteName', label: 'Site Name' },
  { key: 'auditType', label: 'Audit Type' },
  { key: 'place', label: 'Place' },
  { key: 'state', label: 'State' },
  { key: 'lineItem', label: 'Line Item', inputMode: 'numeric' },
  { key: 'uniqueCount', label: 'Unique Count', inputMode: 'numeric' },
  { key: 'contactPersonName', label: 'Contact Person' },
  { key: 'contactNumber', label: 'Contact No.', inputMode: 'numeric' },
  { key: 'remarks', label: 'Remarks' },
];

const AuditFollowUps = () => {
  const [records, setRecords] = useState<FollowUpRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<FollowUpRecord | null>(null);
  const [form, setForm] = useState<FollowUpRecord>(emptyRecord());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedMonth, setSelectedMonth] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadFollowUps = async () => {
      try {
        const response = await api.getAuditFollowUps();
        if (!response.success) throw new Error(response.message || 'Unable to load audit follow-ups.');
        setRecords(response.data as FollowUpRecord[]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load audit follow-ups.');
      } finally {
        setLoading(false);
      }
    };
    void loadFollowUps();
  }, []);

  const visibleRecords = useMemo(() => selectedMonth ? records.filter((record) => quoteMonth(record.quoteDate) === selectedMonth) : records, [records, selectedMonth]);
  const auditTypeSeries = useMemo(() => {
    const summary = new Map<string, number>();
    visibleRecords.forEach((record) => {
      const auditType = record.auditType.trim().toUpperCase() || 'UNSPECIFIED';
      summary.set(auditType, (summary.get(auditType) || 0) + 1);
    });
    return [...summary.entries()].map(([label, value]) => ({ label, value }));
  }, [visibleRecords]);
  const totalAuditTypeRecords = auditTypeSeries.reduce((sum, item) => sum + item.value, 0);
  const chartColors: Record<string, string> = { '2W': '#A9C9F5', '3W': '#9FE3D4', BAJAJ: '#FFD39A' };
  const chartSeries = useMemo(() => {
    let start = 0;
    return auditTypeSeries.map((item, index) => {
      const percentage = totalAuditTypeRecords ? (item.value / totalAuditTypeRecords) * 100 : 0;
      const end = start + percentage;
      const segment = { ...item, percentage, start, end, color: chartColors[item.label] || ['#D7C7F4', '#F6B8C8', '#BFE7EC'][index % 3] };
      start = end;
      return segment;
    });
  }, [auditTypeSeries, totalAuditTypeRecords]);
  const pieBackground = chartSeries.length ? `conic-gradient(${chartSeries.map((item) => `${item.color} ${item.start}% ${item.end}%`).join(', ')})` : '#E5EEF5';
  const paginatedRecords = visibleRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleOpenAdd = () => {
    setError('');
    setEditingRecordId(null);
    setForm({ ...emptyRecord(), serialNo: String(visibleRecords.length + 1), quoteDate: selectedMonth ? `${selectedMonth}-01` : '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (record: FollowUpRecord) => {
    setError('');
    setEditingRecordId(record._id || null);
    setForm({ ...emptyRecord(), ...record });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const response = editingRecordId
        ? await api.updateAuditFollowUp(editingRecordId, form)
        : await api.createAuditFollowUp(form);
      if (!response.success) throw new Error(response.message || 'Unable to save the audit follow-up.');
      const savedRecord = response.data as FollowUpRecord;
      setRecords((current) => editingRecordId
        ? current.map((record) => record._id === editingRecordId ? savedRecord : record)
        : [...current, savedRecord]);
      setDialogOpen(false);
      setEditingRecordId(null);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the audit follow-up.');
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete?._id) return;
    try {
      const response = await api.deleteAuditFollowUp(recordToDelete._id);
      if (!response.success) throw new Error(response.message || 'Unable to delete the audit follow-up.');
      setRecords((current) => current.filter((record) => record._id !== recordToDelete._id));
      setRecordToDelete(null);
      setError('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the audit follow-up.');
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('The workbook does not contain a worksheet.');
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const sourceHeaders = rows[0]?.map(normalizeHeader) || [];
      const indexes = Object.fromEntries(Object.entries(headerAliases).map(([key, aliases], fallbackIndex) => [
        key,
        sourceHeaders.findIndex((header) => aliases.includes(header)) >= 0
          ? sourceHeaders.findIndex((header) => aliases.includes(header))
          : fallbackIndex,
      ])) as Record<FollowUpInputKey, number>;
      const uploadedRecords = rows.slice(1).map((row) => {
        const record = Object.fromEntries(Object.keys(headerAliases).map((key) => [
          key,
          stringValue(row[indexes[key as FollowUpInputKey]]),
        ])) as FollowUpRecord;
        return record;
      }).filter((record) => Object.values(record).some(Boolean));
      if (!uploadedRecords.length) throw new Error('No follow-up records were found in the uploaded file.');
      const response = await api.replaceAuditFollowUps(uploadedRecords);
      if (!response.success) throw new Error(response.message || 'Unable to save the uploaded follow-up records.');
      setRecords(response.data as FollowUpRecord[]);
      setError('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to import the Excel file.');
    }
  };

  const handleDownload = () => {
    const workbook = XLSX.utils.book_new();
    const data = visibleRecords.map((record) => [
      record.serialNo, record.quoteDate, record.dealerCode, record.siteName, record.auditType,
      record.place, record.state, record.lineItem, record.uniqueCount, record.contactPersonName,
      record.contactNumber, record.remarks,
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet['!cols'] = [8, 14, 14, 34, 14, 24, 10, 12, 14, 26, 18, 30].map((width) => ({ wch: width }));
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Follow-ups');
    XLSX.writeFile(workbook, 'Audit_Follow_Ups.xlsx');
  };

  return <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 }, pb: 8 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2.5} sx={{ mb: 3 }}>
      <Box>
        <Typography variant="h4" fontWeight={850} color="#123B45">Audit Follow-ups</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>Track quotation progress, dealer contacts, and pending audit follow-up actions.</Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} width={{ xs: '100%', md: 'auto' }}>
        <TextField label="Quote month" type="month" value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); setPage(0); }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 165 }} />
        <Button variant="outlined" onClick={() => { setSelectedMonth(''); setPage(0); }} disabled={!selectedMonth}>All months</Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownload} disabled={!visibleRecords.length}>Download Excel</Button>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={loading}>Upload Excel<input ref={inputRef} hidden type="file" accept=".xlsx,.xls" onChange={handleUpload} /></Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAdd} disabled={loading} sx={{ bgcolor: '#0F766E', '&:hover': { bgcolor: '#115E59' } }}>Add Follow-up</Button>
      </Stack>
    </Stack>

    {error && <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError('')}>{error}</Alert>}

    <Card variant="outlined" sx={{ mb: 3, overflow: 'hidden', borderColor: '#DCE4EC', boxShadow: '0 3px 12px rgba(15, 23, 42, 0.04)' }}>
      <CardContent sx={{ p: { xs: 2.25, md: 2.5 }, '&:last-child': { pb: { xs: 2.25, md: 2.5 } } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2.25, md: 3 }} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box sx={{ minWidth: { md: 190 }, px: { md: 1 }, py: 0.5 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing={0.7}>Follow-up overview</Typography>
            <Stack direction="row" spacing={1.25} alignItems="baseline"><Typography variant="h3" fontWeight={850} color="#0054A6" lineHeight={1}>{visibleRecords.length}</Typography><Typography color="text.secondary" fontWeight={600}>{selectedMonth ? 'records this month' : 'total records'}</Typography></Stack>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: chartSeries.length ? 1.25 : 0 }}><Box sx={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 1.5, bgcolor: '#E7F0FB', color: '#0054A6' }}><AssessmentIcon fontSize="small" /></Box><Box><Typography fontWeight={800}>Audit type distribution</Typography><Typography variant="caption" color="text.secondary">Count and percentage by audit type</Typography></Box></Stack>
            {chartSeries.length ? <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 3 }} alignItems="center"><Box sx={{ width: 126, height: 126, flexShrink: 0, borderRadius: '50%', background: pieBackground, boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.08)' }} /><Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={1.25} sx={{ width: '100%' }}>{chartSeries.map((item) => <Box key={item.label} sx={{ minWidth: 136, px: 1.25, py: 0.9, border: '1px solid #E3E8EE', borderRadius: 1.5, bgcolor: '#FAFCFE' }}><Stack direction="row" spacing={0.8} alignItems="center"><Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: item.color }} /><Typography variant="body2" fontWeight={800}>{item.label}</Typography></Stack><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>{item.value} records · {item.percentage.toFixed(1)}%</Typography></Box>)}</Stack></Stack> : <Typography variant="body2" color="text.secondary">Upload an Excel file or add a record to view the audit-type distribution.</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>

    <Card variant="outlined"><CardContent sx={{ p: 0 }}><Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><Box><Typography variant="h6" fontWeight={800}>Follow-up Records</Typography><Typography variant="body2" color="text.secondary">{selectedMonth ? `Showing quote-date entries for ${selectedMonth}.` : 'The table follows the supplied Excel format.'}</Typography></Box><Chip label={`${visibleRecords.length} records`} color="primary" variant="outlined" /></Box><Divider /><TableContainer sx={{ maxHeight: 560, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', '&::-webkit-scrollbar': { display: 'none' } }}><Table stickyHeader size="small" sx={{ minWidth: columnWidths.reduce((total, width) => total + width, 0), tableLayout: 'fixed' }}><TableHead><TableRow>{headers.map((header, index) => <TableCell key={header} align={header === 'Actions' ? 'center' : 'left'} sx={{ width: columnWidths[index], minWidth: columnWidths[index], bgcolor: '#F1F4F7', color: '#0054A6', fontStyle: 'italic', fontWeight: 700, fontSize: '0.95rem', textTransform: 'none', whiteSpace: 'nowrap', borderBottom: '1px solid #D5DCE5', px: 1.75, py: 1.75 }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{visibleRecords.length ? paginatedRecords.map((record, index) => <TableRow key={record._id || `${record.serialNo}-${record.dealerCode}-${index}`} hover>{[record.serialNo, record.quoteDate, record.dealerCode, record.siteName, record.auditType, record.place, record.state, record.lineItem, record.uniqueCount, record.contactPersonName, record.contactNumber, record.remarks].map((value, valueIndex) => <TableCell key={`${index}-${headers[valueIndex]}`} sx={{ width: columnWidths[valueIndex], minWidth: columnWidths[valueIndex], whiteSpace: 'nowrap', px: 1.75, py: 1.45, overflow: 'hidden', textOverflow: 'ellipsis' }} title={value}>{value}</TableCell>)}<TableCell align="center" sx={{ width: columnWidths[12], minWidth: columnWidths[12], whiteSpace: 'nowrap', px: 0.75 }}><Tooltip title="Edit follow-up"><IconButton size="small" color="primary" onClick={() => handleOpenEdit(record)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Tooltip title="Delete follow-up"><IconButton size="small" color="error" onClick={() => setRecordToDelete(record)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip></TableCell></TableRow>) : <TableRow><TableCell colSpan={headers.length} align="center" sx={{ py: 7, color: 'text.secondary' }}>{loading ? 'Loading follow-up records...' : 'No follow-up records for this month.'}</TableCell></TableRow>}</TableBody></Table></TableContainer><TablePagination component="div" count={visibleRecords.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} /></CardContent></Card>

    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md"><DialogTitle fontWeight={800}>{editingRecordId ? 'Edit Audit Follow-up' : 'Add Audit Follow-up'}</DialogTitle><DialogContent dividers><Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Add the information currently available; you can leave fields blank when a detail is not known.</Typography><Grid container spacing={2}>{fieldDefinitions.map(({ key, label, type, inputMode }) => <Grid key={key} size={{ xs: 12, sm: key === 'siteName' || key === 'remarks' || key === 'contactPersonName' ? 12 : 6 }}><TextField fullWidth label={label} type={type || 'text'} inputProps={{ inputMode }} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} InputLabelProps={type === 'date' ? { shrink: true } : undefined} multiline={key === 'remarks'} minRows={key === 'remarks' ? 2 : undefined} /></Grid>)}</Grid></DialogContent><DialogActions sx={{ p: 2 }}><Button onClick={() => { setDialogOpen(false); setEditingRecordId(null); }} color="inherit">Cancel</Button><Button variant="contained" onClick={handleSave}>{editingRecordId ? 'Save Changes' : 'Save Follow-up'}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(recordToDelete)} onClose={() => setRecordToDelete(null)} maxWidth="xs" fullWidth><DialogTitle fontWeight={800}>Delete follow-up?</DialogTitle><DialogContent dividers><Typography>This will permanently remove the selected follow-up record.</Typography></DialogContent><DialogActions sx={{ p: 2 }}><Button color="inherit" onClick={() => setRecordToDelete(null)}>Cancel</Button><Button variant="contained" color="error" onClick={handleDelete}>Delete</Button></DialogActions></Dialog>
  </Container>;
};

export default AuditFollowUps;

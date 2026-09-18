import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Container, Divider, Grid, MenuItem, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography
} from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import api, { type AccountantCalculationInput } from '../services/api';

type FormValues = {
  auditDate: string;
  auditEndDate: string;
  auditType: string;
  subCategory: string;
  location: string;
  dealerName: string;
  uniqueCount: string;
  travel: string;
  food: string;
  stay: string;
  other: string;
  teamSalary: string;
  additionalCharges: string;
  auditStatus: string;
};

const auditTypes = [
  { value: 'TATA', label: 'TATA', subCategories: ['TATA Commercial', 'TATA Accessories'] },
  { value: 'TVS', label: 'TVS', subCategories: ['2W', '3W'] },
  { value: 'JCB', label: 'JCB', subCategories: [] },
  { value: 'JBM', label: 'JBM', subCategories: [] },
  { value: 'Audi', label: 'Audi', subCategories: [] },
  { value: 'BMW', label: 'BMW', subCategories: [] },
  { value: 'Mahindra Tractor', label: 'Mahindra Tractor', subCategories: [] },
];

const locations = [
  { label: 'Tamil Nadu', rate: 13 }, { label: 'Kerala', rate: 13 },
  { label: 'Andhra Pradesh', rate: 13 }, { label: 'Telangana', rate: 13 },
  { label: 'Karnataka', rate: 13 }, { label: 'Delhi', rate: 13 },
  { label: 'Gurgaon', rate: 13 }, { label: 'Noida', rate: 13 },
  { label: 'Faridabad', rate: 13 }, { label: 'Ghaziabad', rate: 13 },
  { label: 'Uttar Pradesh', rate: 16 }, { label: 'Madhya Pradesh', rate: 16 },
  { label: 'Uttarakhand', rate: 16 }, { label: 'Haryana', rate: 16 },
  { label: 'Himachal Pradesh', rate: 16 }, { label: 'Rajasthan', rate: 16 },
  { label: 'Punjab', rate: 16 }, { label: 'Jammu & Kashmir', rate: 16 },
  { label: 'Maharashtra', rate: 16 }, { label: 'Gujarat', rate: 16 },
  { label: 'Chhattisgarh', rate: 16 }, { label: 'West Bengal', rate: 18 },
  { label: 'Bihar', rate: 18 }, { label: 'Jharkhand', rate: 18 },
  { label: 'Odisha', rate: 18 }, { label: 'North East', rate: 18 },
];

const initialValues: FormValues = {
  auditDate: new Date().toISOString().slice(0, 10), auditEndDate: new Date().toISOString().slice(0, 10), auditType: '', subCategory: '', location: '', dealerName: '', uniqueCount: '',
  travel: '', food: '', stay: '', other: '', teamSalary: '', additionalCharges: '', auditStatus: 'In Progress',
};

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const numberValue = (value: string) => Math.max(0, Number(value) || 0);

export default function AccountantPage() {
  const [form, setForm] = useState<FormValues>(initialValues);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportAuditType, setExportAuditType] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'complete' | 'type' | null>(null);
  const [message, setMessage] = useState('');
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [viewPage, setViewPage] = useState(0);
  const [viewTotal, setViewTotal] = useState(0);
  const [viewSearch, setViewSearch] = useState('');
  const [viewAuditType, setViewAuditType] = useState('');
  const [viewAuditStatus, setViewAuditStatus] = useState('');
  const [viewFromDate, setViewFromDate] = useState('');
  const [viewToDate, setViewToDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const selectedType = auditTypes.find((type) => type.value === form.auditType);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const loadSavedCount = async () => {
    try {
      const result = await api.getAccountantCalculations({ limit: 1 });
      setSavedCount(result.pagination.total);
    } catch {
      setSavedCount(null);
    }
  };

  useEffect(() => { loadSavedCount(); }, []);

  const loadSavedRecords = async () => {
    try {
      const result = await api.getAccountantCalculations({
        page: viewPage + 1, limit: 10, search: viewSearch || undefined,
        auditType: viewAuditType || undefined, auditStatus: viewAuditStatus || undefined,
        from: viewFromDate || undefined, to: viewToDate || undefined,
      });
      setSavedRecords(result.records);
      setViewTotal(result.pagination.total);
    } catch {
      setSavedRecords([]);
      setViewTotal(0);
    }
  };

  useEffect(() => { loadSavedRecords(); }, [viewPage, viewSearch, viewAuditType, viewAuditStatus, viewFromDate, viewToDate]);
  const locationRate = locations.find((location) => location.label === form.location)?.rate || 0;
  const isTataAccessories = form.auditType === 'TATA' && form.subCategory === 'TATA Accessories';
  const lineCount = numberValue(form.uniqueCount);
  const accessoryAmount = !lineCount ? 0 : lineCount <= 400 ? 10500 : lineCount <= 700 ? 13750 : lineCount <= 1100 ? 17500 : 21250;
  const auditRate = isTataAccessories ? accessoryAmount : locationRate;
  const rateMessage = isTataAccessories
    ? (lineCount ? `TATA Accessories: ${lineCount.toLocaleString('en-IN')} lines → ${currency.format(accessoryAmount)} + GST` : 'Enter line count to apply the TATA Accessories slab.')
    : locationRate
    ? `${form.location} stock audit rate: ₹${locationRate} per unique count`
    : 'Select a location to set the stock audit rate.';

  const calculation = useMemo(() => {
    const taxableAmount = isTataAccessories ? (lineCount ? accessoryAmount : 0) : numberValue(form.uniqueCount) * auditRate;
    const gst = taxableAmount * 0.18;
    const totalInvoice = taxableAmount + gst + numberValue(form.additionalCharges);
    const siteExpenses = numberValue(form.travel) + numberValue(form.food) + numberValue(form.stay) + numberValue(form.other);
    const totalExpenses = siteExpenses + numberValue(form.teamSalary);
    const profitLoss = taxableAmount + numberValue(form.additionalCharges) - totalExpenses;
    const profitLossBase = taxableAmount + numberValue(form.additionalCharges);
    return { taxableAmount, gst, totalInvoice, siteExpenses, totalExpenses, profitLoss, margin: profitLossBase ? (profitLoss / profitLossBase) * 100 : 0 };
  }, [form, auditRate]);

  const update = (field: keyof FormValues, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value, ...(field === 'auditType' ? { subCategory: '' } : {}) }));
  };

  const saveCalculation = async () => {
    if (!form.auditDate || !form.auditEndDate || !form.auditType || !form.uniqueCount || !auditRate || (!isTataAccessories && !form.location)) {
      setMessage('Enter the audit dates, type, count, and location for non-accessories audits before saving.');
      return;
    }
    if (form.auditEndDate < form.auditDate) { setMessage('Audit end date cannot be before the start date.'); return; }
    setSaving(true);
    setMessage('');
    try {
      const payload: AccountantCalculationInput = {
        auditDate: form.auditDate, auditEndDate: form.auditEndDate, auditType: form.auditType, subCategory: form.subCategory,
        dealerName: form.dealerName, location: form.location || 'Not applicable', rate: auditRate,
        uniqueCount: numberValue(form.uniqueCount), travel: numberValue(form.travel), food: numberValue(form.food),
        stay: numberValue(form.stay), other: numberValue(form.other), teamSalary: numberValue(form.teamSalary), additionalCharges: numberValue(form.additionalCharges), auditStatus: form.auditStatus,
      };
      const result = editingId ? await api.updateAccountantCalculation(editingId, payload) : await api.saveAccountantCalculation(payload);
      setMessage(result.success ? `Calculation ${editingId ? 'updated' : 'saved'} successfully.` : result.message || 'Unable to save calculation.');
      if (result.success) { setEditingId(null); await loadSavedCount(); await loadSavedRecords(); }
    } catch {
      setMessage('Unable to save calculation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const exportCalculations = async (kind: 'complete' | 'type') => {
    if (fromDate && toDate && fromDate > toDate) {
      setMessage('The From date must be before the To date.');
      return;
    }
    const auditType = kind === 'type' ? exportAuditType : '';
    if (kind === 'type' && !auditType) return;
    setExporting(kind);
    try {
      const exportResult = await api.exportAccountantCalculations({ from: fromDate || undefined, to: toDate || undefined, auditType: auditType || undefined });
      if (exportResult.count === 0) {
        setMessage('No saved calculations match the selected export filters.');
        return;
      }
      const url = URL.createObjectURL(exportResult.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${auditType ? `${auditType.toLowerCase()}-` : 'complete-'}audit-calculations.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Excel export downloaded.');
    } catch {
      setMessage('Unable to export calculations.');
    } finally {
      setExporting(null);
    }
  };

  const moneyFields: { key: keyof FormValues; label: string }[] = [
    { key: 'travel', label: 'Travel' }, { key: 'food', label: 'Food' },
    { key: 'stay', label: 'Stay' }, { key: 'other', label: 'Other' },
    { key: 'teamSalary', label: 'Team Salary' }, { key: 'additionalCharges', label: 'Additional Charges' },
  ];

  const editCalculation = (record: any) => {
    const dateValue = (value: string) => value ? new Date(value).toISOString().slice(0, 10) : '';
    setForm({ auditDate: dateValue(record.auditDate), auditEndDate: dateValue(record.auditEndDate), auditType: record.auditType || '', subCategory: record.subCategory || '', location: record.location === 'Not applicable' ? '' : record.location || '', dealerName: record.dealerName || '', uniqueCount: String(record.uniqueCount ?? ''), travel: String(record.travel ?? ''), food: String(record.food ?? ''), stay: String(record.stay ?? ''), other: String(record.other ?? ''), teamSalary: String(record.teamSalary ?? ''), additionalCharges: String(record.additionalCharges ?? ''), auditStatus: record.auditStatus || 'In Progress' });
    setEditingId(record._id || record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCalculation = async (record: any) => {
    if (!window.confirm(`Delete the calculation for ${record.dealerName || record.auditType}?`)) return;
    const result = await api.deleteAccountantCalculation(record._id || record.id);
    setMessage(result.success ? 'Calculation deleted.' : result.message || 'Unable to delete calculation.');
    if (result.success) { await loadSavedCount(); await loadSavedRecords(); }
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="primary">Audit Amount Calculator</Typography>
          <Typography variant="body2" color="text.secondary">Save audit costs and export calculations.</Typography>
        </Box>
        <Button size="small" startIcon={<RestartAltIcon />} onClick={() => { setForm(initialValues); setEditingId(null); }} variant="outlined">Clear</Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 1.5, py: 0, '& .MuiAlert-message': { py: 0.75, fontSize: '0.82rem' } }}>Location rate applies to all audits except TATA Accessories, which uses the fixed line-count slabs. GST is separate.</Alert>
      {message && <Alert severity={message.includes('successfully') || message.includes('downloaded') ? 'success' : 'warning'} sx={{ mb: 1.5, py: 0 }} onClose={() => setMessage('')}>{message}</Alert>}

      <Paper sx={{ p: { xs: 1.75, sm: 2 }, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="subtitle1" fontWeight={700}>Export saved calculations</Typography><Typography variant="caption" color={savedCount === null ? 'text.secondary' : savedCount ? 'success.main' : 'warning.main'}>{savedCount === null ? 'Checking saved records…' : `${savedCount} saved record${savedCount === 1 ? '' : 's'}`}</Typography></Stack>
        <Grid container spacing={1.25} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField size="small" fullWidth label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField size="small" fullWidth label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField size="small" select fullWidth label="Audit Type" value={exportAuditType} onChange={(e) => setExportAuditType(e.target.value)}><MenuItem value="">Select audit type</MenuItem>{auditTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}><Button size="small" fullWidth variant="outlined" startIcon={<DownloadIcon />} disabled={exporting !== null} onClick={() => exportCalculations('complete')}>{exporting === 'complete' ? 'Exporting...' : 'Complete Export'}</Button></Grid>
          <Grid size={{ xs: 12, md: 2.5 }}><Button size="small" fullWidth variant="contained" startIcon={<DownloadIcon />} disabled={!exportAuditType || exporting !== null} onClick={() => exportCalculations('type')}>{exporting === 'type' ? 'Exporting...' : 'Type Export'}</Button></Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: { xs: 1.75, sm: 2 }, border: '1px solid #E2E8F0' }}>
            <Typography variant="overline" color="primary" fontWeight={800}>Step 1</Typography>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Audit details</Typography>
            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" fullWidth label="Start Date" type="date" value={form.auditDate} onChange={(e) => update('auditDate', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" fullWidth label="End Date" type="date" value={form.auditEndDate} inputProps={{ min: form.auditDate }} onChange={(e) => update('auditEndDate', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" select fullWidth label="Audit Type" value={form.auditType} onChange={(e) => update('auditType', e.target.value)}><MenuItem value="">Select type</MenuItem>{auditTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" select fullWidth label="Sub Category" value={form.subCategory} disabled={!selectedType?.subCategories.length} onChange={(e) => update('subCategory', e.target.value)}><MenuItem value="">{selectedType?.subCategories.length ? 'Select sub category' : 'Not applicable'}</MenuItem>{selectedType?.subCategories.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" fullWidth label="Dealer" value={form.dealerName} onChange={(e) => update('dealerName', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" select fullWidth label="Audit Status" value={form.auditStatus} onChange={(e) => update('auditStatus', e.target.value)}>{['In Progress', 'Completed', 'ReAudit', 'On Hold'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" select fullWidth required={!isTataAccessories} label="Location" value={form.location} onChange={(e) => update('location', e.target.value)}><MenuItem value="">Select location</MenuItem>{locations.map((location) => <MenuItem key={location.label} value={location.label}>{location.label} — ₹{location.rate}</MenuItem>)}</TextField></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" fullWidth required label={isTataAccessories ? 'Line Count' : 'Unique Count'} type="number" inputProps={{ min: 0 }} value={form.uniqueCount} onChange={(e) => update('uniqueCount', e.target.value)} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 8 }}><Paper variant="outlined" sx={{ minHeight: 40, px: 1.25, display: 'flex', alignItems: 'center', bgcolor: '#EFF6FF', borderColor: '#BFDBFE' }}><Typography variant="body2" fontWeight={700} color="primary">{rateMessage}</Typography></Paper></Grid>
            </Grid>

            <Divider sx={{ my: 1.75 }} />
            <Typography variant="overline" color="primary" fontWeight={800}>Step 2</Typography>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Expenses</Typography>
            <Grid container spacing={1.25}>{moneyFields.map((field) => <Grid key={field.key} size={{ xs: 12, sm: 6, md: 4 }}><TextField size="small" fullWidth label={field.label} type="number" inputProps={{ min: 0, step: '0.01' }} value={form[field.key]} onChange={(e) => update(field.key, e.target.value)} InputProps={{ startAdornment: <Typography variant="body2" sx={{ mr: 0.5 }}>₹</Typography> }} /></Grid>)}</Grid>
            <Button sx={{ mt: 1.75, px: 3 }} variant="contained" size="small" startIcon={<SaveIcon />} onClick={saveCalculation} disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Calculation' : 'Save Calculation'}</Button>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: { xs: 1.75, sm: 2 }, position: { lg: 'sticky' }, top: 76 }}>
            <Typography variant="overline" color="primary" fontWeight={800}>Live result</Typography><Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}><CalculateIcon color="primary" /><Typography variant="h6" fontWeight={700}>Amount summary</Typography></Stack>
            {[['Taxable Amount', calculation.taxableAmount], ['GST (18%)', calculation.gst], ['Additional Charges', numberValue(form.additionalCharges)], ['Total Invoice', calculation.totalInvoice], ['Site Expenses', calculation.siteExpenses], ['Team Salary', numberValue(form.teamSalary)], ['Total Expenses', calculation.totalExpenses]].map(([label, value]) => <Stack key={String(label)} direction="row" justifyContent="space-between" sx={{ py: 0.5 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={600}>{currency.format(Number(value))}</Typography></Stack>)}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: calculation.profitLoss >= 0 ? '#ECFDF5' : '#FEF2F2' }}>
              <Typography color="text.secondary">P&amp;L</Typography><Typography variant="h4" fontWeight={800} color={calculation.profitLoss >= 0 ? 'success.main' : 'error.main'}>{currency.format(calculation.profitLoss)}</Typography><Typography variant="body2" color="text.secondary">{calculation.margin.toFixed(1)}% margin · {calculation.profitLoss >= 0 ? 'Profit' : 'Loss'}</Typography>
              <Box sx={{ mt: 1, px: 1, py: 0.5, width: 'fit-content', borderRadius: 1, bgcolor: calculation.profitLoss >= 0 ? '#C6EFCE' : '#FFC7CE', color: calculation.profitLoss >= 0 ? '#006100' : '#9C0006', fontWeight: 800, fontSize: '0.78rem' }}>P&amp;L Status: {calculation.profitLoss >= 0 ? 'Profit' : 'Loss'}</Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      <Paper sx={{ mt: 2, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: '1px solid #E2E8F0' }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Saved calculations</Typography>
          <Grid container spacing={1.25}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField size="small" fullWidth label="Search dealer, location, or type" value={viewSearch} onChange={(e) => { setViewSearch(e.target.value); setViewPage(0); }} /></Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}><TextField size="small" select fullWidth label="Audit Type" value={viewAuditType} onChange={(e) => { setViewAuditType(e.target.value); setViewPage(0); }}><MenuItem value="">All types</MenuItem>{auditTypes.map((type) => <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}><TextField size="small" select fullWidth label="Audit Status" value={viewAuditStatus} onChange={(e) => { setViewAuditStatus(e.target.value); setViewPage(0); }}><MenuItem value="">All statuses</MenuItem>{['In Progress', 'Completed', 'ReAudit', 'On Hold'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}><TextField size="small" fullWidth label="From" type="date" value={viewFromDate} onChange={(e) => { setViewFromDate(e.target.value); setViewPage(0); }} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}><TextField size="small" fullWidth label="To" type="date" value={viewToDate} onChange={(e) => { setViewToDate(e.target.value); setViewPage(0); }} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 12, md: 1 }}><Button size="small" fullWidth sx={{ height: '100%' }} onClick={() => { setViewSearch(''); setViewAuditType(''); setViewAuditStatus(''); setViewFromDate(''); setViewToDate(''); setViewPage(0); }}>Clear</Button></Grid>
          </Grid>
        </Box>
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table stickyHeader size="small">
            <TableHead><TableRow>{['S.No', 'Start', 'End', 'Type', 'Dealer', 'Location', 'Taxable', 'P&L', 'P&L Status', 'Audit Status', 'Actions'].map((header) => <TableCell key={header} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{header}</TableCell>)}</TableRow></TableHead>
            <TableBody>{savedRecords.length ? savedRecords.map((record, index) => <TableRow hover key={record._id || record.id}><TableCell>{viewPage * 10 + index + 1}</TableCell><TableCell>{new Date(record.auditDate).toLocaleDateString('en-GB')}</TableCell><TableCell>{new Date(record.auditEndDate).toLocaleDateString('en-GB')}</TableCell><TableCell>{record.subCategory || record.auditType}</TableCell><TableCell>{record.dealerName || '—'}</TableCell><TableCell>{record.location}</TableCell><TableCell>{currency.format(record.taxableAmount)}</TableCell><TableCell>{currency.format(record.profitLoss)}</TableCell><TableCell><Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 1, fontWeight: 700, bgcolor: record.pnlStatus === 'Profit' ? '#C6EFCE' : '#FFC7CE', color: record.pnlStatus === 'Profit' ? '#006100' : '#9C0006' }}>{record.pnlStatus}</Box></TableCell><TableCell>{record.auditStatus}</TableCell><TableCell><Stack direction="row" spacing={0.5}><Button size="small" onClick={() => editCalculation(record)}>Edit</Button><Button size="small" color="error" onClick={() => deleteCalculation(record)}>Delete</Button></Stack></TableCell></TableRow>) : <TableRow><TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>No saved calculations match these filters.</TableCell></TableRow>}</TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={viewTotal} page={viewPage} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_, nextPage) => setViewPage(nextPage)} />
      </Paper>
    </Container>
  );
}

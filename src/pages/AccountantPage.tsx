import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Container, Divider, Grid, MenuItem, Paper,
  Stack, TextField, Typography
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
  const selectedType = auditTypes.find((type) => type.value === form.auditType);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);
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
      const result = await api.saveAccountantCalculation(payload);
      setMessage(result.success ? 'Calculation saved successfully.' : result.message || 'Unable to save calculation.');
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
      const data = await api.exportAccountantCalculations({ from: fromDate || undefined, to: toDate || undefined, auditType: auditType || undefined });
      const url = URL.createObjectURL(data);
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

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="primary">Audit Amount Calculator</Typography>
          <Typography variant="body2" color="text.secondary">Save audit costs and export calculations.</Typography>
        </Box>
        <Button size="small" startIcon={<RestartAltIcon />} onClick={() => setForm(initialValues)} variant="outlined">Clear</Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 1.5, py: 0, '& .MuiAlert-message': { py: 0.75, fontSize: '0.82rem' } }}>Location rate applies to all audits except TATA Accessories, which uses the fixed line-count slabs. GST is separate.</Alert>
      {message && <Alert severity={message.includes('successfully') || message.includes('downloaded') ? 'success' : 'warning'} sx={{ mb: 1.5, py: 0 }} onClose={() => setMessage('')}>{message}</Alert>}

      <Paper sx={{ p: { xs: 1.75, sm: 2 }, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Export saved calculations</Typography>
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
            <Button sx={{ mt: 1.75, px: 3 }} variant="contained" size="small" startIcon={<SaveIcon />} onClick={saveCalculation} disabled={saving}>{saving ? 'Saving...' : 'Save Calculation'}</Button>
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
    </Container>
  );
}

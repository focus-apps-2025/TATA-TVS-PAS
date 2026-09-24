import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import api from '../services/api';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function AccountantDashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAccountantCalculations({ limit: 100 })
      .then((result) => setRecords(result.records))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const totalTaxable = records.reduce((sum, record) => sum + (record.taxableAmount || 0), 0);
    const totalPnl = records.reduce((sum, record) => sum + (record.profitLoss || 0), 0);
    const profitCount = records.filter((record) => record.pnlStatus === 'Profit').length;
    const lossCount = records.filter((record) => record.pnlStatus === 'Loss').length;
    const monthlyGroups = records.reduce((groups: Record<string, { value: number; date: number; label?: string }>, record) => {
      const date = new Date(record.auditDate);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const label = date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      if (!groups[key]) groups[key] = { value: 0, date: new Date(date.getFullYear(), date.getMonth(), 1).getTime() };
      groups[key].value += record.profitLoss || 0;
      groups[key].label = label;
      return groups;
    }, {});
    const monthly = Object.values(monthlyGroups)
      .sort((a, b) => a.date - b.date)
      .slice(-6)
      .map(({ label, value }) => [label || '', value] as [string, number]);

    return {
      totalTaxable, totalPnl, profitCount, lossCount,
      profitPercent: records.length ? (profitCount / records.length) * 100 : 0,
      lossPercent: records.length ? (lossCount / records.length) * 100 : 0,
      monthly,
    };
  }, [records]);

  const maxBarValue = Math.max(1, ...metrics.monthly.map(([, value]) => Math.abs(value)));
  const pieBackground = records.length
    ? `conic-gradient(#20B26B 0 ${metrics.profitPercent}%, #EF5B5B ${metrics.profitPercent}% 100%)`
    : '#E2E8F0';
  const cardData = [
    { label: 'Saved calculations', value: records.length.toString(), helper: 'Audit entries available', color: '#1D4ED8', tint: '#EAF1FF', icon: <ReceiptLongIcon /> },
    { label: 'Taxable amount', value: currency.format(metrics.totalTaxable), helper: 'Across saved audits', color: '#0E7490', tint: '#E6F7FA', icon: <AssessmentOutlinedIcon /> },
    { label: 'Net P&L', value: currency.format(metrics.totalPnl), helper: metrics.totalPnl >= 0 ? 'Overall profitable' : 'Overall loss', color: metrics.totalPnl >= 0 ? '#15803D' : '#B91C1C', tint: metrics.totalPnl >= 0 ? '#EAF8EE' : '#FEF0F0', icon: metrics.totalPnl >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon /> },
    { label: 'Profit rate', value: `${metrics.profitPercent.toFixed(0)}%`, helper: `${metrics.profitCount} profitable audits`, color: '#7C3AED', tint: '#F3EEFF', icon: <DonutLargeOutlinedIcon /> },
  ];

  return <Container maxWidth={false} sx={{ width: '100%', maxWidth: '100%', py: { xs: 1.5, md: 2 }, px: { xs: 1.5, md: 2.5 }, overflowX: 'hidden' }}>
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, mb: 2.5, overflow: 'hidden', position: 'relative', borderRadius: 3, color: 'common.white', background: 'linear-gradient(115deg, #003D7A 0%, #005EAE 62%, #0A76C8 100%)' }}>
      <Box sx={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)', right: -78, top: -118 }} />
      <Box sx={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: '28px solid rgba(255,255,255,0.06)', right: 130, bottom: -106 }} />
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ position: 'relative' }}>
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: 1.3, color: '#B9DDFF', fontWeight: 700 }}>FINANCIAL OVERVIEW</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25 }}>Accountant Dashboard</Typography>
          <Typography sx={{ mt: 0.75, color: '#D8ECFF' }}>Track audit income, expenses and profitability from your saved calculations.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <Button variant="outlined" onClick={() => navigate('/admin/accountant/calculator')} sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.72)', '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' } }}>View calculations</Button>
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => navigate('/admin/accountant/calculator')} sx={{ bgcolor: 'common.white', color: '#00549C', fontWeight: 800, '&:hover': { bgcolor: '#E7F3FF' } }}>New calculation</Button>
        </Stack>
      </Stack>
    </Paper>

    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', columnGap: '16px', rowGap: '16px', mb: 2.5, width: '100%' }}>
      {cardData.map((card) => <Box key={card.label} sx={{ minWidth: 0 }}>
        <Paper elevation={0} sx={{ height: '100%', minHeight: 126, p: 2, border: '1px solid #E4EAF2', borderRadius: 2.5, boxSizing: 'border-box' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ minWidth: 0 }}><Typography variant="body2" color="text.secondary" fontWeight={600} noWrap>{card.label}</Typography><Typography variant="h5" fontWeight={800} noWrap sx={{ mt: 0.6, color: '#172B4D', fontSize: { xs: '1.2rem', md: '1.45rem' } }}>{loading ? '—' : card.value}</Typography><Typography variant="caption" color="text.secondary" noWrap>{card.helper}</Typography></Box>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 2, bgcolor: card.tint, color: card.color }}>{card.icon}</Box>
          </Stack>
        </Paper>
      </Box>)}
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 7fr) minmax(320px, 5fr)' }, gap: { xs: 1.5, md: 2.5 }, alignItems: 'stretch' }}>
      <Box sx={{ minWidth: 0 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, height: '100%', border: '1px solid #E4EAF2', borderRadius: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}><Box><Typography fontWeight={800} color="#172B4D">Monthly P&amp;L trend</Typography><Typography variant="body2" color="text.secondary">Last six months of saved audit calculations</Typography></Box><Box sx={{ px: 1.25, py: 0.5, bgcolor: '#F1F5F9', borderRadius: 5 }}><Typography variant="caption" fontWeight={700} color="text.secondary">INR</Typography></Box></Stack>
          {metrics.monthly.length > 1 ? <Stack direction="row" spacing={{ xs: 0.75, sm: 1.5 }} alignItems="flex-end" sx={{ height: 198, pt: 1.5, borderBottom: '1px solid #EDF2F7' }}>
            {metrics.monthly.map(([month, value]) => <Box key={month} sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 0.65 }}><Typography variant="caption" fontWeight={800} noWrap sx={{ maxWidth: '100%', color: value >= 0 ? '#15803D' : '#D14343' }}>{currency.format(value)}</Typography><Box sx={{ width: { xs: '82%', sm: '58%' }, minHeight: 12, height: `${Math.max(12, (Math.abs(value) / maxBarValue) * 128)}px`, borderRadius: '7px 7px 2px 2px', background: value >= 0 ? 'linear-gradient(180deg, #51D68A, #1AA761)' : 'linear-gradient(180deg, #FF8D8D, #E55050)', boxShadow: value >= 0 ? '0 5px 12px rgba(32,178,107,0.2)' : '0 5px 12px rgba(239,91,91,0.18)' }} /><Typography variant="caption" fontWeight={600} color="text.secondary">{month}</Typography></Box>)}
          </Stack> : metrics.monthly.length === 1 ? <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 198, pt: 1 }}>
            <Box sx={{ width: '100%', maxWidth: 500, p: { xs: 2, sm: 2.25 }, border: '1px solid', borderColor: metrics.monthly[0][1] >= 0 ? '#B8EACD' : '#FFD1D1', borderRadius: 2.5, background: metrics.monthly[0][1] >= 0 ? 'linear-gradient(110deg, #F0FCF5, #FFFFFF)' : 'linear-gradient(110deg, #FFF4F4, #FFFFFF)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}><Box><Typography variant="caption" fontWeight={800} sx={{ color: metrics.monthly[0][1] >= 0 ? '#15803D' : '#C23939', letterSpacing: 0.6 }}>CURRENT MONTH · {metrics.monthly[0][0]}</Typography><Typography variant="h4" fontWeight={800} sx={{ mt: 0.4, color: metrics.monthly[0][1] >= 0 ? '#15803D' : '#B91C1C' }}>{currency.format(metrics.monthly[0][1])}</Typography><Typography variant="body2" color="text.secondary">Net profit &amp; loss from {records.length} saved audit{records.length === 1 ? '' : 's'}</Typography></Box><Box sx={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: '50%', bgcolor: metrics.monthly[0][1] >= 0 ? '#DDF8E7' : '#FFE2E2', color: metrics.monthly[0][1] >= 0 ? '#15803D' : '#C23939' }}>{metrics.monthly[0][1] >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}</Box></Stack>
            </Box>
          </Box> : <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: 198, color: 'text.secondary' }}><AssessmentOutlinedIcon sx={{ fontSize: 34, color: '#9BAEC6' }} /><Typography>No saved calculations yet.</Typography><Button size="small" onClick={() => navigate('/admin/accountant/calculator')}>Create your first calculation</Button></Stack>}
        </Paper>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, height: '100%', border: '1px solid #E4EAF2', borderRadius: 2.5 }}>
          <Typography fontWeight={800} color="#172B4D">Profitability split</Typography><Typography variant="body2" color="text.secondary">Distribution of saved audit results</Typography>
          <Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} alignItems="center" justifyContent="space-evenly" spacing={1.75} sx={{ pt: 1.75 }}>
            <Box sx={{ width: 142, height: 142, borderRadius: '50%', p: '11px', background: pieBackground, boxShadow: '0 8px 20px rgba(27, 73, 128, 0.1)' }}><Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Typography variant="h4" fontWeight={800} color="#172B4D">{loading ? '—' : records.length}</Typography><Typography variant="caption" color="text.secondary">total audits</Typography></Box></Box>
            <Stack spacing={1.1} sx={{ width: { xs: '100%', sm: 235, lg: '100%' } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#20B26B' }} /><Typography variant="body2" fontWeight={700}>Profit</Typography></Stack><Typography variant="body2" fontWeight={800} color="#15803D">{metrics.profitCount} · {metrics.profitPercent.toFixed(0)}%</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#EF5B5B' }} /><Typography variant="body2" fontWeight={700}>Loss</Typography></Stack><Typography variant="body2" fontWeight={800} color="#D14343">{metrics.lossCount} · {metrics.lossPercent.toFixed(0)}%</Typography></Stack>
              <Box sx={{ mt: 0.35, p: 1.1, borderRadius: 1.5, bgcolor: metrics.totalPnl >= 0 ? '#ECFDF3' : '#FEF2F2' }}><Typography variant="caption" color="text.secondary">Overall result</Typography><Typography fontWeight={800} color={metrics.totalPnl >= 0 ? '#15803D' : '#B91C1C'}>{loading ? '—' : currency.format(metrics.totalPnl)}</Typography></Box>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  </Container>;
}

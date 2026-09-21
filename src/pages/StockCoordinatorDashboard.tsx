import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import api, { Team } from '../services/api';

const auditTypes = [
  { label: 'TATA', color: '#1665B5' },
  { label: 'TVS', color: '#16A36A' },
  { label: 'JBM', color: '#F59E0B' },
  { label: 'Honda', color: '#EA5A5A' },
];

const matchesAuditType = (team: Team, type: string) => {
  const value = String(team.auditType || team.auditCategory || '').toUpperCase();
  const teamName = String(team.siteName || team.teamName || team.name || team.description || '').toUpperCase();
  if (type === 'JBM' || type === 'Honda') return teamName.includes(type.toUpperCase());
  return type === 'TVS' ? value.includes('TVS') : value.includes(type.toUpperCase());
};

export default function StockCoordinatorDashboard() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTeams().then(setTeams).catch(() => setTeams([])).finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const types = auditTypes.map((item) => ({ ...item, count: teams.filter((team) => matchesAuditType(team, item.label)).length }));
    const completed = teams.filter((team) => /complete|finish|closed/i.test(team.status || '')).length;
    return { types, completed, active: teams.length - completed };
  }, [teams]);

  const totalTypedTeams = summary.types.reduce((sum, item) => sum + item.count, 0);
  let accumulated = 0;
  const pieParts = summary.types.map((item) => {
    const start = totalTypedTeams ? (accumulated / totalTypedTeams) * 100 : 0;
    accumulated += item.count;
    return `${item.color} ${start}% ${(accumulated / Math.max(totalTypedTeams, 1)) * 100}%`;
  });
  const pieBackground = totalTypedTeams ? `conic-gradient(${pieParts.join(', ')})` : '#E2E8F0';
  const maxStatus = Math.max(1, summary.completed, summary.active);

  return <Container maxWidth={false} sx={{ width: '100%', maxWidth: '100%', py: { xs: 2, md: 3 }, px: { xs: 1.5, md: 3 }, overflowX: 'hidden' }}>
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, color: 'common.white', borderRadius: 3, background: 'linear-gradient(120deg, #003C78, #006FB9)', mb: 2.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <Box><Typography variant="overline" sx={{ color: '#B9DDFF', fontWeight: 800, letterSpacing: 1.2 }}>OPERATIONS OVERVIEW</Typography><Typography variant="h4" fontWeight={800}>Stock Coordinator Dashboard</Typography><Typography sx={{ color: '#D8ECFF', mt: 0.5 }}>Monitor audit teams and distribution by audit type.</Typography></Box>
        <Button variant="contained" onClick={() => navigate('/admin/teams')} startIcon={<GroupsOutlinedIcon />} sx={{ bgcolor: 'common.white', color: '#00549C', fontWeight: 800, '&:hover': { bgcolor: '#E7F3FF' } }}>Manage teams</Button>
      </Stack>
    </Paper>

    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', mb: 2.5 }}>
      {[{ label: 'Total teams', value: teams.length, icon: <GroupsOutlinedIcon />, color: '#1665B5', tint: '#EAF1FF' }, { label: 'Completed audits', value: summary.completed, icon: <TrendingUpIcon />, color: '#15803D', tint: '#EAF8EE' }, { label: 'Active audits', value: summary.active, icon: <PieChartOutlineIcon />, color: '#B45309', tint: '#FFF6DE' }].map((card) => <Paper key={card.label} elevation={0} sx={{ p: 2, minWidth: 0, border: '1px solid #E2E8F0', borderRadius: 2.5 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="body2" color="text.secondary" fontWeight={700}>{card.label}</Typography><Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: '#172B4D' }}>{loading ? '—' : card.value}</Typography></Box><Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: card.tint, color: card.color }}>{card.icon}</Box></Stack></Paper>)}
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(300px, 5fr)' }, gap: '20px' }}>
      <Paper elevation={0} sx={{ p: 2.5, minWidth: 0, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
        <Typography fontWeight={800} color="#172B4D">Overall audit status</Typography><Typography variant="body2" color="text.secondary">Completed versus active team audits</Typography>
        <Stack direction="row" alignItems="flex-end" justifyContent="space-evenly" spacing={5} sx={{ height: 260, pt: 4 }}>
          {[{ label: 'Completed', value: summary.completed, color: '#20B26B' }, { label: 'Active', value: summary.active, color: '#3B82F6' }].map((bar) => <Stack key={bar.label} alignItems="center" justifyContent="flex-end" sx={{ height: '100%', width: '34%', maxWidth: 180 }}><Typography fontWeight={800} color="#172B4D">{loading ? '—' : bar.value}</Typography><Box sx={{ width: '100%', height: `${Math.max(12, (bar.value / maxStatus) * 170)}px`, mt: 1, borderRadius: '10px 10px 3px 3px', bgcolor: bar.color, boxShadow: `0 7px 16px ${bar.color}33` }} /><Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ mt: 1 }}>{bar.label}</Typography></Stack>)}
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 2.5, minWidth: 0, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
        <Typography fontWeight={800} color="#172B4D">Audit type distribution</Typography><Typography variant="body2" color="text.secondary">TATA, TVS, JBM and Honda audits</Typography>
        <Stack direction={{ xs: 'row', lg: 'column' }} alignItems="center" spacing={2.5} sx={{ pt: 2.5 }}>
          <Stack alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}><Box role="img" aria-label="Pie chart of team audits by audit type" sx={{ width: 175, height: 175, borderRadius: '50%', background: pieBackground, boxShadow: '0 8px 20px rgba(27, 73, 128, 0.14)', border: '3px solid #FFF' }} /><Typography variant="caption" color="text.secondary" fontWeight={700}>{loading ? 'Loading…' : `${totalTypedTeams} typed audits`}</Typography></Stack>
          <Stack spacing={1.1} sx={{ width: '100%' }}>{summary.types.map((item) => <Stack key={item.label} direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 10, height: 10, bgcolor: item.color, borderRadius: '50%' }} /><Typography variant="body2" fontWeight={700}>{item.label}</Typography></Stack><Typography variant="body2" fontWeight={800}>{loading ? '—' : `${item.count} · ${totalTypedTeams ? Math.round((item.count / totalTypedTeams) * 100) : 0}%`}</Typography></Stack>)}</Stack>
        </Stack>
      </Paper>
    </Box>
  </Container>;
}

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import { useNavigate } from 'react-router-dom';
import api, { Team } from '../services/api';
import authManager from '../services/authSession';

const displayAuditType = (type?: string) => type === '3w-tvs' ? '3W TVS' : type || 'Audit';

export default function AuditTypeDashboard() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [auditType, setAuditType] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getTeams(), authManager.getCurrentUser()]).then(([teamList, user]) => {
      setTeams(teamList);
      setAuditType(user?.assignedAuditType || '');
    }).finally(() => setLoading(false));
  }, []);

  const completed = useMemo(() => teams.filter((team) => /complete|finish|closed/i.test(team.status || '')).length, [teams]);
  const active = teams.length - completed;
  const completionRate = teams.length ? Math.round((completed / teams.length) * 100) : 0;
  const statusPie = teams.length ? `conic-gradient(#1DAA68 0 ${completionRate}%, #F59E0B ${completionRate}% 100%)` : '#E2E8F0';
  const recentTeams = useMemo(() => [...teams].slice(0, 5), [teams]);
  const cards = [
    { label: 'Assigned teams', value: teams.length, icon: <GroupsOutlinedIcon />, color: '#1665B5', tint: '#EAF1FF' },
    { label: 'Completed audits', value: completed, icon: <TaskAltOutlinedIcon />, color: '#15803D', tint: '#EAF8EE' },
    { label: 'Active audits', value: active, icon: <PendingActionsOutlinedIcon />, color: '#B45309', tint: '#FFF6DE' },
  ];

  return <Container maxWidth={false} sx={{ width: '100%', maxWidth: '100%', py: { xs: 2, md: 3 }, px: { xs: 1.5, md: 4 } }}>
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, mb: 2, borderRadius: 3, color: 'common.white', background: 'linear-gradient(120deg, #003C78, #006FB9)', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)', right: -80, top: -135 }} />
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
        <Box><Typography variant="overline" fontWeight={800} sx={{ color: '#B9DDFF', letterSpacing: 1.2 }}>AUDIT OPERATIONS</Typography><Typography variant="h4" fontWeight={800}>{displayAuditType(auditType)} Dashboard</Typography><Typography sx={{ color: '#D8ECFF', mt: 0.5 }}>You can view teams assigned to your audit type.</Typography></Box>
        <Button variant="contained" onClick={() => navigate('/admin/audit-manager/teams')} startIcon={<GroupsOutlinedIcon />} sx={{ bgcolor: 'common.white', color: '#00549C', fontWeight: 800, '&:hover': { bgcolor: '#E7F3FF' } }}>View teams</Button>
      </Stack>
    </Paper>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', mb: 2 }}>{cards.map((card) => <Paper key={card.label} elevation={0} sx={{ p: 2, minWidth: 0, border: '1px solid #E2E8F0', borderRadius: 2.5 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="body2" color="text.secondary" fontWeight={700}>{card.label}</Typography><Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>{loading ? '—' : card.value}</Typography></Box><Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: card.tint, color: card.color }}>{card.icon}</Box></Stack></Paper>)}</Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 4fr) minmax(0, 6fr)' }, gap: '16px' }}>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
        <Typography fontWeight={800} color="#172B4D">Audit completion</Typography><Typography variant="body2" color="text.secondary">Overall team status</Typography>
        <Stack direction="row" alignItems="center" justifyContent="space-around" spacing={2} sx={{ pt: 2.25 }}>
          <Box sx={{ width: 160, height: 160, borderRadius: '50%', p: '13px', background: statusPie, flexShrink: 0, boxShadow: '0 8px 18px rgba(26, 80, 138, 0.13)' }}><Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center' }}><Box><Typography variant="h4" fontWeight={800}>{loading ? '—' : `${completionRate}%`}</Typography><Typography variant="caption" color="text.secondary">completed</Typography></Box></Box></Box>
          <Stack spacing={1.1}><Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#1DAA68' }} /><Typography variant="body2">Completed · <b>{loading ? '—' : completed}</b></Typography></Stack><Stack direction="row" alignItems="center" spacing={1}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#F59E0B' }} /><Typography variant="body2">Active · <b>{loading ? '—' : active}</b></Typography></Stack></Stack>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #E2E8F0', borderRadius: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={800} color="#172B4D">Assigned team snapshot</Typography><Typography variant="body2" color="text.secondary">Your most recent audit teams</Typography></Box><Button size="small" onClick={() => navigate('/admin/audit-manager/teams')}>View all</Button></Stack>
        <Stack spacing={1.1} sx={{ mt: 2 }}>{recentTeams.length ? recentTeams.map((team, index) => { const done = /complete|finish|closed/i.test(team.status || ''); return <Stack key={team._id || team.id || index} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.15, borderRadius: 1.5, bgcolor: index % 2 ? '#F8FAFC' : '#F2F7FC' }}><Box sx={{ minWidth: 0 }}><Typography fontWeight={700} noWrap>{team.siteName || 'Unnamed team'}</Typography><Typography variant="caption" color="text.secondary">{team.location || 'Location not specified'}</Typography></Box><Box sx={{ px: 1, py: 0.4, borderRadius: 5, bgcolor: done ? '#EAF8EE' : '#FFF6DE', color: done ? '#15803D' : '#B45309', fontSize: 12, fontWeight: 800 }}>{done ? 'Completed' : 'Active'}</Box></Stack>; }) : <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No teams assigned yet.</Typography>}</Stack>
      </Paper>
    </Box>
  </Container>;
}

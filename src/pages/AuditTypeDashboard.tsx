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
  const cards = [
    { label: 'Assigned teams', value: teams.length, icon: <GroupsOutlinedIcon />, color: '#1665B5', tint: '#EAF1FF' },
    { label: 'Completed audits', value: completed, icon: <TaskAltOutlinedIcon />, color: '#15803D', tint: '#EAF8EE' },
    { label: 'Active audits', value: active, icon: <PendingActionsOutlinedIcon />, color: '#B45309', tint: '#FFF6DE' },
  ];

  return <Container maxWidth="lg" sx={{ py: 3 }}>
    <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, mb: 2.5, borderRadius: 3, color: 'common.white', background: 'linear-gradient(120deg, #003C78, #006FB9)' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
        <Box><Typography variant="overline" fontWeight={800} sx={{ color: '#B9DDFF', letterSpacing: 1.2 }}>AUDIT OPERATIONS</Typography><Typography variant="h4" fontWeight={800}>{displayAuditType(auditType)} Dashboard</Typography><Typography sx={{ color: '#D8ECFF', mt: 0.5 }}>You can view teams assigned to your audit type.</Typography></Box>
        <Button variant="contained" onClick={() => navigate('/admin/audit-manager/teams')} startIcon={<GroupsOutlinedIcon />} sx={{ bgcolor: 'common.white', color: '#00549C', fontWeight: 800, '&:hover': { bgcolor: '#E7F3FF' } }}>View teams</Button>
      </Stack>
    </Paper>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>{cards.map((card) => <Paper key={card.label} elevation={0} sx={{ p: 2, minWidth: 0, border: '1px solid #E2E8F0', borderRadius: 2.5 }}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="body2" color="text.secondary" fontWeight={700}>{card.label}</Typography><Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>{loading ? '—' : card.value}</Typography></Box><Box sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: card.tint, color: card.color }}>{card.icon}</Box></Stack></Paper>)}</Box>
  </Container>;
}

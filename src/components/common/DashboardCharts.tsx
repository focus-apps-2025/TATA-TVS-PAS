import { useId, useState } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import { ChartHeading, ChartState, LegendToggle } from './DashboardPrimitives';
import { dashboardTokens as t } from './dashboardTheme';

type StateProps = { loading: boolean; error?: string; onChangeRange: () => void; onRetry: () => void };
type Point = { label: string; count: number };
type ActivityTeam = { teamId: string; teamName: string; totalScans: number; members: { id: string; name: string; role: string; scanCount: number }[] };
const number = (value: number) => value.toLocaleString('en-IN');
function scaleMax(value: number) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value / 4));
  return Math.ceil(value / (step * 4)) * step * 4;
}
const roles = [
  { label: 'Team leaders', color: t.primary, matches: (role: string) => /leader|^tl$/.test(role) },
  { label: 'Site managers', color: t.success, matches: (role: string) => /manager|^asm$/.test(role) },
  { label: 'Team members / other', color: t.members, matches: () => true },
];
function roleCounts(team: ActivityTeam) {
  const values = [0, 0, 0];
  team.members.forEach((member) => {
    values[roles.findIndex((series) => series.matches(member.role.toLowerCase().replace(/_/g, ' ')))] += member.scanCount;
  });
  values[2] += Math.max(0, team.totalScans - values.reduce((sum, value) => sum + value, 0));
  return values;
}

export function ScanContributionChart({ teams, ...state }: StateProps & { teams: ActivityTeam[] }) {
  const id = useId().replace(/:/g, '');
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState([true, true, true]);
  const rows = [...teams].sort((a, b) => b.totalScans - a.totalScans);
  const total = rows.reduce((sum, team) => sum + team.totalScans, 0);
  const max = scaleMax(Math.max(0, ...rows.map((team) => roleCounts(team).reduce((sum, value, i) => sum + (visible[i] ? value : 0), 0))));
  const width = Math.max(640, rows.length * 84 + 70);
  const step = (width - 70) / Math.max(1, rows.length);
  const active = rows.find((team) => team.teamId === selected);
  return <>
    <ChartHeading title="Scan Contribution by Team" subtitle="Selected-period scans, split by assigned role. Select a team to inspect its members." />
    <Stack direction="row" flexWrap="wrap" gap={.5} sx={{ mb: 1 }}>{roles.map((role, i) => <LegendToggle key={role.label} {...role} pressed={visible[i]} onClick={() => setVisible((old) => old.map((value, j) => i === j ? !value : value))} />)}</Stack>
    <ChartState {...state} empty={!total}>
      <Box data-chart-overflow sx={{ overflowX: 'auto' }}>
        <svg data-dashboard-chart width="100%" viewBox={`0 0 ${width} 240`} style={{ minWidth: width, display: 'block' }} role="group" aria-label="Scan counts by team and role">
          <defs>{roles.map((role, i) => <linearGradient key={i} id={`${id}-role-${i}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor={role.color} /><stop offset="100%" stopColor={i === 0 ? t.primaryLight : role.color} /></linearGradient>)}</defs>
          {[0, 1, 2, 3, 4].map((tick) => <g key={tick}>
            <line x1="48" x2={width - 10} y1={190 - tick * 40} y2={190 - tick * 40} stroke={t.guide} strokeDasharray="3 5" />
            <text x="40" y={194 - tick * 40} textAnchor="end" fontSize="10" fill={t.muted}>{number(max * tick / 4)}</text>
          </g>)}
          {rows.map((team, i) => {
            const values = roleCounts(team);
            const shownTotal = values.reduce((sum, value, j) => sum + (visible[j] ? value : 0), 0);
            const x = 50 + i * step + step / 2;
            let offset = 0;
            const detail = <Box sx={{ fontSize: 12 }}><strong>{team.teamName}</strong><div>{number(team.totalScans)} scans · {total ? (team.totalScans / total * 100).toFixed(1) : 0}% of all scans</div>{values.map((value, j) => <div key={j}>{roles[j].label}: {number(value)} ({team.totalScans ? (value / team.totalScans * 100).toFixed(1) : 0}%)</div>)}</Box>;
            return <Tooltip key={team.teamId} title={detail} arrow>
              <g role="button" tabIndex={0} aria-label={`${team.teamName}: ${team.totalScans} scans. Show member details.`} onClick={() => setSelected(team.teamId)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(team.teamId); } }} style={{ cursor: 'pointer' }}>
                <rect x={x - step / 2 + 3} y="15" width={step - 6} height="221" rx="5" fill={selected === team.teamId ? '#EEF4FF' : 'transparent'} />
                {values.map((value, j) => {
                  const height = visible[j] ? value / max * 160 : 0;
                  offset += height;
                  return <rect className="dashboard-chart-mark" key={j} x={x - 18} y={190 - offset} width="36" height={height} rx="3" fill={`url(#${id}-role-${j})`} />;
                })}
                <text x={x} y={180 - shownTotal / max * 160} textAnchor="middle" fontSize="11" fill={t.heading} fontWeight="600">{number(shownTotal)}</text>
                <text x={x} y="212" textAnchor="middle" fontSize="10" fill={t.muted}>{team.teamName.length > 13 ? team.teamName.slice(0, 12) + '…' : team.teamName}</text>
              </g>
            </Tooltip>;
          })}
        </svg>
      </Box>
      <Typography sx={{ fontSize: 11, color: t.muted, mt: 1 }}>{number(total)} total scans · {rows.filter((team) => team.totalScans > 0).length} teams recorded scans{visible.some((value) => !value) ? ' · Some role series are hidden; totals remain unchanged.' : ''}</Typography>
    </ChartState>
    {active && <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: t.background }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 13, fontWeight: 650 }}>{active.teamName}</Typography><Button size="small" onClick={() => setSelected(null)}>Close details</Button></Stack><Stack gap={.5}>{active.members.map((member) => <Stack key={member.id} direction="row" justifyContent="space-between" gap={1}><Typography sx={{ fontSize: 12 }}>{member.name} <Box component="span" sx={{ color: t.muted }}>· {member.role.replace(/_/g, ' ')}</Box></Typography><Typography sx={{ fontSize: 12, fontWeight: 650 }}>{number(member.scanCount)}</Typography></Stack>)}</Stack></Box>}
  </>;
}

export function AttendanceChart({
  present = 0,
  absent = 0,
  compoff = 0,
  paidLeave = 0,
  travel = 0,
  notSet = 0,
  totalStaff,
  ...state
}: StateProps & {
  present?: number;
  absent?: number;
  compoff?: number;
  paidLeave?: number;
  travel?: number;
  notSet?: number;
  totalStaff?: number;
}) {
  const totalDetermined = present + absent + compoff + paidLeave + travel;
  const workforceTotal = totalStaff !== undefined && totalStaff > 0 ? totalStaff : (totalDetermined + notSet);
  const activeAvailability = workforceTotal > 0 ? ((present + travel) / workforceTotal) * 100 : 0;
  const circumference = 2 * Math.PI * 66;

  // Active presence slice
  const availableShare = Math.min(100, Math.max(0, activeAvailability));
  const activeStrokeDash = `${(circumference * availableShare) / 100} ${circumference}`;

  const calcPercent = (val: number) => (workforceTotal > 0 ? ((val / workforceTotal) * 100).toFixed(1) : '0.0');

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2 }}>
        <Box sx={{ bgcolor: '#EFF6FF', p: 0.75, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PersonIcon sx={{ fontSize: 20, color: '#1D4ED8' }} />
        </Box>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
          Attendance &amp; Workforce Availability
        </Typography>
      </Stack>

      <ChartState {...state} empty={workforceTotal === 0}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '170px 1fr 1fr' },
            gap: { xs: 2, md: 2.5 },
            alignItems: 'center',
            pt: 1,
            minHeight: 190,
          }}
        >
          {/* Left: Donut with availability percentage */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: { sm: '1px solid #F1F5F9' },
              pr: { sm: 1.5 },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 148,
                height: 148,
                p: 0.75,
                borderRadius: '50%',
                bgcolor: '#F8FAFC',
                boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 170 170" width="138" height="138" role="img" aria-label="Workforce attendance chart">
                <circle cx="85" cy="85" r="66" fill="none" stroke="#E2E8F0" strokeWidth="18" />
                {availableShare > 0 && (
                  <circle
                    className="dashboard-chart-mark"
                    cx="85"
                    cy="85"
                    r="66"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="18"
                    strokeDasharray={activeStrokeDash}
                    strokeDashoffset={0}
                    strokeLinecap="butt"
                    transform="rotate(-90 85 85)"
                  />
                )}
              </svg>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ fontSize: 24, fontWeight: 850, color: '#0F172A', lineHeight: 1.1 }}>
                  {activeAvailability.toFixed(1)}%
                </Typography>
                <Typography sx={{ fontSize: 9.5, fontWeight: 750, color: '#64748B', letterSpacing: '0.8px', mt: 0.5 }}>
                  AVAILABLE
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Middle Column: Present & Absent */}
          <Stack spacing={1.5} sx={{ width: '100%' }}>
            {/* Present Card */}
            <Box
              sx={{
                p: 1.75,
                borderRadius: 2.75,
                background: 'linear-gradient(135deg, #ECFDF5 0%, #E0FBEF 100%)',
                border: '1.5px solid #A7F3D0',
                boxShadow: '0 3px 12px rgba(16, 185, 129, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 5px 16px rgba(16, 185, 129, 0.14)',
                },
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(5, 150, 105, 0.15)',
                  flexShrink: 0,
                }}
              >
                <PersonIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#047857', letterSpacing: '0.2px' }}>Present</Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography sx={{ fontSize: 20, fontWeight: 850, color: '#065F46' }}>
                    {number(present)}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: '#059669' }}>
                    ({calcPercent(present)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Absent Card */}
            <Box
              sx={{
                p: 1.75,
                borderRadius: 2.75,
                background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                border: '1.5px solid #FECACA',
                boxShadow: '0 3px 12px rgba(239, 68, 68, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 5px 16px rgba(239, 68, 68, 0.14)',
                },
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.15)',
                  flexShrink: 0,
                }}
              >
                <PersonIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#B91C1C', letterSpacing: '0.2px' }}>Absent</Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography sx={{ fontSize: 20, fontWeight: 850, color: '#991B1B' }}>
                    {number(absent)}
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: '#DC2626' }}>
                    ({calcPercent(absent)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Stack>

          {/* Right Column: Comp-off, Paid Leave, Travel */}
          <Stack spacing={1.25} sx={{ width: '100%' }}>
            {/* Comp-off Card */}
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2.25,
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '1.5px solid #FDE68A',
                boxShadow: '0 2px 8px rgba(217, 119, 6, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.12)' },
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.75,
                  bgcolor: '#FFFFFF',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(217, 119, 6, 0.15)',
                  flexShrink: 0,
                }}
              >
                <AccessTimeIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>Comp-off</Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography sx={{ fontSize: 16, fontWeight: 850, color: '#78350F' }}>
                    {number(compoff)}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 650, color: '#B45309' }}>
                    ({calcPercent(compoff)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Paid Leave Card */}
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2.25,
                background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                border: '1.5px solid #BFDBFE',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)' },
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.75,
                  bgcolor: '#FFFFFF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(37, 99, 235, 0.15)',
                  flexShrink: 0,
                }}
              >
                <CalendarMonthIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#1E40AF' }}>Paid Leave</Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography sx={{ fontSize: 16, fontWeight: 850, color: '#1E3A8A' }}>
                    {number(paidLeave)}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 650, color: '#2563EB' }}>
                    ({calcPercent(paidLeave)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Travel Card */}
            <Box
              sx={{
                p: 1.25,
                borderRadius: 2.25,
                background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
                border: '1.5px solid #E9D5FF',
                boxShadow: '0 2px 8px rgba(147, 51, 234, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 4px 12px rgba(147, 51, 234, 0.12)' },
              }}
            >
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.75,
                  bgcolor: '#FFFFFF',
                  color: '#9333EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(147, 51, 234, 0.15)',
                  flexShrink: 0,
                }}
              >
                <FlightTakeoffIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6B21A8' }}>Travel</Typography>
                <Stack direction="row" alignItems="baseline" spacing={0.75}>
                  <Typography sx={{ fontSize: 16, fontWeight: 850, color: '#581C87' }}>
                    {number(travel)}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, fontWeight: 650, color: '#7E22CE' }}>
                    ({calcPercent(travel)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Stack>
        </Box>
      </ChartState>
    </Box>
  );
}

export function RankedChart({ items, ...state }: StateProps & { items: Point[] }) {
  const [grouped, setGrouped] = useState(false);
  const sorted = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...sorted.map((item) => item.count));
  const parentTotals = new Map<string, number>();
  const groups = new Map<string, Point[]>();

  sorted.forEach((item) => {
    const [parent, ...child] = item.label.split(' · ');
    parentTotals.set(parent, (parentTotals.get(parent) || 0) + item.count);
    const sub = child.join(' · ').trim();
    if (sub) {
      groups.set(parent, [...(groups.get(parent) || []), { label: sub, count: item.count }]);
    } else if (!groups.has(parent)) {
      groups.set(parent, []);
    }
  });

  const getBrandTheme = (label: string) => {
    const upper = label.toUpperCase();
    if (upper.includes('TATA')) {
      return { color: '#D35400', light: '#FED7AA', grad: 'linear-gradient(90deg, #EA580C, #F97316)' };
    }
    if (upper.includes('3W')) {
      return { color: '#0F766E', light: '#99F6E4', grad: 'linear-gradient(90deg, #0F766E, #14B8A6)' };
    }
    if (upper.includes('TVS')) {
      return { color: '#004F98', light: '#BFDBFE', grad: 'linear-gradient(90deg, #004F98, #3B82F6)' };
    }
    return { color: '#6366F1', light: '#DDD6FE', grad: 'linear-gradient(90deg, #6366F1, #818CF8)' };
  };

  const renderProgressRow = (item: Point, parentMax: number) => {
    const theme = getBrandTheme(item.label);
    const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : '0';

    return (
      <Box
        key={item.label}
        sx={{
          p: '10px 14px',
          borderRadius: 2.5,
          bgcolor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: theme.light,
            boxShadow: '0 3px 8px rgba(0,0,0,0.04)',
            transform: 'translateY(-1px)',
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                bgcolor: theme.color,
                boxShadow: `0 0 6px ${theme.color}66`,
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1E293B', overflowWrap: 'anywhere' }}>
              {item.label}
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>
              {number(item.count)}
            </Typography>
            <Box
              sx={{
                fontSize: 10.5,
                fontWeight: 700,
                color: theme.color,
                bgcolor: `${theme.color}14`,
                px: 0.85,
                py: 0.15,
                borderRadius: '999px',
              }}
            >
              {pct}%
            </Box>
          </Stack>
        </Stack>

        {/* Smooth Track with Gradient Fill */}
        <Box
          role="img"
          aria-label={`${item.label}: ${item.count} teams (${pct}%)`}
          sx={{
            height: 7,
            borderRadius: '999px',
            bgcolor: '#F1F5F9',
            overflow: 'hidden',
          }}
        >
          <Box
            className="dashboard-chart-mark"
            sx={{
              height: '100%',
              width: `${(item.count / parentMax) * 100}%`,
              borderRadius: '999px',
              background: theme.grad,
              transition: 'width 0.4s ease-out',
            }}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
          Audit Portfolio Composition
        </Typography>

        {/* Modern Pill Switcher */}
        <Stack
          direction="row"
          sx={{
            bgcolor: '#F1F5F9',
            borderRadius: '999px',
            p: 0.35,
            border: '1px solid #E2E8F0',
          }}
        >
          <Button
            size="small"
            aria-pressed={!grouped}
            onClick={() => setGrouped(false)}
            sx={{
              minWidth: 48,
              height: 26,
              fontSize: 11,
              fontWeight: !grouped ? 750 : 550,
              bgcolor: !grouped ? '#004F98' : 'transparent',
              color: !grouped ? '#FFFFFF' : '#64748B',
              boxShadow: !grouped ? '0 1px 3px rgba(0,79,152,0.25)' : 'none',
              borderRadius: '999px',
              textTransform: 'none',
              px: 1.25,
              '&:hover': {
                bgcolor: !grouped ? '#004F98' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            Bars
          </Button>
          <Button
            size="small"
            aria-pressed={grouped}
            onClick={() => setGrouped(true)}
            sx={{
              minWidth: 54,
              height: 26,
              fontSize: 11,
              fontWeight: grouped ? 750 : 550,
              bgcolor: grouped ? '#004F98' : 'transparent',
              color: grouped ? '#FFFFFF' : '#64748B',
              boxShadow: grouped ? '0 1px 3px rgba(0,79,152,0.25)' : 'none',
              borderRadius: '999px',
              textTransform: 'none',
              px: 1.25,
              '&:hover': {
                bgcolor: grouped ? '#004F98' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            Grouped
          </Button>
        </Stack>
      </Stack>

      <ChartState {...state} empty={!total}>
        {grouped ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {[...groups].map(([parent, children]) => {
              const theme = getBrandTheme(parent);
              return (
                <Box
                  key={parent}
                  sx={{
                    p: 1.75,
                    bgcolor: '#FFFFFF',
                    borderRadius: 3,
                    border: '1px solid #E2E8F0',
                    borderLeft: `4px solid ${theme.color}`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 750, color: '#0F172A', mb: children.length ? 1 : 0 }}>
                    {parent}{' '}
                    <Box component="span" sx={{ float: 'right', color: theme.color, fontWeight: 800 }}>
                      {parentTotals.get(parent) || 0}
                    </Box>
                  </Typography>
                  <Stack gap={1}>{children.map((item) => renderProgressRow(item, max))}</Stack>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Stack gap={1.25}>{sorted.map((item) => renderProgressRow(item, max))}</Stack>
        )}
      </ChartState>
    </Box>
  );
}

export function AuditStateComparison({ followUps, completions, ...state }: StateProps & { followUps: { state?: string }[]; completions: { state?: string }[] }) {
  const states = new Map<string, { follow: number; complete: number }>();
  [followUps, completions].forEach((records, series) => records.forEach((record) => {
    const key = String(record.state || 'Not specified').trim().toUpperCase();
    const counts = states.get(key) || { follow: 0, complete: 0 };
    if (series === 0) counts.follow++; else counts.complete++;
    states.set(key, counts);
  }));
  const rows = [...states].sort((a, b) => (b[1].follow + b[1].complete) - (a[1].follow + a[1].complete));
  const max = scaleMax(Math.max(0, ...rows.flatMap(([, counts]) => [counts.follow, counts.complete])));
  return <>
    <ChartHeading title="Audit Records by State" subtitle="Follow-ups and completions recorded in the selected period" />
    <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>{[{ label: 'Follow-ups', value: followUps.length, color: t.primary }, { label: 'Completions', value: completions.length, color: t.success }].map((item) => <Typography key={item.label} sx={{ fontSize: 12, color: t.muted }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, mr: .75, borderRadius: 1, bgcolor: item.color }} />{item.label} <Box component="strong" sx={{ color: t.heading }}>{state.loading || state.error ? '—' : number(item.value)}</Box></Typography>)}</Stack>
    <ChartState {...state} empty={!rows.length}>
      <Stack spacing={1.5}>{rows.map(([name, counts]) => <Box key={name}><Typography sx={{ fontSize: 12, fontWeight: 600, mb: .5 }}>{name}</Typography>{[{ value: counts.follow, label: 'Follow-ups', color: t.primary }, { value: counts.complete, label: 'Completions', color: t.success }].map((series) => <Stack key={series.label} direction="row" alignItems="center" gap={1} sx={{ mb: .5 }}><Typography sx={{ width: 76, fontSize: 10, color: t.muted }}>{series.label}</Typography><Box role="img" aria-label={`${name}, ${series.label}: ${series.value}`} sx={{ flex: 1, height: 10, bgcolor: t.background, borderRadius: 5 }}><Box className="dashboard-chart-mark" sx={{ width: `${series.value / max * 100}%`, height: '100%', bgcolor: series.color, borderRadius: 5 }} /></Box><Typography sx={{ width: 38, textAlign: 'right', fontSize: 12, fontWeight: 650 }}>{number(series.value)}</Typography></Stack>)}</Box>)}</Stack>
    </ChartState>
  </>;
}

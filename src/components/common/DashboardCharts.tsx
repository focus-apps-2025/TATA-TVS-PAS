import { useId, useState } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
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
  const categories = [
    { label: 'Present', count: present, color: '#159C8C', lightColor: '#D3F4EE' },
    { label: 'Absent', count: absent, color: '#BE6653', lightColor: '#FBE8E5' },
    { label: 'Comp-off', count: compoff, color: '#D97706', lightColor: '#FEF3C7' },
    { label: 'Paid Leave', count: paidLeave, color: '#2563EB', lightColor: '#DBEAFE' },
    { label: 'Travel', count: travel, color: '#7C3AED', lightColor: '#EDE9FE' },
  ];

  const totalDetermined = present + absent + compoff + paidLeave + travel;
  const workforceTotal = totalStaff !== undefined ? totalStaff : (totalDetermined + notSet);
  const activeAvailability = workforceTotal > 0 ? ((present + travel) / workforceTotal) * 100 : 0;
  const circumference = 2 * Math.PI * 64;

  // Build SVG multi-segment donut
  let accumulatedPercent = 0;
  const donutSegments = categories
    .filter((cat) => cat.count > 0 && workforceTotal > 0)
    .map((cat) => {
      const share = (cat.count / workforceTotal) * 100;
      const strokeDashoffset = -1 * (circumference * accumulatedPercent / 100);
      const strokeDasharray = `${circumference * share / 100} ${circumference}`;
      accumulatedPercent += share;
      return { ...cat, strokeDashoffset, strokeDasharray, share };
    });

  return (
    <>
      <ChartHeading
        title="Attendance & Workforce Availability"
      />
      <ChartState {...state} empty={workforceTotal === 0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Top Analytical Donut */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
              <svg viewBox="0 0 180 180" width="150" height="150" role="img" aria-label="Workforce attendance chart">
                <circle cx="90" cy="90" r="64" fill="none" stroke="#E9EFF6" strokeWidth="18" />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.label}
                    className="dashboard-chart-mark"
                    cx="90"
                    cy="90"
                    r="64"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    transform="rotate(-90 90 90)"
                  />
                ))}
                <text x="90" y="85" textAnchor="middle" fill={t.heading} fontSize="26" fontWeight="750">
                  {activeAvailability.toFixed(1)}%
                </text>
                <text x="90" y="105" textAnchor="middle" fill={t.muted} fontSize="9.5" fontWeight="600" letterSpacing="0.5px">
                  AVAILABLE
                </text>
              </svg>
            </Box>
          </Box>

          {/* Unified Multi-Segment Bar */}
          <Box
            aria-hidden="true"
            sx={{
              height: 7,
              display: 'flex',
              borderRadius: 3.5,
              overflow: 'hidden',
              bgcolor: '#E9EFF6',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {categories.map((cat) => (
              <Box
                key={cat.label}
                sx={{
                  width: workforceTotal > 0 ? `${(cat.count / workforceTotal) * 100}%` : '0%',
                  bgcolor: cat.color,
                  transition: 'width 0.4s ease',
                }}
                title={`${cat.label}: ${cat.count}`}
              />
            ))}
          </Box>

          {/* Analytical Category Breakdown Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1 }}>
            {categories.map((cat) => {
              const share = workforceTotal > 0 ? (cat.count / workforceTotal) * 100 : 0;
              return (
                <Box
                  key={cat.label}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: '#FFFFFF',
                    border: `1px solid ${t.border}`,
                    borderLeft: `3.5px solid ${cat.color}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontSize: 11.5, fontWeight: 650, color: t.heading }}>
                      {cat.label}
                    </Typography>
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: cat.color,
                      }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 750, color: cat.color }}>
                      {number(cat.count)}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: t.muted }}>
                      {share.toFixed(1)}%
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        </Box>
      </ChartState>
    </>
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
  const bar = (item: Point, parentMax: number) => <Box key={item.label} sx={{ py: .75 }}>
    <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mb: .75 }}><Typography sx={{ fontSize: 12, fontWeight: 550, overflowWrap: 'anywhere' }}>{item.label}</Typography><Typography sx={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{number(item.count)}</Typography></Stack>
    <Box role="img" aria-label={`${item.label}: ${item.count} teams`} sx={{ height: 10, borderRadius: 5, bgcolor: t.background }}><Box className="dashboard-chart-mark" sx={{ height: '100%', width: `${item.count / parentMax * 100}%`, borderRadius: 5, background: `linear-gradient(90deg, ${t.primary}, ${t.primaryLight})` }} /></Box>
  </Box>;
  return <>
    <ChartHeading title="Audit Portfolio Composition" action={<Stack direction="row"><Button size="small" aria-pressed={!grouped} variant={!grouped ? 'outlined' : 'text'} onClick={() => setGrouped(false)}>Bars</Button><Button size="small" aria-pressed={grouped} variant={grouped ? 'outlined' : 'text'} onClick={() => setGrouped(true)}>Grouped</Button></Stack>} />
    <ChartState {...state} empty={!total}>
      {grouped ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{[...groups].map(([parent, children]) => <Box key={parent} sx={{ p: 1.5, bgcolor: '#F8FAFE', borderRadius: 2, borderLeft: `3px solid ${t.primary}` }}><Typography sx={{ fontSize: 13, fontWeight: 700, mb: children.length ? .5 : 0 }}>{parent} <Box component="span" sx={{ float: 'right', color: t.muted }}>{parentTotals.get(parent) || 0}</Box></Typography>{children.map((item) => bar(item, max))}</Box>)}</Box> : <Stack gap={.75}>{sorted.map((item) => bar(item, max))}</Stack>}
    </ChartState>
  </>;
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

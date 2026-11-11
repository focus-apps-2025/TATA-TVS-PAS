import { useEffect, useId, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
  const circumference = 2 * Math.PI * 68;

  // Active presence slice
  const availableShare = Math.min(100, Math.max(0, activeAvailability));
  const activeStrokeDash = `${(circumference * availableShare) / 100} ${circumference}`;

  const calcPercent = (val: number) => (workforceTotal > 0 ? ((val / workforceTotal) * 100).toFixed(1) : '0.0');

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 2.5 }}>
        <Box sx={{ bgcolor: '#EFF6FF', p: 0.75, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PersonIcon sx={{ fontSize: 22, color: '#1D4ED8' }} />
        </Box>
        <Typography component="h2" sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 750, color: '#0F172A' }}>
          Attendance &amp; Workforce Availability
        </Typography>
      </Stack>

      <ChartState {...state} empty={workforceTotal === 0}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '190px 1fr 1fr' },
            gap: { xs: 2.5, md: 3 },
            alignItems: 'center',
            p: { xs: 1.5, md: 2.5 },
            bgcolor: '#FFFFFF',
            borderRadius: 3,
            minHeight: 220,
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
              pr: { sm: 2 },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 154,
                height: 154,
                p: 1,
                borderRadius: '50%',
                bgcolor: '#F8FAFC',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 170 170" width="144" height="144" role="img" aria-label="Workforce attendance chart">
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
                <Typography sx={{ fontSize: 25, fontWeight: 850, color: '#0F172A', lineHeight: 1.1 }}>
                  {activeAvailability.toFixed(1)}%
                </Typography>
                <Typography sx={{ fontSize: 10, fontWeight: 750, color: '#64748B', letterSpacing: '0.8px', mt: 0.5 }}>
                  AVAILABLE
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Middle Column: Present & Absent */}
          <Stack spacing={2} sx={{ width: '100%' }}>
            {/* Present Card */}
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #ECFDF5 0%, #E0FBEF 100%)',
                border: '1.5px solid #A7F3D0',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.15)',
                },
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.25,
                  bgcolor: '#FFFFFF',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.15)',
                  flexShrink: 0,
                }}
              >
                <PersonIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#047857', letterSpacing: '0.2px' }}>Present</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{ fontSize: 22, fontWeight: 850, color: '#065F46' }}>
                    {number(present)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 650, color: '#059669' }}>
                    ({calcPercent(present)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Absent Card */}
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                border: '1.5px solid #FECACA',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(239, 68, 68, 0.15)',
                },
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.25,
                  bgcolor: '#FFFFFF',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)',
                  flexShrink: 0,
                }}
              >
                <PersonIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', letterSpacing: '0.2px' }}>Absent</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{ fontSize: 22, fontWeight: 850, color: '#991B1B' }}>
                    {number(absent)}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 650, color: '#DC2626' }}>
                    ({calcPercent(absent)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Stack>

          {/* Right Column: Comp-off, Paid Leave, Travel */}
          <Stack spacing={1.5} sx={{ width: '100%' }}>
            {/* Comp-off Card */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '1.5px solid #FDE68A',
                boxShadow: '0 3px 10px rgba(217, 119, 6, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 5px 14px rgba(217, 119, 6, 0.12)' },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.15)',
                  flexShrink: 0,
                }}
              >
                <AccessTimeIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#92400E' }}>Comp-off</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{ fontSize: 17, fontWeight: 850, color: '#78350F' }}>
                    {number(compoff)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 650, color: '#B45309' }}>
                    ({calcPercent(compoff)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Paid Leave Card */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                border: '1.5px solid #BFDBFE',
                boxShadow: '0 3px 10px rgba(37, 99, 235, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 5px 14px rgba(37, 99, 235, 0.12)' },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
                  flexShrink: 0,
                }}
              >
                <CalendarMonthIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF' }}>Paid Leave</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{ fontSize: 17, fontWeight: 850, color: '#1E3A8A' }}>
                    {number(paidLeave)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 650, color: '#2563EB' }}>
                    ({calcPercent(paidLeave)}%)
                  </Typography>
                </Stack>
              </Box>
            </Box>

            {/* Travel Card */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
                border: '1.5px solid #E9D5FF',
                boxShadow: '0 3px 10px rgba(147, 51, 234, 0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-1.5px)', boxShadow: '0 5px 14px rgba(147, 51, 234, 0.12)' },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  color: '#9333EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(147, 51, 234, 0.15)',
                  flexShrink: 0,
                }}
              >
                <FlightTakeoffIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#6B21A8' }}>Travel</Typography>
                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography sx={{ fontSize: 17, fontWeight: 850, color: '#581C87' }}>
                    {number(travel)}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 650, color: '#7E22CE' }}>
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

export function RankedChart({
  items,
  allItems,
  ...state
}: StateProps & {
  items: Point[];
  allItems?: Point[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [useAllSites, setUseAllSites] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = window.setTimeout(() => setCopyFeedback(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  async function copyChartImage() {
    if (!containerRef.current || copying) return;
    setCopying(true);
    setCopyFeedback('');
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll<HTMLElement>('.dashboard-chart-mark').forEach((el) => {
            el.style.animation = 'none';
            el.style.opacity = '1';
          });
        },
      });
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!image || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image copy unavailable');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
      setCopyFeedback('Portfolio chart copied to clipboard');
    } catch {
      setCopyFeedback('Unable to copy portfolio image');
    } finally {
      setCopying(false);
    }
  }

  const activeItems = useAllSites && allItems && allItems.length > 0 ? allItems : items;

  interface AggregatedBucket {
    label: string;
    count: number;
    color: string;
    bg: string;
  }

  // Group items clearly into primary categories: TVS, TATA, 3W-TVS, and Other
  const aggregated: AggregatedBucket[] = useMemo(() => {
    const buckets: Record<string, AggregatedBucket> = {
      TVS: { label: 'TVS', count: 0, color: '#004F98', bg: '#EFF6FF' },
      TATA: { label: 'TATA', count: 0, color: '#D35400', bg: '#FFF7ED' },
      '3W-TVS': { label: '3W-TVS', count: 0, color: '#0F766E', bg: '#F0FDFA' },
      Other: { label: 'Other', count: 0, color: '#64748B', bg: '#F8FAFC' },
    };

    activeItems.forEach((item) => {
      const upper = item.label.toUpperCase();
      if (upper.includes('3W') || upper.includes('3W-TVS')) {
        buckets['3W-TVS'].count += item.count;
      } else if (upper.includes('TATA')) {
        buckets['TATA'].count += item.count;
      } else if (upper.includes('TVS')) {
        buckets['TVS'].count += item.count;
      } else {
        buckets['Other'].count += item.count;
      }
    });

    const list: AggregatedBucket[] = [buckets['TVS'], buckets['TATA'], buckets['3W-TVS']];
    if (buckets['Other'].count > 0) {
      list.push(buckets['Other']);
    }
    return list;
  }, [activeItems]);

  const total = aggregated.reduce((sum: number, item: AggregatedBucket) => sum + item.count, 0);
  const max = Math.max(1, ...aggregated.map((item: AggregatedBucket) => item.count));

  // Determine Y-axis max rounded nicely
  const yTicks = [0, Math.ceil(max * 0.33), Math.ceil(max * 0.66), Math.ceil(max * 1.05)];
  const chartHeight = 160;

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Typography component="h2" sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 750, color: '#0F172A' }}>
          Audit Type Distribution
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" data-html2canvas-ignore="true" flexWrap="wrap">
          {allItems && allItems.length > 0 && (
            <Stack direction="row" sx={{ bgcolor: '#F1F5F9', borderRadius: 2, p: 0.35 }}>
              <Button
                size="small"
                aria-pressed={!useAllSites}
                onClick={() => setUseAllSites(false)}
                sx={{
                  fontSize: 11.5,
                  py: 0.35,
                  px: 1,
                  bgcolor: !useAllSites ? '#FFFFFF' : 'transparent',
                  color: !useAllSites ? '#004F98' : '#64748B',
                  boxShadow: !useAllSites ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontWeight: !useAllSites ? 750 : 500,
                  borderRadius: 1.5,
                }}
              >
                Period ({items.reduce((s, x) => s + x.count, 0)})
              </Button>
              <Button
                size="small"
                aria-pressed={useAllSites}
                onClick={() => setUseAllSites(true)}
                sx={{
                  fontSize: 11.5,
                  py: 0.35,
                  px: 1,
                  bgcolor: useAllSites ? '#FFFFFF' : 'transparent',
                  color: useAllSites ? '#004F98' : '#64748B',
                  boxShadow: useAllSites ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  fontWeight: useAllSites ? 750 : 500,
                  borderRadius: 1.5,
                }}
              >
                All ({allItems.reduce((s, x) => s + x.count, 0)})
              </Button>
            </Stack>
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={copyChartImage}
            disabled={copying || !total}
            startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
            sx={{
              fontSize: 11.5,
              py: 0.45,
              px: 1.25,
              whiteSpace: 'nowrap',
              borderColor: '#CBD5E1',
              color: '#334155',
              bgcolor: '#FFFFFF',
              borderRadius: 1.75,
              '&:hover': { bgcolor: '#F8FAFC', borderColor: '#94A3B8' },
            }}
          >
            {copying ? 'Copying…' : 'Copy'}
          </Button>
        </Stack>
      </Stack>

      {copyFeedback && (
        <Typography role="status" data-html2canvas-ignore="true" sx={{ fontSize: 11.5, mb: 1, color: copyFeedback.startsWith('Unable') ? t.danger : t.success, fontWeight: 650 }}>
          {copyFeedback}
        </Typography>
      )}

      <ChartState {...state} empty={!total}>
        <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: '#FFFFFF', borderRadius: 3 }}>
          {/* Vertical Columns Bar Chart Container */}
          <Box sx={{ position: 'relative', height: chartHeight + 60, pt: 2, display: 'flex' }}>
            {/* Y-axis Ticks */}
            <Box sx={{ width: 44, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pb: 4.5, pr: 1.5 }}>
              {[...yTicks].reverse().map((tick, i) => (
                <Typography key={i} sx={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textAlign: 'right' }}>
                  {tick}
                </Typography>
              ))}
            </Box>

            {/* Chart Area with subtle grid lines */}
            <Box sx={{ flex: 1, position: 'relative', borderBottom: '2px solid #E2E8F0', borderLeft: '1px solid #E2E8F0' }}>
              {/* Background Grid Lines */}
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pb: 0.5, pointerEvents: 'none' }}>
                {yTicks.map((_, i) => (
                  <Box key={i} sx={{ borderTop: i === 0 ? 'none' : '1px dashed #F1F5F9', width: '100%' }} />
                ))}
              </Box>

              {/* Columns container */}
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', px: { xs: 1, md: 3 } }}>
                {aggregated.map((item) => {
                  const barHeight = max > 0 ? (item.count / max) * chartHeight : 0;
                  return (
                    <Box
                      key={item.label}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: { xs: 55, sm: 80, md: 100 },
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'scale(1.03)' },
                      }}
                    >
                      {/* Count value on top of bar */}
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: item.color, mb: 0.75 }}>
                        {number(item.count)}
                      </Typography>

                      {/* Vertical Column Bar */}
                      <Box
                        className="dashboard-chart-mark"
                        sx={{
                          width: '100%',
                          height: Math.max(8, barHeight),
                          bgcolor: item.color,
                          borderRadius: '8px 8px 0 0',
                          boxShadow: `0 4px 12px ${item.color}33`,
                          transition: 'height 0.4s ease-out',
                        }}
                      />

                      {/* Label below axis */}
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 750,
                          color: '#334155',
                          mt: 1.25,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>

          {/* Subtext info */}
          <Stack direction="row" spacing={3} justifyContent="center" sx={{ mt: 3, pt: 1.5, borderTop: '1px solid #F1F5F9' }}>
            {aggregated.map((item) => (
              <Stack key={item.label} direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                <Typography sx={{ fontSize: 12, fontWeight: 650, color: '#475569' }}>
                  {item.label}: <strong style={{ color: '#0F172A' }}>{number(item.count)}</strong> ({total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%)
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
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
    <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>{[{ label: 'Follow-ups', value: followUps.length, color: t.primary }, { label: 'Completions', value: t.success }].map((item) => <Typography key={item.label} sx={{ fontSize: 12, color: t.muted }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, mr: .75, borderRadius: 1, bgcolor: item.color }} />{item.label} <Box component="strong" sx={{ color: t.heading }}>{state.loading || state.error ? '—' : number(item.label === 'Follow-ups' ? followUps.length : completions.length)}</Box></Typography>)}</Stack>
    <ChartState {...state} empty={!rows.length}>
      <Stack spacing={1.5}>{rows.map(([name, counts]) => <Box key={name}><Typography sx={{ fontSize: 12, fontWeight: 600, mb: .5 }}>{name}</Typography>{[{ value: counts.follow, label: 'Follow-ups', color: t.primary }, { value: counts.complete, label: 'Completions', color: t.success }].map((series) => <Stack key={series.label} direction="row" alignItems="center" gap={1} sx={{ mb: .5 }}><Typography sx={{ width: 76, fontSize: 10, color: t.muted }}>{series.label}</Typography><Box role="img" aria-label={`${name}, ${series.label}: ${series.value}`} sx={{ flex: 1, height: 10, bgcolor: t.background, borderRadius: 5 }}><Box className="dashboard-chart-mark" sx={{ width: `${series.value / max * 100}%`, height: '100%', bgcolor: series.color, borderRadius: 5 }} /></Box><Typography sx={{ width: 38, textAlign: 'right', fontSize: 12, fontWeight: 650 }}>{number(series.value)}</Typography></Stack>)}</Box>)}</Stack>
    </ChartState>
  </>;
}

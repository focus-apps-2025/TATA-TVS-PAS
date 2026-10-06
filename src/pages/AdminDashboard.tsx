import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import api from '../services/api';
import type { Team } from '../services/api';
import authManager from '../services/authSession';
import { RankedChart, AttendanceChart, AuditStateComparison, ScanContributionChart } from '../components/common/DashboardCharts';
import { ChartHeading, ChartState } from '../components/common/DashboardPrimitives';
import { dashboardTokens as t } from '../components/common/dashboardTheme';

interface DailyActivityTeam {
  teamId: string; teamName: string; auditType: string; location: string; totalScans: number;
  members: { id: string; name: string; email: string; role: string; scanCount: number }[];
}
type AuditRecord = {
  state?: string; quoteDate?: string; startingDate?: string; endDate?: string;
  createdAt?: string; month?: string; [field: string]: unknown;
};
type AttendanceSummary = {
  totalStaff: number;
  present: number;
  absent: number;
  compoff?: number;
  paidLeave?: number;
  travel?: number;
  notSet?: number;
};
type AttendanceResponse = { summary?: AttendanceSummary };
type DataResponse<T> = { data?: T };
type Range = { from: string; to: string };
type Errors = Partial<Record<'activity' | 'attendance' | 'portfolio' | 'followups' | 'completions' | 'workspace', string>>;
const currentIndiaDate = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const countAuditTypes = (records: Team[]) => {
  const grouped = records.reduce((counts: Record<string, number>, record) => {
    const auditType = String(record.auditType || '').trim();
    const subcategory = String(record.subcategory || '').trim();
    // Keep the main audit type visible alongside any free-text category,
    // for example "TATA · JBM" or "TVS · HONDA".
    const auditLabel = auditType === '3w-tvs' ? '3W TVS' : auditType || 'Not specified';
    const label = subcategory ? `${auditLabel} · ${subcategory}` : auditLabel;
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});

  return Object.entries(grouped)
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => first.label.localeCompare(second.label));
};
const parseDashboardDate = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}` : null;
};
const isWithinDashboardRange = (record: Record<string, unknown>, from: string, to: string, fields: string[]) => {
  const date = fields.map((field) => parseDashboardDate(record?.[field])).find(Boolean);
  return Boolean(date && date >= from && date <= to);
};
const isCompletionInRange = (record: AuditRecord, from: string, to: string) => {
  // Completions are saved in a month bucket; audit start/end dates may be
  // outside that reporting month, so the bucket takes precedence.
  if (typeof record.month === 'string' && /^\d{4}-\d{2}$/.test(record.month)) {
    const month = record.month;
    return month >= from.slice(0, 7) && month <= to.slice(0, 7);
  }
  return isWithinDashboardRange(record, from, to, ['endDate', 'startingDate', 'createdAt']);
};


const shiftDay = (date: string, days: number) => {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const previousRange = ({ from, to }: Range): Range => {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  return { from: shiftDay(from, -days), to: shiftDay(from, -1) };
};

const formatDate = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const availability = (summary: { present: number; absent: number; travel?: number; totalStaff?: number }) => {
  const total = summary.totalStaff !== undefined && summary.totalStaff > 0
    ? summary.totalStaff
    : summary.present + summary.absent + (summary.travel || 0);
  return total ? ((summary.present + (summary.travel || 0)) / total) * 100 : 0;
};

export default function AdminDashboard() {
  const summaryCaptureRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    teams: 0,
    currentSites: 0,
    totalTeamMembers: 0,
    presentStaff: 0,
    absentStaff: 0,
    compoffStaff: 0,
    paidLeaveStaff: 0,
    travelStaff: 0,
    notSetStaff: 0,
    totalRacks: 0,
    masterItems: 0,
  });
  const [teamsByAuditType, setTeamsByAuditType] = useState<{ label: string; count: number }[]>([]);
  const [followUpRecords, setFollowUpRecords] = useState<AuditRecord[]>([]);
  const [completionRecords, setCompletionRecords] = useState<AuditRecord[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityTeam[]>([]);
  const [fromDate, setFromDate] = useState(currentIndiaDate());
  const [toDate, setToDate] = useState(currentIndiaDate());
  const [appliedRange, setAppliedRange] = useState<Range>({ from: currentIndiaDate(), to: currentIndiaDate() });
  const rangeRef = useRef(appliedRange);
  const [preset, setPreset] = useState('Today');
  const [customOpen, setCustomOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [previous, setPrevious] = useState<(number | undefined)[]>([]);
  const [copyingDashboard, setCopyingDashboard] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [onlyActiveTeams, setOnlyActiveTeams] = useState(false);

  const visibleTeams = dailyActivity.filter((team) => {
    if (onlyActiveTeams && team.totalScans === 0) return false;
    if (!teamSearch.trim()) return true;
    const q = teamSearch.toLowerCase();
    return (
      team.teamName.toLowerCase().includes(q) ||
      (team.location && team.location.toLowerCase().includes(q)) ||
      team.auditType.toLowerCase().includes(q) ||
      team.members.some((m) => m.name.toLowerCase().includes(q))
    );
  });

  async function loadDashboardData(range = rangeRef.current) {
    const id = ++requestId.current;
    setIsDataLoading(true);
    setErrors({});
    const failures: Errors = {};
    const safe = async <T,>(key: keyof Errors, request: Promise<T>, fallback: T): Promise<T> => {
      try { return await request; } catch { failures[key] = 'The data request failed. Please retry.'; return fallback; }
    };
    try {
      const currentUser = await authManager.getCurrentUser();
      const siteManagerMode = currentUser?.role === 'site_manager';
      const { from, to } = range;
      const previousPeriod = previousRange(range);
      const [users, teams, racks, masterData, followUps, completions, activity, attendance, priorActivity, priorAttendance] = await Promise.all([
        siteManagerMode ? [] : safe('workspace', api.getAllUsers(), []),
        safe('portfolio', api.getTeams(), []),
        safe('workspace', api.getRacks({ limit: 1 }), { racks: [], totalCount: 0 }),
        siteManagerMode ? { data: [] as unknown[] } : safe('workspace', api.getUploadedFilesMetadata() as Promise<DataResponse<unknown[]>>, { data: [] }),
        siteManagerMode ? { data: [] as AuditRecord[] } : safe('followups', api.getAuditFollowUps() as Promise<DataResponse<AuditRecord[]>>, { data: [] }),
        siteManagerMode ? { data: [] as AuditRecord[] } : safe('completions', api.getAuditCompletions() as Promise<DataResponse<AuditRecord[]>>, { data: [] }),
        siteManagerMode ? { data: [] as DailyActivityTeam[] } : safe('activity', api.getDailyTeamActivity(from, to) as Promise<DataResponse<DailyActivityTeam[]>>, { data: [] }),
        siteManagerMode ? { summary: { totalStaff: 0, present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0, notSet: 0 } } : safe('attendance', api.getTeamAttendance({ from, to }) as Promise<AttendanceResponse>, { summary: { totalStaff: 0, present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0, notSet: 0 } }),
        siteManagerMode ? null : (api.getDailyTeamActivity(previousPeriod.from, previousPeriod.to) as Promise<DataResponse<DailyActivityTeam[]>>).catch(() => null),
        siteManagerMode ? null : (api.getTeamAttendance(previousPeriod) as Promise<AttendanceResponse>).catch(() => null),
      ]);
      if (id !== requestId.current) return;
      const periodTeams = (teams || []).filter((team) => String(team.status || '').toLowerCase() !== 'archived');
      const summary = attendance.summary || { totalStaff: 0, present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0, notSet: 0 };
      setStats({
        users: users?.length || 0,
        teams: periodTeams.length,
        currentSites: (teams || []).filter((team) => isWithinDashboardRange(team, from, to, ['createdAt'])).length,
        totalTeamMembers: summary.totalStaff || 0,
        presentStaff: summary.present || 0,
        absentStaff: summary.absent || 0,
        compoffStaff: summary.compoff || 0,
        paidLeaveStaff: summary.paidLeave || 0,
        travelStaff: summary.travel || 0,
        notSetStaff: summary.notSet || 0,
        totalRacks: racks.totalCount || 0,
        masterItems: siteManagerMode ? 0 : masterData.data?.length || 0,
      });
      setTeamsByAuditType(countAuditTypes(periodTeams));
      const followFields = ['quoteDate', 'createdAt'];
      const follows = followUps.data || [];
      const completed = completions.data || [];
      setFollowUpRecords(follows.filter((record) => isWithinDashboardRange(record, from, to, followFields)));
      setCompletionRecords(completed.filter((record) => isCompletionInRange(record, from, to)));
      setDailyActivity(activity.data || []);
      const oldTeams = priorActivity?.data;
      const oldPeriodTeams = (teams || []).filter((team) => String(team.status || '').toLowerCase() !== 'archived');
      setPrevious([
        users?.length, // Users count
        oldPeriodTeams.length, // Active sites
        (teams || []).filter((team) => isWithinDashboardRange(team, previousPeriod.from, previousPeriod.to, ['createdAt'])).length, // Current sites in prior period
        oldTeams?.reduce((sum, team) => sum + team.totalScans, 0),
        oldTeams?.filter((team) => team.totalScans > 0).length,
      ]);
      setErrors(failures);
    } catch {
      if (id === requestId.current) setErrors(Object.fromEntries(['activity', 'attendance', 'portfolio', 'followups', 'completions', 'workspace'].map((key) => [key, 'Unable to load dashboard data. Please retry.'])));
    } finally {
      if (id === requestId.current) setIsDataLoading(false);
    }
  }
  useEffect(() => {
    void loadDashboardData();
    const refresh = () => { void loadDashboardData(); };
    const requests = requestId;
    window.addEventListener('admin-refresh', refresh);
    return () => { requests.current++; window.removeEventListener('admin-refresh', refresh); };
  }, []);
  useEffect(() => {
    if (!copyFeedback) return;
    const timeout = window.setTimeout(() => setCopyFeedback(''), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  function applyRange(range: Range) {
    if (!range.from || !range.to || range.from > range.to) return;
    rangeRef.current = range;
    setAppliedRange(range);
    setFromDate(range.from);
    setToDate(range.to);
    void loadDashboardData(range);
  }
  function selectPreset(label: string, days: number) {
    setPreset(label);
    setCustomOpen(false);
    const today = currentIndiaDate();
    applyRange({ from: shiftDay(today, -(days - 1)), to: today });
  }
  function changeDateRange() {
    setCustomOpen(true);
    setPreset('Custom');
    requestAnimationFrame(() => { dateInputRef.current?.focus(); dateInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }
  async function copyDashboardImage() {
    if (!summaryCaptureRef.current || copyingDashboard) return;
    setCopyingDashboard(true);
    setCopyFeedback('');
    try {
      const canvas = await html2canvas(summaryCaptureRef.current, {
        backgroundColor: t.background, scale: 2, useCORS: true,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: Math.max(document.documentElement.clientHeight, summaryCaptureRef.current.scrollHeight),
        onclone: (document) => {
          document.querySelectorAll<HTMLElement>('.dashboard-chart-mark').forEach((element) => { element.style.animation = 'none'; element.style.opacity = '1'; });
          document.querySelectorAll<HTMLElement>('[data-chart-overflow]').forEach((element) => { element.style.overflow = 'visible'; });
          document.querySelectorAll<SVGElement>('[data-dashboard-chart]').forEach((element) => { element.style.minWidth = '0'; element.style.width = '100%'; });
        },
      });
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!image || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image copy unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
      setCopyFeedback('Dashboard image copied');
    } catch { setCopyFeedback('Unable to copy image'); } finally { setCopyingDashboard(false); }
  }
  const shared = { loading: isDataLoading, onChangeRange: changeDateRange, onRetry: () => { void loadDashboardData(); } };
  const todayDate = currentIndiaDate();
  const todayCreatedSites = (dailyActivity ? stats.currentSites : 0);
  const activeSitesCount = stats.teams; // active non-archived sites/teams

  const metrics = [
    { label: 'Total Users', value: stats.users, error: errors.workspace },
    { label: 'Active Sites', value: activeSitesCount, error: errors.portfolio },
    { label: 'Current Sites', value: stats.currentSites, caption: 'Created today', error: errors.portfolio },
    { label: 'Total Scans', value: dailyActivity.reduce((sum, team) => sum + team.totalScans, 0), error: errors.activity },
    { label: 'Teams Recorded Scans', value: dailyActivity.filter((team) => team.totalScans > 0).length, error: errors.activity },
  ];
  return <Box ref={summaryCaptureRef} sx={{
    minHeight: '100%', bgcolor: t.background, color: t.text, p: { xs: 2, lg: 3 },
    fontFamily: 'Inter, Arial, sans-serif', fontStyle: 'normal', fontVariantNumeric: 'tabular-nums',
    '& *, & .MuiTypography-root, & input, & button': { fontStyle: 'normal', fontFamily: 'inherit' },
    '& button': { textTransform: 'none' }, '& svg text': { fontFamily: 'Inter, Arial, sans-serif' },
    '& .dashboard-chart-mark': { animation: 'dashboardReveal 400ms ease both' },
    '@keyframes dashboardReveal': { from: { opacity: 0 }, to: { opacity: 1 } },
    '@media (prefers-reduced-motion: reduce)': { '& *, & .dashboard-chart-mark': { animation: 'none', transition: 'none' } },
  }}>
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }} gap={2} sx={{ mb: 2 }}>
      <Box><Typography component="h1" sx={{ fontSize: { xs: 23, md: 27 }, fontWeight: 750, letterSpacing: '-.6px', color: t.heading }}>Parts Audit Summary</Typography></Box>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <Chip icon={<CalendarMonthIcon />} label={formatDate(appliedRange.from) + ' – ' + formatDate(appliedRange.to)} onClick={changeDateRange} variant="outlined" sx={{ bgcolor: t.surface, borderColor: t.border, fontSize: 12 }} />
        <Stack data-html2canvas-ignore="true" direction="row" sx={{ bgcolor: '#E9EFF7', borderRadius: 2, p: .5 }}>
          {['Today', '7D', '30D', 'Custom'].map((label, i) => <Button key={label} size="small" aria-pressed={preset === label} onClick={() => label === 'Custom' ? changeDateRange() : selectPreset(label, [1, 7, 30][i])} sx={{ minWidth: 48, fontSize: 12, bgcolor: preset === label ? t.surface : 'transparent', color: preset === label ? t.primary : t.muted }}>{label}</Button>)}
        </Stack>
        <Button data-html2canvas-ignore="true" variant="contained" disableElevation size="small" onClick={copyDashboardImage} disabled={copyingDashboard || isDataLoading} startIcon={<ContentCopyIcon />} sx={{ bgcolor: t.primary, py: 1, borderRadius: 2 }}>{copyingDashboard ? 'Copying…' : 'Copy image'}</Button>
      </Stack>
    </Stack>
    {customOpen && <Stack data-html2canvas-ignore="true" direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mb: 2 }}><TextField inputRef={dateInputRef} label="From" type="date" size="small" value={fromDate} onChange={(event) => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} /><TextField label="To" type="date" size="small" value={toDate} onChange={(event) => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: fromDate }} /><Button variant="contained" disableElevation disabled={!fromDate || !toDate || fromDate > toDate} onClick={() => { setPreset('Custom'); applyRange({ from: fromDate, to: toDate }); }}>Apply range</Button></Stack>}
    {copyFeedback && <Typography role="status" data-html2canvas-ignore="true" sx={{ fontSize: 12, mb: 1, color: copyFeedback.startsWith('Unable') ? t.danger : t.success }}>{copyFeedback}</Typography>}
    <Box sx={{ bgcolor: t.surface, border: `1px solid ${t.border}`, borderRadius: 4, boxShadow: t.shadow, overflow: 'hidden' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, borderBottom: `1px solid ${t.border}` }}>
        {metrics.map((metric, i) => <Box key={metric.label} component="section" sx={{ px: { xs: 2, md: 2.5 }, py: 2, minWidth: 0, borderRight: { xs: i % 2 === 0 ? `1px solid ${t.border}` : 'none', lg: i < 4 ? `1px solid ${t.border}` : 'none' }, borderBottom: { xs: i < 4 ? `1px solid ${t.border}` : 'none', lg: 'none' } }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontSize: 11, color: t.muted, fontWeight: 700, letterSpacing: '.18px', textTransform: 'uppercase' }}>{metric.label}</Typography>
            {metric.caption && <Typography sx={{ fontSize: 10, color: t.primary, fontWeight: 650, bgcolor: '#EEF4FF', px: 0.75, py: 0.15, borderRadius: 1 }}>{metric.caption}</Typography>}
          </Stack>
          {isDataLoading ? <Box sx={{ height: 36, width: '55%', bgcolor: '#E8EFF8', borderRadius: 1.5, mt: 1 }} /> : metric.error ? <Typography sx={{ mt: 1, fontSize: 12, color: t.danger }}>Unavailable</Typography> : <Typography sx={{ mt: .5, fontSize: { xs: 24, md: 29 }, lineHeight: 1.1, fontWeight: 780, letterSpacing: '-1px', color: metric.value ? t.heading : t.muted }}>{numberFormat(metric.value)}</Typography>}
        </Box>)}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
        <Box component="section" sx={{ gridColumn: { xs: 'span 12', lg: 'span 6' }, p: { xs: 2, md: 3 }, borderBottom: `1px solid ${t.border}` }}>
          <RankedChart items={teamsByAuditType} {...shared} error={errors.portfolio} />
        </Box>
        <Box component="section" sx={{ gridColumn: { xs: 'span 12', lg: 'span 6' }, p: { xs: 2, md: 3 }, borderBottom: `1px solid ${t.border}`, borderLeft: { lg: `1px solid ${t.border}` } }}>
          <AttendanceChart
            present={stats.presentStaff}
            absent={stats.absentStaff}
            compoff={stats.compoffStaff}
            paidLeave={stats.paidLeaveStaff}
            travel={stats.travelStaff}
            notSet={stats.notSetStaff}
            totalStaff={stats.totalTeamMembers}
            {...shared}
            error={errors.attendance}
          />
        </Box>
        <Box component="section" sx={{ gridColumn: 'span 12', p: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${t.border}`, bgcolor: '#F8FAFD' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} sx={{ mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 750, color: t.heading }}>
                Current Teams & User Activity
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Search team or site…"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                sx={{
                  width: { xs: '100%', sm: 220 },
                  bgcolor: '#FFFFFF',
                  borderRadius: 1,
                  '& .MuiInputBase-input': { fontSize: 12, py: 0.65, px: 1 },
                }}
              />
              <Button
                size="small"
                variant={onlyActiveTeams ? 'contained' : 'outlined'}
                onClick={() => setOnlyActiveTeams(!onlyActiveTeams)}
                sx={{ fontSize: 11.5, py: 0.6, whiteSpace: 'nowrap' }}
              >
                {onlyActiveTeams ? 'Active only' : 'All teams'}
              </Button>
            </Stack>
          </Stack>

          <ChartState {...shared} error={errors.activity} empty={!visibleTeams.length}>
            {(() => {
              const count = visibleTeams.length;
              // Dynamic column count based on team count:
              // 1 to 4 items  -> display all in 1 row (columns = count)
              // 5 to 6 items  -> 3 columns (3 x 2)
              // 7 or more     -> 4 columns (4 x 2, 4 x 3, etc.)
              const cols = count <= 4 ? Math.max(1, count) : count <= 6 ? 3 : 4;
              return (
                <Box
                  sx={{
                    maxHeight: 440,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 0.5,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: count === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                      md: `repeat(${cols}, minmax(0, 1fr))`,
                    },
                    gap: 1.5,
                  }}
                >
              {visibleTeams.map((team) => {
                const typeStyle = getAuditTypeColor(team.auditType);
                const hasScans = team.totalScans > 0;
                return (
                  <Box
                    key={team.teamId}
                    sx={{
                      bgcolor: '#FFFFFF',
                      borderRadius: 2.25,
                      border: `1.5px solid ${hasScans ? '#93C5FD' : '#E2E8F0'}`,
                      borderTop: `4px solid ${typeStyle.bar}`,
                      background: hasScans ? 'linear-gradient(180deg, #F8FAFD 0%, #FFFFFF 52px)' : '#FFFFFF',
                      boxShadow: hasScans ? '0 3px 10px rgba(37, 99, 235, 0.07)' : '0 1px 3px rgba(0,0,0,0.03)',
                      p: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minWidth: 0,
                      overflow: 'hidden',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
                        borderColor: typeStyle.bar,
                      },
                    }}
                  >
                    {/* Team Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1, minWidth: 0 }}>
                      <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, mb: 0.35 }}>
                          <Typography
                            sx={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: '#0F172A',
                              lineHeight: 1.25,
                            }}
                            noWrap
                            title={team.teamName}
                          >
                            {team.teamName}
                          </Typography>
                          <Box
                            sx={{
                              px: 0.75,
                              py: 0.15,
                              borderRadius: 1,
                              fontSize: 9.5,
                              fontWeight: 800,
                              letterSpacing: '0.3px',
                              bgcolor: typeStyle.bg,
                              color: typeStyle.color,
                              border: `1px solid ${typeStyle.border}`,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            {team.auditType}
                          </Box>
                        </Stack>
                        <Typography
                          sx={{
                            fontSize: 10.5,
                            color: '#64748B',
                          }}
                          noWrap
                          title={team.location || ''}
                        >
                          {team.location || 'No location specified'}
                        </Typography>
                      </Box>
                      {hasScans ? (
                        <Box
                          sx={{
                            px: 1,
                            py: 0.3,
                            borderRadius: '12px',
                            bgcolor: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1.5px solid #93C5FD',
                            fontSize: 11,
                            fontWeight: 850,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#2563EB' }} />
                          {numberFormat(team.totalScans)} scans
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            px: 0.9,
                            py: 0.25,
                            borderRadius: '12px',
                            bgcolor: '#F1F5F9',
                            color: '#64748B',
                            fontSize: 10.5,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          0 scans
                        </Box>
                      )}
                    </Box>

                    {/* User Activity Section */}
                    <Box sx={{ pt: 0.85, borderTop: '1px solid #F1F5F9', minHeight: 46 }}>
                      <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px', mb: 0.65 }}>
                        USER ACTIVITY
                      </Typography>
                      {team.members.length === 0 ? (
                        <Typography sx={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', py: 0.25 }}>
                          No assigned members
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                          {team.members.map((member) => (
                            <Box
                              key={member.id}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: member.scanCount > 0 ? 0.9 : 0.85,
                                py: 0.3,
                                borderRadius: '14px',
                                border: `1.5px solid ${member.scanCount > 0 ? '#059669' : '#CBD5E1'}`,
                                bgcolor: member.scanCount > 0 ? '#ECFDF5' : '#F8FAFC',
                                boxShadow: member.scanCount > 0 ? '0 1px 3px rgba(5, 150, 105, 0.12)' : 'none',
                              }}
                            >
                              <PersonIcon sx={{ fontSize: 13, color: member.scanCount > 0 ? '#059669' : '#64748B' }} />
                              <Typography sx={{ fontSize: 11, fontWeight: member.scanCount > 0 ? 750 : 650, color: member.scanCount > 0 ? '#065F46' : '#1E293B' }}>
                                {member.name}
                              </Typography>
                              {member.scanCount > 0 ? (
                                <Box
                                  sx={{
                                    px: 0.55,
                                    py: 0.05,
                                    borderRadius: '8px',
                                    bgcolor: '#059669',
                                    color: '#FFFFFF',
                                    fontSize: 10,
                                    fontWeight: 800,
                                    lineHeight: 1.2,
                                  }}
                                >
                                  {member.scanCount}
                                </Box>
                              ) : (
                                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>
                                  : 0
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          );
        })()}
            </ChartState>
        </Box>
        <Box component="section" sx={{ gridColumn: 'span 12', p: { xs: 2, md: 3 } }}>
          <AuditStateComparison followUps={followUpRecords} completions={completionRecords} {...shared} error={errors.followups || errors.completions} />
        </Box>
      </Box>
    </Box>
  </Box>;
}
const numberFormat = (value: number) => value.toLocaleString('en-IN');

const getAuditTypeColor = (type?: string) => {
  const str = String(type || '').toUpperCase();
  if (str.includes('TATA')) {
    return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', bar: '#2563EB' };
  }
  if (str.includes('3W')) {
    return { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA', bar: '#EA580C' };
  }
  if (str.includes('TVS')) {
    return { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0', bar: '#059669' };
  }
  return { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE', bar: '#7C3AED' };
};

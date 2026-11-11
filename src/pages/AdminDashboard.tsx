import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Box, Button, Chip, IconButton, InputAdornment, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import GroupsIcon from '@mui/icons-material/Groups';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SearchIcon from '@mui/icons-material/Search';
import api from '../services/api';
import type { Team } from '../services/api';
import authManager from '../services/authSession';
import { RankedChart, AttendanceChart, AuditStateComparison, ScanContributionChart } from '../components/common/DashboardCharts';
import { ChartHeading, ChartState } from '../components/common/DashboardPrimitives';
import { dashboardTokens as t } from '../components/common/dashboardTheme';

interface DailyActivityTeam {
  teamId: string; teamName: string; auditType: string; location: string; totalScans: number;
  members: { id: string; name: string; email: string; role: string; scanCount: number }[];
  createdAt?: string;
  auditStartDate?: string;
  status?: string;
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
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date(raw));
      const val = (type: string) => parts.find((p) => p.type === type)?.value || '';
      return `${val('year')}-${val('month')}-${val('day')}`;
    } catch {
      return raw.slice(0, 10);
    }
  }
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
  const teamsSectionRef = useRef<HTMLDivElement>(null);
  const [copyingTeams, setCopyingTeams] = useState(false);
  const [copyingTeamId, setCopyingTeamId] = useState<string | null>(null);
  const [teamCopyFeedback, setTeamCopyFeedback] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [onlyActiveTeams, setOnlyActiveTeams] = useState(false);
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  const teamMetaMap = useMemo(() => {
    const map = new Map<string, Team>();
    allTeams.forEach((t) => {
      const id = String(t._id || t.id || '');
      if (id) map.set(id, t);
    });
    return map;
  }, [allTeams]);

  const visibleTeams = useMemo(() => {
    const from = appliedRange.from;
    const to = appliedRange.to;
    return dailyActivity.filter((team) => {
      const meta = teamMetaMap.get(String(team.teamId));
      const recordToCheck = meta || (team as unknown as Record<string, unknown>);
      const isCurrentDateTeam = isWithinDashboardRange(
        recordToCheck as unknown as Record<string, unknown>,
        from,
        to,
        ['createdAt']
      );

      if (!isCurrentDateTeam) return false;
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
  }, [dailyActivity, teamMetaMap, appliedRange, onlyActiveTeams, teamSearch]);

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
      setAllTeams(teams || []);
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
  useEffect(() => {
    if (!teamCopyFeedback) return;
    const timeout = window.setTimeout(() => setTeamCopyFeedback(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [teamCopyFeedback]);

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

  async function copyTeamsSectionImage() {
    if (!teamsSectionRef.current || copyingTeams) return;
    setCopyingTeams(true);
    setTeamCopyFeedback('');
    try {
      const canvas = await html2canvas(teamsSectionRef.current, {
        backgroundColor: '#F8FAFD',
        scale: 2,
        useCORS: true,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: Math.max(document.documentElement.clientHeight, teamsSectionRef.current.scrollHeight),
        onclone: (document) => {
          document.querySelectorAll<HTMLElement>('[data-teams-scroll]').forEach((element) => {
            element.style.maxHeight = 'none';
            element.style.overflow = 'visible';
          });
          document.querySelectorAll<HTMLElement>('.dashboard-chart-mark').forEach((element) => {
            element.style.animation = 'none';
            element.style.opacity = '1';
          });
        },
      });
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!image || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image copy unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
      setTeamCopyFeedback('Teams section image copied to clipboard');
    } catch {
      setTeamCopyFeedback('Unable to copy teams image');
    } finally {
      setCopyingTeams(false);
    }
  }

  async function copySingleTeamImage(teamId: string, teamName: string) {
    const el = document.getElementById(`team-card-${teamId}`);
    if (!el || copyingTeamId) return;
    setCopyingTeamId(teamId);
    setTeamCopyFeedback('');
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        onclone: (document) => {
          const card = document.getElementById(`team-card-${teamId}`);
          if (card) {
            card.style.transform = 'none';
            card.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
          }
        },
      });
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!image || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image copy unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
      setTeamCopyFeedback(`"${teamName}" card copied`);
    } catch {
      setTeamCopyFeedback('Unable to copy card image');
    } finally {
      setCopyingTeamId(null);
    }
  }
  const shared = { loading: isDataLoading, onChangeRange: changeDateRange, onRetry: () => { void loadDashboardData(); } };
  const todayDate = currentIndiaDate();
  const todayCreatedSites = (dailyActivity ? stats.currentSites : 0);
  const activeSitesCount = stats.teams; // active non-archived sites/teams

  const calcTrend = (current: number, previous: number) => {
    if (previous <= 0) return { pct: '+0.0%', isUp: true };
    const diff = ((current - previous) / previous) * 100;
    const isUp = diff >= 0;
    return {
      pct: `${isUp ? '+' : ''}${diff.toFixed(1)}%`,
      isUp,
    };
  };

  const statCards = [
    {
      label: 'Total Users',
      value: stats.users,
      trend: calcTrend(stats.users, previous[0] || 0),
      icon: PeopleAltIcon,
      iconColor: '#5B4EB7',
      bg: '#EDE9FE',
      border: '#DDD6FE',
      circleBg: '#DDD6FE',
      error: errors.workspace,
    },
    {
      label: 'Active Sites',
      value: activeSitesCount,
      trend: calcTrend(activeSitesCount, previous[1] || 0),
      icon: BusinessIcon,
      iconColor: '#0284C7',
      bg: '#E0F2FE',
      border: '#BAE6FD',
      circleBg: '#BAE6FD',
      error: errors.portfolio,
    },
    {
      label: 'Current Sites',
      value: stats.currentSites,
      trend: calcTrend(stats.currentSites, previous[2] || 0),
      icon: LocationOnIcon,
      iconColor: '#059669',
      bg: '#DCFCE7',
      border: '#BBF7D0',
      circleBg: '#BBF7D0',
      error: errors.portfolio,
    },
    {
      label: 'Total Scans',
      value: dailyActivity.reduce((sum, team) => sum + team.totalScans, 0),
      trend: calcTrend(dailyActivity.reduce((sum, team) => sum + team.totalScans, 0), previous[3] || 0),
      icon: QrCodeScannerIcon,
      iconColor: '#EA580C',
      bg: '#FFEDD5',
      border: '#FED7AA',
      circleBg: '#FED7AA',
      error: errors.activity,
    },
    {
      label: 'Teams Recorded Scans',
      value: dailyActivity.filter((team) => team.totalScans > 0).length,
      trend: calcTrend(dailyActivity.filter((team) => team.totalScans > 0).length, previous[4] || 0),
      icon: GroupsIcon,
      iconColor: '#7C3AED',
      bg: '#F3E8FF',
      border: '#E9D5FF',
      circleBg: '#E9D5FF',
      error: errors.activity,
    },
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
    {/* Top Header - Concept A: Modern White Card */}
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        px: { xs: 2, md: 2.75 },
        py: 1.5,
        borderRadius: 3.5,
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        mb: 2.5,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={1.5}>
        {/* Left: Icon Badge + Title & Subtitle */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              bgcolor: '#EFF6FF',
              color: '#004F98',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,79,152,0.12)',
              flexShrink: 0,
            }}
          >
            <AssessmentIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography component="h1" sx={{ fontSize: { xs: 18, md: 20 }, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              Parts Audit Summary
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: '#64748B', mt: 0.25 }}>
              Executive overview of sites, workforce availability, and scan activities
            </Typography>
          </Box>
        </Stack>

        {/* Right: Pill Controls Cluster */}
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          {/* Date Range Selector Pill */}
          <Chip
            icon={<CalendarMonthIcon sx={{ fontSize: 15, color: '#475569' }} />}
            label={`${formatDate(appliedRange.from)} – ${formatDate(appliedRange.to)}`}
            onClick={changeDateRange}
            variant="outlined"
            sx={{
              bgcolor: '#F8FAFC',
              borderColor: '#E2E8F0',
              color: '#334155',
              fontSize: 12,
              fontWeight: 650,
              height: 34,
              borderRadius: '999px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: '#F1F5F9', borderColor: '#CBD5E1' },
            }}
          />

          {/* Segmented Preset Switch Pill */}
          <Stack direction="row" sx={{ bgcolor: '#F1F5F9', borderRadius: '999px', p: 0.35, border: '1px solid #E2E8F0' }}>
            {['Today', '7D', '30D', 'Custom'].map((label, i) => {
              const isActive = preset === label;
              return (
                <Button
                  key={label}
                  size="small"
                  aria-pressed={isActive}
                  onClick={() => (label === 'Custom' ? changeDateRange() : selectPreset(label, [1, 7, 30][i]))}
                  sx={{
                    minWidth: 46,
                    height: 28,
                    fontSize: 11.5,
                    fontWeight: isActive ? 750 : 550,
                    bgcolor: isActive ? '#004F98' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#64748B',
                    boxShadow: isActive ? '0 1px 3px rgba(0,79,152,0.25)' : 'none',
                    borderRadius: '999px',
                    textTransform: 'none',
                    px: 1.25,
                    '&:hover': {
                      bgcolor: isActive ? '#004F98' : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>

          {/* Copy Button */}
          <Button
            variant="contained"
            disableElevation
            size="small"
            onClick={copyDashboardImage}
            disabled={copyingDashboard || isDataLoading}
            startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
            sx={{
              bgcolor: '#004F98',
              height: 34,
              px: 2,
              borderRadius: '999px',
              textTransform: 'none',
              fontWeight: 650,
              fontSize: 12,
              '&:hover': { bgcolor: '#003B73' },
            }}
          >
            {copyingDashboard ? 'Copying…' : 'Copy image'}
          </Button>
        </Stack>
      </Stack>

      {customOpen && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems="center" sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #F1F5F9' }}>
          <TextField inputRef={dateInputRef} label="From" type="date" size="small" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ '& .MuiInputBase-input': { py: 0.6, fontSize: 12 } }} />
          <TextField label="To" type="date" size="small" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: fromDate }} sx={{ '& .MuiInputBase-input': { py: 0.6, fontSize: 12 } }} />
          <Button variant="contained" size="small" disableElevation disabled={!fromDate || !toDate || fromDate > toDate} onClick={() => { setPreset('Custom'); applyRange({ from: fromDate, to: toDate }); }} sx={{ textTransform: 'none', borderRadius: '999px', px: 2, height: 32, fontSize: 12 }}>
            Apply range
          </Button>
        </Stack>
      )}

      {copyFeedback && (
        <Typography role="status" sx={{ fontSize: 11.5, mt: 1, color: copyFeedback.startsWith('Unable') ? '#EF4444' : '#10B981', fontWeight: 650 }}>
          {copyFeedback}
        </Typography>
      )}
    </Box>

    {/* 5 Compact Horizontal Stat Cards - Pre-revert Design */}
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
        gap: 2,
        mb: 2.5,
      }}
    >
      {statCards.map((card) => {
        const Icon = card.icon;
        return (
          <Box
            key={card.label}
            sx={{
              bgcolor: card.bg,
              borderRadius: 3.5,
              p: '14px 18px',
              border: `1px solid ${card.border}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.75,
              minHeight: 76,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
              },
            }}
          >
            {/* Circular Icon with Matching Filled Tint */}
            <Box
              sx={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                bgcolor: card.circleBg,
                color: card.iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon sx={{ fontSize: 26 }} />
            </Box>

            {/* Text content: Title above, Value + Trend below */}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#1E293B',
                  lineHeight: 1.2,
                  mb: 0.35,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {card.label}
              </Typography>

              <Stack direction="row" alignItems="baseline" spacing={1}>
                {isDataLoading ? (
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1.15 }}>—</Typography>
                ) : card.error ? (
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Unavailable</Typography>
                ) : (
                  <>
                    <Typography
                      sx={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: '#0F172A',
                        lineHeight: 1.15,
                      }}
                    >
                      {numberFormat(card.value)}
                    </Typography>

                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <Typography
                        sx={{
                          fontSize: 11,
                          fontWeight: 750,
                          color: card.trend.isUp ? '#059669' : '#DC2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.25,
                        }}
                      >
                        {card.trend.isUp ? '▲' : '▼'} {card.trend.pct}
                      </Typography>
                    </Stack>
                  </>
                )}
              </Stack>
            </Box>
          </Box>
        );
      })}
    </Box>

    {/* 2 Main Charts Row - Separated Cards with Depth */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, mb: 2.5, alignItems: 'start' }}>
      {/* Left: Audit Portfolio Composition Card */}
      <Box
        component="section"
        sx={{
          bgcolor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 4,
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
          p: { xs: 2.5, md: 3 },
          transition: 'all 0.25s ease',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.07)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <RankedChart items={teamsByAuditType} {...shared} error={errors.portfolio} />
      </Box>

      {/* Right: Attendance & Workforce Availability Card */}
      <Box
        component="section"
        sx={{
          bgcolor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 4,
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
          p: { xs: 2.5, md: 3 },
          transition: 'all 0.25s ease',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.07)',
            transform: 'translateY(-2px)',
          },
        }}
      >
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
    </Box>

    {/* Current Teams & User Activity - Independent Card */}
    <Box
      ref={teamsSectionRef}
      component="section"
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
        p: { xs: 2.5, md: 3 },
        mb: 2.5,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={1.5}
        sx={{ mb: 2.5 }}
      >
        {/* Left: Section Header with Title & Subtitle */}
        <Box>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            Teams Leaderboard
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#64748B', mt: 0.35, fontWeight: 500 }}>
            Current Teams & User Activity
          </Typography>
          {teamCopyFeedback && (
            <Typography role="status" data-html2canvas-ignore="true" sx={{ fontSize: 11.5, mt: 0.5, color: teamCopyFeedback.startsWith('Unable') ? '#EF4444' : '#10B981', fontWeight: 650 }}>
              {teamCopyFeedback}
            </Typography>
          )}
        </Box>

        {/* Right: Team count pill + Search + Filter + Copy */}
        <Stack data-html2canvas-ignore="true" direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {/* Team count badge pill exactly as in reference */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: '999px',
              px: 1.5,
              py: 0.45,
              fontSize: 12,
              fontWeight: 650,
              color: '#334155',
            }}
          >
            <span>Team count</span>
            <Box
              sx={{
                bgcolor: '#E2E8F0',
                color: '#0F172A',
                fontWeight: 800,
                fontSize: 11,
                px: 0.85,
                py: 0.1,
                borderRadius: '999px',
              }}
            >
              {visibleTeams.length}
            </Box>
          </Box>

          {/* Search Input */}
          <TextField
            size="small"
            placeholder="Search"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: '#94A3B8' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: '100%', sm: 180 },
              bgcolor: '#FFFFFF',
              borderRadius: '999px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '999px',
                borderColor: '#E2E8F0',
                height: 32,
                '&:hover fieldset': { borderColor: '#CBD5E1' },
                '&.Mui-focused fieldset': { borderColor: '#004F98' },
              },
              '& .MuiInputBase-input': { fontSize: 12, py: 0.5, px: 0.5 },
            }}
          />

          {/* Segmented Filter Pill */}
          <Stack
            direction="row"
            sx={{
              bgcolor: '#F1F5F9',
              borderRadius: '999px',
              p: 0.3,
              border: '1px solid #E2E8F0',
            }}
          >
            <Button
              size="small"
              aria-pressed={!onlyActiveTeams}
              onClick={() => setOnlyActiveTeams(false)}
              sx={{
                minWidth: 60,
                height: 26,
                fontSize: 11,
                fontWeight: !onlyActiveTeams ? 750 : 550,
                bgcolor: !onlyActiveTeams ? '#004F98' : 'transparent',
                color: !onlyActiveTeams ? '#FFFFFF' : '#64748B',
                boxShadow: !onlyActiveTeams ? '0 1px 3px rgba(0,79,152,0.25)' : 'none',
                borderRadius: '999px',
                textTransform: 'none',
                px: 1.2,
                '&:hover': {
                  bgcolor: !onlyActiveTeams ? '#004F98' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              All teams
            </Button>
            <Button
              size="small"
              aria-pressed={onlyActiveTeams}
              onClick={() => setOnlyActiveTeams(true)}
              sx={{
                minWidth: 68,
                height: 26,
                fontSize: 11,
                fontWeight: onlyActiveTeams ? 750 : 550,
                bgcolor: onlyActiveTeams ? '#004F98' : 'transparent',
                color: onlyActiveTeams ? '#FFFFFF' : '#64748B',
                boxShadow: onlyActiveTeams ? '0 1px 3px rgba(0,79,152,0.25)' : 'none',
                borderRadius: '999px',
                textTransform: 'none',
                px: 1.2,
                '&:hover': {
                  bgcolor: onlyActiveTeams ? '#004F98' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              Active only
            </Button>
          </Stack>

          {/* Copy Button */}
          <Button
            variant="outlined"
            size="small"
            onClick={copyTeamsSectionImage}
            disabled={copyingTeams || isDataLoading || visibleTeams.length === 0}
            startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
            sx={{
              fontSize: 11.5,
              height: 30,
              px: 1.5,
              whiteSpace: 'nowrap',
              bgcolor: '#FFFFFF',
              borderColor: '#E2E8F0',
              color: '#334155',
              borderRadius: '999px',
              fontWeight: 650,
              textTransform: 'none',
              '&:hover': { bgcolor: '#F8FAFC', borderColor: '#CBD5E1' },
            }}
          >
            {copyingTeams ? 'Copying…' : 'Copy image'}
          </Button>
        </Stack>
      </Stack>

      <ChartState {...shared} error={errors.activity} empty={!visibleTeams.length}>
        {(() => {
          const sorted = [...visibleTeams].sort((a, b) => b.totalScans - a.totalScans || a.teamName.localeCompare(b.teamName));
          return (
            <TableContainer
              data-teams-scroll="true"
              sx={{
                maxHeight: 480,
                overflowY: 'auto',
                border: '1px solid #E2E8F0',
                borderRadius: 2.5,
                bgcolor: '#FFFFFF',
              }}
            >
              <Table stickyHeader sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', py: 1.25, px: 2, fontSize: 12, fontWeight: 750, color: '#475569' } }}>
                    <TableCell sx={{ width: 50, textAlign: 'center' }}>#</TableCell>
                    <TableCell>Team Name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>Audit Type</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>
                      Scan Count{' '}
                      <Box component="span" sx={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', bgcolor: '#004F98', ml: 0.5, verticalAlign: 'middle' }} />
                    </TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>Members</TableCell>
                    <TableCell sx={{ textAlign: 'center' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((team, idx) => {
                    const typeStyle = getAuditTypeColor(team.auditType);
                    const hasScans = team.totalScans > 0;
                    return (
                      <TableRow
                        key={team.teamId}
                        id={`team-card-${team.teamId}`}
                        sx={{
                          transition: 'background-color 0.15s',
                          bgcolor: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF',
                          '&:hover': { bgcolor: '#F1F5F9' },
                          '& td': { py: 1.25, px: 2, borderBottom: '1px solid #F1F5F9' },
                        }}
                      >
                        {/* 1. Rank */}
                        <TableCell sx={{ textAlign: 'center', fontSize: 13, fontWeight: 650, color: '#64748B' }}>
                          {idx + 1}
                        </TableCell>

                        {/* 2. Team Name */}
                        <TableCell>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }} noWrap title={team.teamName}>
                            {team.teamName}
                          </Typography>
                        </TableCell>

                        {/* 3. Location */}
                        <TableCell>
                          <Typography sx={{ fontSize: 12.5, color: '#64748B', fontWeight: 500 }} noWrap title={team.location || ''}>
                            {team.location || '—'}
                          </Typography>
                        </TableCell>

                        {/* 4. Audit Type (Solid colored pill) */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box
                            sx={{
                              display: 'inline-block',
                              px: 1.5,
                              py: 0.35,
                              borderRadius: '999px',
                              fontSize: 11,
                              fontWeight: 800,
                              bgcolor: typeStyle.color,
                              color: '#FFFFFF',
                              letterSpacing: '0.2px',
                              whiteSpace: 'nowrap',
                              boxShadow: `0 1px 3px ${typeStyle.color}40`,
                            }}
                          >
                            {team.auditType}
                          </Box>
                        </TableCell>

                        {/* 5. Scan Count (Bold number + blue dot) */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75}>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 850, color: '#0F172A' }}>
                              {numberFormat(team.totalScans)}
                            </Typography>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#004F98' }} />
                          </Stack>
                        </TableCell>

                        {/* 6. Members (Green/gray dots with tooltip) */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          {team.members.length === 0 ? (
                            <Typography sx={{ fontSize: 12, color: '#94A3B8' }}>—</Typography>
                          ) : (
                            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.65}>
                              {team.members.map((m) => (
                                <Tooltip
                                  key={m.id}
                                  title={`${m.name}: ${numberFormat(m.scanCount)} scans`}
                                  arrow
                                >
                                  <Box
                                    sx={{
                                      width: 9,
                                      height: 9,
                                      borderRadius: '50%',
                                      bgcolor: m.scanCount > 0 ? '#22C55E' : '#CBD5E1',
                                      boxShadow: m.scanCount > 0 ? '0 0 4px rgba(34, 197, 94, 0.4)' : 'none',
                                      cursor: 'pointer',
                                      transition: 'transform 0.15s',
                                      '&:hover': { transform: 'scale(1.4)' },
                                    }}
                                  />
                                </Tooltip>
                              ))}
                            </Stack>
                          )}
                        </TableCell>

                        {/* 7. Status Pill */}
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Box
                            sx={{
                              display: 'inline-block',
                              px: 1.25,
                              py: 0.25,
                              borderRadius: '999px',
                              fontSize: 11,
                              fontWeight: 700,
                              bgcolor: hasScans ? '#ECFDF5' : '#F1F5F9',
                              color: hasScans ? '#047857' : '#64748B',
                              border: `1px solid ${hasScans ? '#A7F3D0' : '#E2E8F0'}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {hasScans ? 'Active' : (team.status || 'Idle')}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          );
        })()}
      </ChartState>
    </Box>

    {/* Audit State Comparison Section - Independent Card */}
    <Box
      component="section"
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
        p: { xs: 2.5, md: 3 },
      }}
    >
      <AuditStateComparison followUps={followUpRecords} completions={completionRecords} {...shared} error={errors.followups || errors.completions} />
    </Box>
  </Box>;
}
const numberFormat = (value: number) => value.toLocaleString('en-IN');

const getAuditTypeColor = (type?: string) => {
  const str = String(type || '').toUpperCase();
  if (str.includes('TATA')) {
    return { bg: '#FFF7ED', color: '#D35400', border: '#FED7AA', bar: 'linear-gradient(90deg, #EA580C, #F97316)' };
  }
  if (str.includes('3W')) {
    return { bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4', bar: 'linear-gradient(90deg, #0F766E, #14B8A6)' };
  }
  if (str.includes('TVS')) {
    return { bg: '#EFF6FF', color: '#004F98', border: '#BFDBFE', bar: 'linear-gradient(90deg, #004F98, #3B82F6)' };
  }
  return { bg: '#EEF2FF', color: '#6366F1', border: '#DDD6FE', bar: 'linear-gradient(90deg, #6366F1, #818CF8)' };
};


import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import GroupsIcon from '@mui/icons-material/Groups';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import api from '../services/api';
import type { Team } from '../services/api';
import authManager from '../services/authSession';
import { RankedChart, AttendanceChart, AuditStateComparison } from '../components/common/DashboardCharts';
import { ChartState } from '../components/common/DashboardPrimitives';
import { dashboardTokens as t } from '../components/common/dashboardTheme';

interface DailyActivityTeam {
  teamId: string;
  teamName: string;
  auditType: string;
  location: string;
  totalScans: number;
  members: { id: string; name: string; email: string; role: string; scanCount: number }[];
  createdAt?: string;
  auditStartDate?: string;
  status?: string;
}

type AuditRecord = {
  state?: string;
  quoteDate?: string;
  startingDate?: string;
  endDate?: string;
  createdAt?: string;
  month?: string;
  [field: string]: unknown;
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
const numberFormat = (value: number) => value.toLocaleString('en-IN');

const getAuditTypeBadge = (type?: string) => {
  const str = String(type || '').toUpperCase();
  if (str.includes('TATA')) {
    return { bg: '#FFF7ED', color: '#D35400', border: '#FED7AA' };
  }
  if (str.includes('3W')) {
    return { bg: '#F0FDFA', color: '#0F766E', border: '#99F6E4' };
  }
  if (str.includes('TVS')) {
    return { bg: '#EFF6FF', color: '#004F98', border: '#BFDBFE' };
  }
  return { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' };
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
  const [allTeamsByAuditType, setAllTeamsByAuditType] = useState<{ label: string; count: number }[]>([]);
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
  const [previousStats, setPreviousStats] = useState<{ users: number; sites: number; currentSites: number; scans: number; activeTeams: number }>({
    users: 0,
    sites: 0,
    currentSites: 0,
    scans: 0,
    activeTeams: 0
  });
  const [copyingDashboard, setCopyingDashboard] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const teamsSectionRef = useRef<HTMLDivElement>(null);
  const [copyingTeams, setCopyingTeams] = useState(false);
  const [teamCopyFeedback, setTeamCopyFeedback] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [onlyActiveTeams, setOnlyActiveTeams] = useState(false);
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  const teamMetaMap = useMemo(() => {
    const map = new Map<string, Team>();
    allTeams.forEach((team) => {
      const id = String(team._id || team.id || '');
      if (id) map.set(id, team);
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
      const [users, teams, racks, masterData, followUps, completions, activity, attendance, priorActivity] = await Promise.all([
        siteManagerMode ? [] : safe('workspace', api.getAllUsers(), []),
        safe('portfolio', api.getTeams(), []),
        safe('workspace', api.getRacks({ limit: 1 }), { racks: [], totalCount: 0 }),
        siteManagerMode ? { data: [] as unknown[] } : safe('workspace', api.getUploadedFilesMetadata() as Promise<DataResponse<unknown[]>>, { data: [] }),
        siteManagerMode ? { data: [] as AuditRecord[] } : safe('followups', api.getAuditFollowUps() as Promise<DataResponse<AuditRecord[]>>, { data: [] }),
        siteManagerMode ? { data: [] as AuditRecord[] } : safe('completions', api.getAuditCompletions() as Promise<DataResponse<AuditRecord[]>>, { data: [] }),
        siteManagerMode ? { data: [] as DailyActivityTeam[] } : safe('activity', api.getDailyTeamActivity(from, to) as Promise<DataResponse<DailyActivityTeam[]>>, { data: [] }),
        siteManagerMode ? { summary: { totalStaff: 0, present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0, notSet: 0 } } : safe('attendance', api.getTeamAttendance({ from, to }) as Promise<AttendanceResponse>, { summary: { totalStaff: 0, present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0, notSet: 0 } }),
        siteManagerMode ? null : (api.getDailyTeamActivity(previousPeriod.from, previousPeriod.to) as Promise<DataResponse<DailyActivityTeam[]>>).catch(() => null),
      ]);

      if (id !== requestId.current) return;
      setAllTeams(teams || []);
      const periodTeams = (teams || []).filter((team) => String(team.status || '').toLowerCase() !== 'archived');
      const currentRangeTeams = periodTeams.filter((team) => isWithinDashboardRange(team, from, to, ['createdAt']));
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

      setTeamsByAuditType(countAuditTypes(currentRangeTeams));
      setAllTeamsByAuditType(countAuditTypes(periodTeams));

      const followFields = ['quoteDate', 'createdAt'];
      const follows = followUps.data || [];
      const completed = completions.data || [];
      setFollowUpRecords(follows.filter((record) => isWithinDashboardRange(record, from, to, followFields)));
      setCompletionRecords(completed.filter((record) => isCompletionInRange(record, from, to)));
      setDailyActivity(activity.data || []);

      const oldTeams = priorActivity?.data;
      const oldPeriodTeams = (teams || []).filter((team) => String(team.status || '').toLowerCase() !== 'archived');
      setPreviousStats({
        users: users?.length || 0,
        sites: oldPeriodTeams.length,
        currentSites: (teams || []).filter((team) => isWithinDashboardRange(team, previousPeriod.from, previousPeriod.to, ['createdAt'])).length,
        scans: oldTeams?.reduce((sum, team) => sum + team.totalScans, 0) || 0,
        activeTeams: oldTeams?.filter((team) => team.totalScans > 0).length || 0,
      });

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
        backgroundColor: '#F8FAFC', scale: 2, useCORS: true,
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
        backgroundColor: '#FFFFFF',
        scale: 2,
        useCORS: true,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: Math.max(document.documentElement.clientHeight, teamsSectionRef.current.scrollHeight),
        onclone: (document) => {
          document.querySelectorAll<HTMLElement>('[data-teams-scroll]').forEach((element) => {
            element.style.maxHeight = 'none';
            element.style.overflow = 'visible';
          });
        },
      });
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!image || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image copy unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
      setTeamCopyFeedback('Teams leaderboard image copied to clipboard');
    } catch {
      setTeamCopyFeedback('Unable to copy teams image');
    } finally {
      setCopyingTeams(false);
    }
  }

  const shared = { loading: isDataLoading, onChangeRange: changeDateRange, onRetry: () => { void loadDashboardData(); } };
  const totalScans = dailyActivity.reduce((sum, team) => sum + team.totalScans, 0);
  const activeTeamsCount = dailyActivity.filter((team) => team.totalScans > 0).length;

  // Percentage trend calculator
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
      trend: calcTrend(stats.users, previousStats.users),
      icon: PeopleAltIcon,
      iconColor: '#5B4EB7',
      bg: '#EDE9FE',
      border: '#DDD6FE',
      circleBg: '#DDD6FE',
    },
    {
      label: 'Active Sites',
      value: stats.teams,
      trend: calcTrend(stats.teams, previousStats.sites),
      icon: BusinessIcon,
      iconColor: '#0284C7',
      bg: '#E0F2FE',
      border: '#BAE6FD',
      circleBg: '#BAE6FD',
    },
    {
      label: 'Current Sites',
      value: stats.currentSites,
      trend: calcTrend(stats.currentSites, previousStats.currentSites),
      icon: LocationOnIcon,
      iconColor: '#059669',
      bg: '#DCFCE7',
      border: '#BBF7D0',
      circleBg: '#BBF7D0',
    },
    {
      label: 'Total Scans',
      value: totalScans,
      trend: calcTrend(totalScans, previousStats.scans),
      icon: QrCodeScannerIcon,
      iconColor: '#EA580C',
      bg: '#FFEDD5',
      border: '#FED7AA',
      circleBg: '#FED7AA',
    },
    {
      label: 'Teams Recorded Scans',
      value: activeTeamsCount,
      trend: calcTrend(activeTeamsCount, previousStats.activeTeams),
      icon: GroupsIcon,
      iconColor: '#7C3AED',
      bg: '#F3E8FF',
      border: '#E9D5FF',
      circleBg: '#E9D5FF',
    },
  ];

  return (
    <Box
      ref={summaryCaptureRef}
      sx={{
        minHeight: '100%',
        bgcolor: '#F8FAFC',
        color: '#0F172A',
        p: { xs: 2.5, md: 4 },
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top Header - Ultra-Slim Compact Card */}
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderRadius: 3,
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          mb: 2.5,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={1.5}>
          {/* Left: Compact Title & Subtitle inline */}
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography component="h1" sx={{ fontSize: { xs: 18, md: 20 }, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              Parts Audit Summary
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: '#64748B', mt: 0.25 }}>
              Executive overview of sites, workforce availability, and scan activities
            </Typography>
          </Box>

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
                height: 32,
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
                      height: 26,
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
                height: 32,
                px: 1.75,
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

      {/* 5 Compact Horizontal Stat Cards - Matching Image 2 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
          gap: 2,
          mb: 3.5,
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
                  <Typography
                    sx={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: '#0F172A',
                      lineHeight: 1.15,
                    }}
                  >
                    {isDataLoading ? '—' : numberFormat(card.value)}
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
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 2 Main Charts Row (Audit Type Distribution + Attendance) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3.5 }}>
        {/* Left Chart: Audit Type Distribution (Vertical Column Chart) */}
        <Box
          sx={{
            bgcolor: '#FFFFFF',
            borderRadius: 4,
            p: { xs: 2.5, md: 3.5 },
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <RankedChart items={teamsByAuditType} allItems={allTeamsByAuditType} {...shared} error={errors.portfolio} />
        </Box>

        {/* Right Chart: Attendance & Workforce Availability (Requested Donut + Cards Layout) */}
        <Box
          sx={{
            bgcolor: '#FFFFFF',
            borderRadius: 4,
            p: { xs: 2.5, md: 3.5 },
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
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

      {/* Teams Leaderboard Section - Spacious & Detailed Table */}
      <Box
        ref={teamsSectionRef}
        sx={{
          bgcolor: '#FFFFFF',
          borderRadius: 4,
          p: { xs: 2.5, md: 3.5 },
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          mb: 3.5,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography sx={{ fontSize: { xs: 18, md: 20 }, fontWeight: 800, color: '#0F172A' }}>
                Teams Leaderboard
              </Typography>
              <Chip
                label={`${visibleTeams.length} ${visibleTeams.length === 1 ? 'team' : 'teams'}`}
                size="small"
                sx={{ fontSize: 12, fontWeight: 750, bgcolor: '#EFF6FF', color: '#1D4ED8', height: 26 }}
              />
            </Stack>
            <Typography sx={{ fontSize: 12.5, color: '#64748B', mt: 0.5 }}>
              Current teams, assigned workforce members, and live scan contributions
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Search team, site or member…"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              sx={{
                width: { xs: '100%', sm: 250 },
                bgcolor: '#F8FAFC',
                borderRadius: 2,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                '& .MuiInputBase-input': { fontSize: 13, py: 0.85, px: 1.5 },
              }}
            />
            <Button
              size="small"
              variant={onlyActiveTeams ? 'contained' : 'outlined'}
              onClick={() => setOnlyActiveTeams(!onlyActiveTeams)}
              sx={{
                fontSize: 12,
                py: 0.8,
                px: 1.5,
                textTransform: 'none',
                fontWeight: 650,
                borderRadius: 2,
                borderColor: '#CBD5E1',
                bgcolor: onlyActiveTeams ? '#004F98' : 'transparent',
              }}
            >
              {onlyActiveTeams ? 'Active only' : 'All teams'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={copyTeamsSectionImage}
              disabled={copyingTeams || isDataLoading || visibleTeams.length === 0}
              startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
              sx={{
                fontSize: 12,
                py: 0.8,
                px: 1.75,
                textTransform: 'none',
                fontWeight: 650,
                borderColor: '#CBD5E1',
                color: '#334155',
                bgcolor: '#FFFFFF',
                borderRadius: 2,
                '&:hover': { bgcolor: '#F8FAFC', borderColor: '#94A3B8' },
              }}
            >
              {copyingTeams ? 'Copying…' : 'Copy leaderboard'}
            </Button>
          </Stack>
        </Stack>

        {teamCopyFeedback && (
          <Typography role="status" sx={{ fontSize: 12, mb: 1.5, color: teamCopyFeedback.startsWith('Unable') ? '#EF4444' : '#10B981', fontWeight: 650 }}>
            {teamCopyFeedback}
          </Typography>
        )}

        <ChartState {...shared} error={errors.activity} empty={!visibleTeams.length}>
          <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
            <Table sx={{ minWidth: 750 }}>
              <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                <TableRow>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75, width: 45 }}>#</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75 }}>Team &amp; Site</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75 }}>Location</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75, textAlign: 'center' }}>Audit Type</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75, textAlign: 'right' }}>Total Scans</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75 }}>Workforce Activity</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#475569', py: 1.75, textAlign: 'center' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleTeams.map((team, idx) => {
                  const badge = getAuditTypeBadge(team.auditType);
                  const isCompleted = String(team.status || '').toLowerCase() === 'completed';
                  return (
                    <TableRow
                      key={team.teamId}
                      sx={{
                        bgcolor: idx % 2 === 0 ? '#FFFFFF' : '#FAFCFF',
                        transition: 'background-color 0.15s',
                        '&:hover': { bgcolor: '#F1F5F9' },
                      }}
                    >
                      {/* Row Index */}
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: '#94A3B8', py: 2 }}>
                        {idx + 1}
                      </TableCell>

                      {/* Team Name */}
                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 750, color: '#0F172A' }}>
                          {team.teamName}
                        </Typography>
                      </TableCell>

                      {/* Location */}
                      <TableCell sx={{ py: 2 }}>
                        <Typography sx={{ fontSize: 12.5, color: '#64748B' }}>
                          {team.location || '—'}
                        </Typography>
                      </TableCell>

                      {/* Audit Type Badge */}
                      <TableCell sx={{ py: 2, textAlign: 'center' }}>
                        <Chip
                          label={team.auditType || 'Audit'}
                          size="small"
                          sx={{
                            bgcolor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontWeight: 750,
                            fontSize: 11,
                            borderRadius: '999px',
                            height: 24,
                          }}
                        />
                      </TableCell>

                      {/* Total Scans */}
                      <TableCell sx={{ py: 2, textAlign: 'right' }}>
                        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: team.totalScans > 0 ? '#2563EB' : '#94A3B8' }} />
                          <Typography sx={{ fontSize: 14, fontWeight: 800, color: team.totalScans > 0 ? '#1D4ED8' : '#64748B' }}>
                            {numberFormat(team.totalScans)}
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Workforce Members Activity */}
                      <TableCell sx={{ py: 2 }}>
                        {team.members.length === 0 ? (
                          <Typography sx={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                            No assigned members
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                            {team.members.map((member) => (
                              <Tooltip key={member.id} title={`${member.name} (${member.role}): ${member.scanCount} scans`}>
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.6,
                                    px: 1,
                                    py: 0.35,
                                    borderRadius: '12px',
                                    bgcolor: member.scanCount > 0 ? '#ECFDF5' : '#F1F5F9',
                                    border: `1px solid ${member.scanCount > 0 ? '#A7F3D0' : '#E2E8F0'}`,
                                  }}
                                >
                                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: member.scanCount > 0 ? '#10B981' : '#94A3B8' }} />
                                  <Typography sx={{ fontSize: 11.5, fontWeight: member.scanCount > 0 ? 700 : 550, color: member.scanCount > 0 ? '#065F46' : '#475569' }}>
                                    {member.name}
                                  </Typography>
                                  {member.scanCount > 0 && (
                                    <Box sx={{ px: 0.6, py: 0.05, borderRadius: '6px', bgcolor: '#059669', color: '#FFFFFF', fontSize: 10, fontWeight: 800 }}>
                                      {member.scanCount}
                                    </Box>
                                  )}
                                </Box>
                              </Tooltip>
                            ))}
                          </Box>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell sx={{ py: 2, textAlign: 'center' }}>
                        <Chip
                          label={isCompleted ? 'Completed' : 'Active'}
                          size="small"
                          sx={{
                            bgcolor: isCompleted ? '#F1F5F9' : '#ECFDF5',
                            color: isCompleted ? '#64748B' : '#059669',
                            border: `1px solid ${isCompleted ? '#CBD5E1' : '#A7F3D0'}`,
                            fontSize: 11.5,
                            fontWeight: 700,
                            borderRadius: '999px',
                            height: 24,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </ChartState>
      </Box>

      {/* Audit State Comparison Section */}
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          borderRadius: 4,
          p: { xs: 2.5, md: 3.5 },
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <AuditStateComparison followUps={followUpRecords} completions={completionRecords} {...shared} error={errors.followups || errors.completions} />
      </Box>
    </Box>
  );
}

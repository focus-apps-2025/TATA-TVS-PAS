import { useEffect, useState } from 'react';
import { Add, Groups, PersonAdd } from '@mui/icons-material';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  _id: string; name: string; employeeCode?: string; designation?: string;
  department?: string; phone?: string; email?: string; joiningDate?: string;
};

type AttendanceRecord = {
  _id: string; name: string; email?: string; role: string;
  attendanceStatus: string | null;  // null = not yet marked
  teamCount: number;
  isAutoPresent: boolean;           // true = auto-Present via team assignment
};

type Summary = {
  present: number; absent: number; compoff: number;
  paidLeave: number; travel: number; teamsCreated: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = ['Present', 'Absent', 'Compoff', 'Paid Leave', 'Travel'] as const;
type AttendanceStatus = typeof STATUSES[number];

const STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'info' | 'primary' | 'default'> = {
  Present:     'success',
  Absent:      'error',
  Compoff:     'warning',
  'Paid Leave': 'info',
  Travel:      'primary',
};

const blank = {
  name: '', employeeCode: '', designation: '', department: '',
  phone: '', email: '', joiningDate: '', attendanceStatus: 'Present',
};

const todayIST = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const v = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${v('year')}-${v('month')}-${v('day')}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmployeeManagement() {
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [attendance, setAttendance]     = useState<AttendanceRecord[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(todayIST);
  const [summary, setSummary]           = useState<Summary>({ present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0, teamsCreated: 0 });
  const [tab, setTab]                   = useState<'employees' | 'attendance'>('employees');
  const [open, setOpen]                 = useState(false);
  const [form, setForm]                 = useState(blank);
  const [message, setMessage]           = useState('');
  const [error, setError]               = useState('');
  const [savingIds, setSavingIds]       = useState<Set<string>>(new Set());

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadEmployees = async () => {
    try {
      const response = await api.getEmployees();
      if (!response.success) throw new Error(response.message);
      setEmployees(response.data as Employee[]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load employees.'); }
  };

  const loadAttendance = async () => {
    try {
      const response = await api.getTeamAttendance(attendanceDate);
      if (!response.success) throw new Error(response.message);
      setAttendance(response.data as AttendanceRecord[]);
      const s = response.summary || {};
      setSummary({
        present:     s.present     || 0,
        absent:      s.absent      || 0,
        compoff:     s.compoff     || 0,
        paidLeave:   s.paidLeave   || 0,
        travel:      s.travel      || 0,
        teamsCreated: s.teamsCreated || 0,
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load attendance.'); }
  };

  useEffect(() => { void loadEmployees(); }, []);
  useEffect(() => { if (tab === 'attendance') void loadAttendance(); }, [tab, attendanceDate]);

  // Auto-clear alerts
  useEffect(() => {
    if (!error) return undefined;
    const t = window.setTimeout(() => setError(''), 3000);
    return () => window.clearTimeout(t);
  }, [error]);
  useEffect(() => {
    if (!message) return undefined;
    const t = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(t);
  }, [message]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const addEmployee = async () => {
    try {
      const response = await api.createEmployee(form as Record<string, unknown>);
      if (!response.success) throw new Error(response.message);
      setOpen(false); setForm(blank);
      setMessage('Employee added successfully.');
      await loadEmployees();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to add employee.'); }
  };

  /** Called when admin changes status dropdown for any employee row. */
  const handleStatusChange = async (userId: string, status: string) => {
    setSavingIds((prev) => new Set(prev).add(userId));
    // Optimistically update UI immediately
    setAttendance((prev) =>
      prev.map((item) =>
        item._id === userId
          ? { ...item, attendanceStatus: status, isAutoPresent: false }
          : item,
      ),
    );
    // Recompute summary optimistically
    setAttendance((prev) => {
      const counts = { present: 0, absent: 0, compoff: 0, paidLeave: 0, travel: 0 };
      prev.forEach((item) => {
        if (item.attendanceStatus === 'Present')    counts.present    += 1;
        if (item.attendanceStatus === 'Absent')     counts.absent     += 1;
        if (item.attendanceStatus === 'Compoff')    counts.compoff    += 1;
        if (item.attendanceStatus === 'Paid Leave') counts.paidLeave  += 1;
        if (item.attendanceStatus === 'Travel')     counts.travel     += 1;
      });
      setSummary((s) => ({ ...s, ...counts }));
      return prev;
    });
    try {
      const response = await api.upsertDailyAttendance(userId, attendanceDate, status);
      if (!response.success) throw new Error(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save attendance.');
      void loadAttendance(); // revert on error
    } finally {
      setSavingIds((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const summaryCards = [
    { label: 'Present',     value: summary.present,     color: '#15803D' },
    { label: 'Absent',      value: summary.absent,      color: '#B91C1C' },
    { label: 'Comp-off',    value: summary.compoff,     color: '#B45309' },
    { label: 'Paid Leave',  value: summary.paidLeave,   color: '#0369A1' },
    { label: 'Travel',      value: summary.travel,      color: '#6D28D9' },
    { label: 'Teams today', value: summary.teamsCreated, color: '#0054A6' },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Team Management</Typography>
          <Typography color="text.secondary">
            Employee records and attendance derived from team assignments on the selected date.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setOpen(true)}>
          Add employee
        </Button>
      </Stack>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage('')} sx={{ mb: 2 }}>{message}</Alert>}

      <Card variant="outlined">
        <CardContent>
          {/* Tabs */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button
              variant={tab === 'employees' ? 'contained' : 'outlined'}
              startIcon={<Groups />}
              onClick={() => setTab('employees')}
            >
              Employee details
            </Button>
            <Button
              variant={tab === 'attendance' ? 'contained' : 'outlined'}
              onClick={() => setTab('attendance')}
            >
              Attendance
            </Button>
          </Stack>

          {/* ── Attendance tab controls ─────────────────────────────────── */}
          {tab === 'attendance' && (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }} spacing={1.5}
                alignItems={{ sm: 'center' }} sx={{ mb: 2 }}
              >
                <TextField
                  size="small" type="date" label="Date"
                  value={attendanceDate}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  sx={{ minWidth: 170 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Team members assigned on this date are auto-marked <strong>Present</strong>.
                  All other staff can be manually set. Non-team staff are <em>not</em> auto-Absent.
                </Typography>
              </Stack>

              {/* Summary cards */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: 'repeat(6,1fr)' },
                  gap: 1.5, mb: 2,
                }}
              >
                {summaryCards.map(({ label, value, color }) => (
                  <Card key={label} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="h4" fontWeight={800} sx={{ color }}>{value}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </>
          )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {tab === 'employees'
                    ? ['Employee', 'Code', 'Designation', 'Department', 'Contact', 'Joined'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 800, bgcolor: '#EAF3FF' }}>{h}</TableCell>
                      ))
                    : ['Employee', 'Role', 'Email', 'Teams on date', 'Attendance Status'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 800, bgcolor: '#EAF3FF' }}>{h}</TableCell>
                      ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {tab === 'employees'
                  ? employees.map((emp) => (
                      <TableRow key={emp._id} hover>
                        <TableCell>
                          <Typography fontWeight={700}>{emp.name}</Typography>
                          <Typography variant="caption">{emp.email || '—'}</Typography>
                        </TableCell>
                        <TableCell>{emp.employeeCode || '—'}</TableCell>
                        <TableCell>{emp.designation  || '—'}</TableCell>
                        <TableCell>{emp.department   || '—'}</TableCell>
                        <TableCell>{emp.phone        || '—'}</TableCell>
                        <TableCell>
                          {emp.joiningDate
                            ? new Date(emp.joiningDate).toLocaleDateString('en-IN')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  : attendance.map((item) => (
                      <TableRow key={item._id} hover>
                        {/* Name + auto badge */}
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box>
                              <Typography fontWeight={700}>{item.name}</Typography>
                              {item.isAutoPresent && (
                                <Typography variant="caption" color="text.secondary">
                                  Auto · {item.teamCount} team{item.teamCount !== 1 ? 's' : ''}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell>{item.role.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{item.email || '—'}</TableCell>
                        <TableCell>{item.teamCount || '—'}</TableCell>

                        {/* Status dropdown */}
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Select
                              size="small"
                              displayEmpty
                              value={item.attendanceStatus || ''}
                              disabled={savingIds.has(item._id)}
                              onChange={(e) => void handleStatusChange(item._id, e.target.value)}
                              renderValue={(value) =>
                                value
                                  ? <Chip
                                      label={value}
                                      size="small"
                                      color={STATUS_COLOR[value] || 'default'}
                                      sx={{ height: 22, pointerEvents: 'none' }}
                                    />
                                  : <Typography variant="caption" color="text.secondary">— Not set —</Typography>
                              }
                              sx={{ minWidth: 145 }}
                            >
                              {STATUSES.map((s) => (
                                <MenuItem key={s} value={s}>
                                  <Chip
                                    label={s} size="small"
                                    color={STATUS_COLOR[s] || 'default'}
                                    sx={{ height: 22, pointerEvents: 'none' }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                            {savingIds.has(item._id) && <CircularProgress size={16} />}
                            {item.isAutoPresent && (
                              <Tooltip title="Auto-marked Present — this staff member is assigned to a team on the selected date.">
                                <Typography variant="caption" color="success.main" sx={{ fontWeight: 700, cursor: 'help' }}>
                                  ✓ Team
                                </Typography>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}

                {/* Empty state */}
                {!(tab === 'employees' ? employees : attendance).length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 7, color: 'text.secondary' }}>
                      {tab === 'attendance'
                        ? 'No active staff found.'
                        : 'No employees added yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── Add Employee dialog ────────────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add employee</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, pt: 0.5 }}>
            {(
              [
                ['name',           'Employee name *'],
                ['employeeCode',   'Employee code'],
                ['designation',    'Designation'],
                ['department',     'Department'],
                ['phone',          'Phone'],
                ['email',          'Email'],
              ] as [keyof typeof blank, string][]
            ).map(([field, label]) => (
              <TextField
                key={field}
                label={label}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            ))}
            <TextField
              label="Joining date" type="date"
              value={form.joiningDate}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
            />
            <TextField
              select label="Default attendance"
              value={form.attendanceStatus}
              onChange={(e) => setForm({ ...form, attendanceStatus: e.target.value })}
            >
              {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => void addEmployee()}>
            Add employee
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

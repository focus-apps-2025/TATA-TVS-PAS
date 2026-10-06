import type { ReactNode } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { dashboardTokens as t, dashboardSurface } from './dashboardTheme';

export function ChartCard({ children }: { children: ReactNode }) {
  return <Box component="section" sx={{ ...dashboardSurface, p: { xs: 2, md: 2.5 }, height: '100%', boxSizing: 'border-box' }}>{children}</Box>;
}

export function ChartHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 2 }}>
    <Box><Typography component="h2" sx={{ fontSize: 16, fontWeight: 650, color: t.heading }}>{title}</Typography>{subtitle && <Typography sx={{ fontSize: 12, color: t.muted, mt: .5 }}>{subtitle}</Typography>}</Box>{action}
  </Stack>;
}

export function ChartState({ loading, error, empty, onChangeRange, onRetry, children }: {
  loading?: boolean; error?: string; empty?: boolean; onChangeRange?: () => void; onRetry?: () => void; children: ReactNode;
}) {
  if (loading) return <Box role="status" aria-label="Loading chart" sx={{ py: 2 }}><Skeleton width="35%" height={28} /><Stack direction="row" spacing={2} alignItems="flex-end" sx={{ height: 150 }}>{[60, 100, 75, 125, 95, 140].map((height, i) => <Skeleton key={i} variant="rounded" height={height} sx={{ flex: 1 }} />)}</Stack><Skeleton width="70%" sx={{ mt: 2 }} /></Box>;
  if (error || empty) return <Box role={error ? 'alert' : 'status'} sx={{ minHeight: 208, position: 'relative', display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 2, bgcolor: '#FAFCFF' }}>
    <svg viewBox="0 0 500 200" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, opacity: .6 }}>
      {[45, 90, 135, 180].map((y) => <line key={y} x1="20" x2="480" y1={y} y2={y} stroke={t.border} strokeDasharray="3 6" />)}
      {[55, 100, 75, 120, 90, 145].map((h, i) => <rect key={i} x={35 + i * 77} y={180 - h} width="32" height={h} rx="5" fill="#E9EFF8" />)}
    </svg>
    <Box sx={{ position: 'relative', textAlign: 'center', bgcolor: 'rgba(250,252,255,.95)', p: 2, maxWidth: 310 }}>
      <Box component="span" aria-hidden="true" sx={{ color: error ? t.danger : t.primary, fontSize: 22 }}>{error ? '!' : '▥'}</Box>
      <Typography sx={{ color: t.heading, fontSize: 13, fontWeight: 600, mb: .5 }}>{error ? 'Unable to load this view' : 'No activity in this period'}</Typography>
      <Typography sx={{ fontSize: 12, color: t.muted }}>{error || 'Try a different date range to explore your data.'}</Typography>
      <Button size="small" onClick={error ? onRetry : onChangeRange} sx={{ mt: .5 }}>{error ? 'Retry' : 'Change date range'}</Button>
    </Box>
  </Box>;
  return <>{children}</>;
}

export function DeltaBadge(_props: { value: number; previous?: number; percentagePoints?: boolean }) {
  return null;
}

export function KpiCard({ label, value, previous, percent, loading, error, onRetry }: { label: string; value: number; previous?: number; percent?: boolean; loading: boolean; error?: string; onRetry: () => void }) {
  const top = Math.max(value, previous ?? 0, 1);
  return <Box component="section" aria-label={label} sx={{ ...dashboardSurface, p: 2 }}>
    <Typography sx={{ fontSize: 12, color: t.muted, fontWeight: 600 }}>{label}</Typography>
    {loading ? <><Skeleton width="50%" height={48} /><Skeleton width="85%" /></> : error ? <Box role="alert" sx={{ py: 1 }}><Typography sx={{ fontSize: 12, color: t.danger }}>Data unavailable</Typography><Button size="small" onClick={onRetry}>Retry</Button></Box> : <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ my: .5 }}>
        <Typography sx={{ fontSize: 32, fontWeight: 750, letterSpacing: '-1px', color: value ? t.heading : t.muted, fontVariantNumeric: 'tabular-nums' }}>{percent ? `${value.toFixed(1)}%` : value.toLocaleString('en-IN')}</Typography>
        <svg width="66" height="36" viewBox="0 0 66 36" role="img" aria-label={previous === undefined ? 'Previous-period data unavailable' : `Previous period ${previous.toFixed(1)}; selected period ${value.toFixed(1)}`}>
          <line x1="4" x2="62" y1="31" y2="31" stroke={t.border} />
          {previous !== undefined && <><path d={`M4 ${29 - previous / top * 23} L62 ${29 - value / top * 23}`} fill="none" stroke={value ? t.primary : t.members} strokeWidth="2" /><circle cx="4" cy={29 - previous / top * 23} r="3" fill={t.members} /><circle cx="62" cy={29 - value / top * 23} r="3" fill={t.primary} /></>}
        </svg>
      </Stack>
      <DeltaBadge value={value} previous={previous} percentagePoints={percent} />
      <Typography sx={{ fontSize: 10, color: t.muted, mt: .5 }}>{previous === undefined ? 'No historical series supplied' : 'Previous → selected period'}</Typography>
    </>}
  </Box>;
}

export function LegendToggle({ label, color, pressed, onClick }: { label: string; color: string; pressed: boolean; onClick: () => void }) {
  return <Button size="small" aria-pressed={pressed} onClick={onClick} sx={{ fontSize: 11, color: t.text, textTransform: 'none', px: 1, opacity: pressed ? 1 : .65, textDecoration: pressed ? 'none' : 'line-through', '&:focus-visible': { outline: `2px solid ${t.primary}`, outlineOffset: 2 } }}><Box component="span" sx={{ width: 8, height: 8, bgcolor: pressed ? color : 'transparent', border: `1px solid ${color}`, mr: .75 }} />{label}</Button>;
}

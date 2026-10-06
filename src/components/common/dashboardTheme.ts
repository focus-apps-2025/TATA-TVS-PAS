// Semantic dashboard tokens; swap this palette when adding a dark theme.
export const dashboardTokens = {
  primary: '#356FE5', primaryLight: '#91B8FF', success: '#159C8C',
  danger: '#BE6653', coral: '#ECA996', members: '#ABC2ED',
  background: '#F5F8FC', surface: '#FFFFFF', border: '#E2EAF4',
  heading: '#142E50', text: '#334B66', muted: '#65758B', guide: '#E9EFF6',
  radius: '14px', shadow: '0 2px 4px rgba(25,55,90,.02), 0 8px 24px rgba(25,55,90,.045)',
};

export const dashboardSurface = {
  bgcolor: dashboardTokens.surface, border: `1px solid ${dashboardTokens.border}`,
  borderRadius: dashboardTokens.radius, boxShadow: dashboardTokens.shadow,
  minWidth: 0, transition: 'box-shadow 300ms ease',
  '&:hover': { boxShadow: '0 4px 8px rgba(25,55,90,.03), 0 12px 28px rgba(25,55,90,.07)' },
};

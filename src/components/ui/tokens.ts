// =============================================================================
// AegisRAG Design Tokens — Sprint 6A
// Single source of truth for all design decisions.
// Import this module in any component instead of hardcoding values.
// =============================================================================

// ── Color Palette ──────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bgBase:       '#080C14',
  bgPrimary:    '#0A0F1E',
  bgSecondary:  '#0D1117',
  bgElevated:   '#111827',
  bgOverlay:    '#1A2232',
  bgCard:       '#0F1729',
  bgCardHover:  '#141E33',

  // Surface glass
  glassSurface:      'rgba(255,255,255,0.04)',
  glassSurfaceHover: 'rgba(255,255,255,0.07)',
  glassBorder:       'rgba(255,255,255,0.08)',
  glassBorderHover:  'rgba(255,255,255,0.16)',
  glassBorderStrong: 'rgba(255,255,255,0.12)',

  // Accents
  indigo:   '#6366F1',
  indigoLight: '#818CF8',
  blue:     '#3B82F6',
  blueLight:'#60A5FA',
  cyan:     '#22D3EE',
  emerald:  '#10B981',
  emeraldLight:'#6EE7B7',
  amber:    '#F59E0B',
  amberLight:'#FCD34D',
  rose:     '#F43F5E',
  roseLight:'#FDA4AF',
  violet:   '#8B5CF6',
  violetLight:'#A78BFA',
  sky:      '#0EA5E9',
  skyLight: '#38BDF8',
  teal:     '#14B8A6',

  // Text
  textPrimary:   '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted:     '#475569',
  textFaint:     '#334155',
  textCode:      '#22D3EE',

  // Semantic status
  statusSuccess: '#10B981',
  statusWarning: '#F59E0B',
  statusDanger:  '#F43F5E',
  statusInfo:    '#3B82F6',
  statusNeutral: '#64748B',
  statusPending: '#A78BFA',
} as const

// ── Severity Colors ─────────────────────────────────────────────────────────
export const severity = {
  critical: { text: '#F43F5E', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.20)' },
  high:     { text: '#FB923C', bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.20)' },
  medium:   { text: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)' },
  low:      { text: '#22D3EE', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.20)' },
  info:     { text: '#94A3B8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.15)' },
} as const

// ── Spacing Scale (4px base) ────────────────────────────────────────────────
export const space = {
  px:  '1px',
  '0': '0px',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  '20': '80px',
} as const

// ── Border Radius ───────────────────────────────────────────────────────────
export const radius = {
  xs:   '4px',
  sm:   '6px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
  '3xl':'24px',
  full: '9999px',
} as const

// ── Typography ──────────────────────────────────────────────────────────────
export const font = {
  sans: "var(--font-inter, system-ui, sans-serif)",
  mono: "var(--font-jetbrains-mono, 'Courier New', monospace)",
  sizes: {
    xs:   '0.625rem',  //  10px
    sm:   '0.6875rem', //  11px
    base: '0.75rem',   //  12px
    md:   '0.8125rem', //  13px
    lg:   '0.875rem',  //  14px
    xl:   '1rem',      //  16px
    '2xl':'1.125rem',  //  18px
    '3xl':'1.25rem',   //  20px
    '4xl':'1.5rem',    //  24px
    '5xl':'1.875rem',  //  30px
  },
} as const

// ── Shadows ─────────────────────────────────────────────────────────────────
export const shadow = {
  sm:  '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
  md:  '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
  lg:  '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
  xl:  '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.10)',
  glow: {
    indigo:  '0 0 24px rgba(99,102,241,0.20)',
    blue:    '0 0 24px rgba(59,130,246,0.18)',
    emerald: '0 0 24px rgba(16,185,129,0.15)',
    rose:    '0 0 24px rgba(244,63,94,0.18)',
    violet:  '0 0 24px rgba(139,92,246,0.18)',
    amber:   '0 0 24px rgba(245,158,11,0.15)',
  },
} as const

// ── Transitions ─────────────────────────────────────────────────────────────
export const transition = {
  base:   'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  fast:   'all 0.12s ease',
  slow:   'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  colors: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
} as const

// ── Z-index Scale ───────────────────────────────────────────────────────────
export const zIndex = {
  base:    0,
  raised:  10,
  dropdown:100,
  sticky:  200,
  modal:   300,
  tooltip: 400,
  overlay: 500,
} as const

// ── Icon Sizes ──────────────────────────────────────────────────────────────
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const

// ── Role Colors ─────────────────────────────────────────────────────────────
export const roleColors: Record<string, { text: string; bg: string; border: string }> = {
  super_admin:        { text: '#F43F5E', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.20)' },
  compliance_officer: { text: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.20)' },
  security_analyst:   { text: '#38BDF8', bg: 'rgba(56,189,248,0.10)', border: 'rgba(56,189,248,0.20)' },
  auditor:            { text: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)' },
  executive:          { text: '#34D399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.20)' },
  trial_user:         { text: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.20)' },
  academic_user:      { text: '#0EA5E9', bg: 'rgba(14,165,233,0.10)',  border: 'rgba(14,165,233,0.20)' },
  approved_user:      { text: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.20)' },
  enterprise_user:    { text: '#6366F1', bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.20)' },
}

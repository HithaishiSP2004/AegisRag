// =============================================================================
// AegisRAG Design Language
// VisionOS + Liquid Glass + Enterprise Cybersecurity
// Source of Truth: Phase2-Design-System-Bible.md + FINAL CONSOLIDATION.md
// =============================================================================

export const DESIGN_TOKENS = {
  // ── Color Palette ──────────────────────────────────────────────────────────
  colors: {
    background: {
      primary: '#080C14', // Deepest background — near-black navy
      secondary: '#0D1117', // Page surface
      elevated: '#131923', // Raised cards, panels
      overlay: '#1A2332', // Hover overlays, modals
    },
    glass: {
      surface: 'rgba(255,255,255,0.04)',
      surfaceHover: 'rgba(255,255,255,0.07)',
      border: 'rgba(255,255,255,0.08)',
      borderHover: 'rgba(255,255,255,0.16)',
      highlight: 'rgba(255,255,255,0.12)',
      inset: 'rgba(0,0,0,0.20)',
    },
    accent: {
      primary: '#3B82F6', // Electric blue — primary actions
      primaryHover: '#60A5FA',
      secondary: '#6366F1', // Indigo — secondary elements
      cyan: '#22D3EE', // Scanner cyan — AI activity
      emerald: '#10B981', // Compliance green — success
      amber: '#F59E0B', // Warning amber
      rose: '#F43F5E', // Critical red — violations
      violet: '#8B5CF6', // Purple — AI/intelligence
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      muted: '#475569',
      disabled: '#2D3748',
      inverse: '#0F172A',
      code: '#22D3EE', // Monospace values, scores
    },
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#F43F5E',
      info: '#3B82F6',
      critical: '#FF3366',
    },
    risk: {
      low: '#10B981', // 0–30
      medium: '#F59E0B', // 31–60
      high: '#F97316', // 61–80
      critical: '#F43F5E', // 81–100
    },
  },

  // ── Liquid Glass System ────────────────────────────────────────────────────
  glass: {
    blur: {
      light: 'blur(8px)',
      default: 'blur(16px)',
      heavy: 'blur(24px)',
      ultra: 'blur(40px)',
    },
    // CSS classes to compose in components
    classes: {
      card: 'backdrop-blur-md bg-white/[0.04] border border-white/[0.08] rounded-xl',
      cardHover:
        'hover:bg-white/[0.07] hover:border-white/[0.16] transition-all duration-300',
      panel: 'backdrop-blur-xl bg-white/[0.03] border border-white/[0.06] rounded-2xl',
      modal: 'backdrop-blur-2xl bg-[#080C14]/80 border border-white/[0.10] rounded-2xl',
      navItem:
        'backdrop-blur-md bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 hover:bg-white/[0.10] hover:border-white/[0.20] transition-all duration-200',
    },
  },

  // ── Typography ─────────────────────────────────────────────────────────────
  fonts: {
    sans: 'var(--font-inter)',
    mono: 'var(--font-jetbrains-mono)',
  },

  // ── Iconography Rules ──────────────────────────────────────────────────────
  // MANDATORY: Follow these rules for every icon usage
  icons: {
    // Navigation & feature icons: HugeIcons (hugeicons-react)
    // Usage: import { Shield01Icon } from 'hugeicons-react'
    navigation: 'hugeicons-react',

    // Status & indicator icons: Solar via Iconify (@iconify/react)
    // Usage: import { Icon } from '@iconify/react'
    //         <Icon icon="solar:shield-check-bold" />
    status: '@iconify/react (solar: prefix)',

    // Internal shadcn/form icons ONLY: lucide-react
    // Never use Lucide in navigation, feature areas, or any visible product UI
    internal: 'lucide-react (shadcn compatibility only)',
  },

  // ── Spacing (4pt grid) ─────────────────────────────────────────────────────
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },

  // ── Border Radius ──────────────────────────────────────────────────────────
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    full: '9999px',
  },

  // ── Shadows (layered glow system) ──────────────────────────────────────────
  shadows: {
    glow: {
      blue: '0 0 20px rgba(59,130,246,0.15)',
      cyan: '0 0 20px rgba(34,211,238,0.10)',
      emerald: '0 0 20px rgba(16,185,129,0.10)',
      rose: '0 0 20px rgba(244,63,94,0.15)',
    },
    card: '0 4px 24px rgba(0,0,0,0.40)',
    elevated: '0 8px 40px rgba(0,0,0,0.60)',
  },
} as const

// Risk score → color utility
export function getRiskColor(score: number): string {
  if (score <= 30) return DESIGN_TOKENS.colors.risk.low
  if (score <= 60) return DESIGN_TOKENS.colors.risk.medium
  if (score <= 80) return DESIGN_TOKENS.colors.risk.high
  return DESIGN_TOKENS.colors.risk.critical
}

// Risk score → label
export function getRiskLabel(score: number): string {
  if (score <= 30) return 'Low Risk'
  if (score <= 60) return 'Medium Risk'
  if (score <= 80) return 'High Risk'
  return 'Critical Risk'
}

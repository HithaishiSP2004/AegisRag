// =============================================================================
// Badge — Sprint 6A Design System
// Status/role/severity badges with consistent token-driven styling.
// =============================================================================
import React from 'react'
import { colors, radius, font } from './tokens'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple' | 'cyan' | 'amber'

interface BadgeProps {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
  pulse?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
}

const VARIANT_STYLES: Record<BadgeVariant, { text: string; bg: string; border: string }> = {
  success: { text: colors.emeraldLight, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.22)' },
  warning: { text: colors.amberLight,   bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.22)' },
  danger:  { text: colors.roseLight,    bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.22)' },
  info:    { text: colors.blueLight,    bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.22)' },
  neutral: { text: colors.textSecondary, bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.20)' },
  purple:  { text: colors.violetLight,  bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.22)' },
  cyan:    { text: colors.cyan,         bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.20)' },
  amber:   { text: colors.amber,        bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)' },
}

export function Badge({ variant = 'neutral', size = 'sm', dot, pulse, children, style }: BadgeProps) {
  const s = VARIANT_STYLES[variant]
  const isSmall = size === 'sm'

  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: isSmall ? '2px 8px' : '4px 12px',
        borderRadius: radius.full,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontSize: isSmall ? font.sizes.xs : font.sizes.base,
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '5px',
            height: '5px',
            borderRadius: radius.full,
            background: s.text,
            animation: pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  )
}

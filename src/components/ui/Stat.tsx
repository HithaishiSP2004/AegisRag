// =============================================================================
// Stat — Sprint 6A Design System
// KPI metric card with label, value, delta, trend, sparkline slot, timestamp.
// =============================================================================
import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { colors, font, radius, shadow, transition } from './tokens'

interface StatProps {
  label:         string
  value:         string | number
  delta?:        string
  trendUp?:      boolean | null  // true=up(good), false=down, null=neutral
  inverseTrend?: boolean          // if true, down is good (e.g. risk score)
  subtitle?:     string
  accentColor?:  string
  sparkline?:    React.ReactNode
  updatedAt?:    string
  loading?:      boolean
}

export function Stat({
  label,
  value,
  delta,
  trendUp,
  inverseTrend = false,
  subtitle,
  accentColor = colors.indigo,
  sparkline,
  updatedAt,
  loading = false,
}: StatProps) {
  // Determine semantic color of the trend
  const isPositive = inverseTrend ? trendUp === false : trendUp === true
  const isNegative = inverseTrend ? trendUp === true  : trendUp === false

  const trendColor  = isPositive ? colors.emerald : isNegative ? colors.rose : colors.textMuted
  const TrendIcon   = trendUp === true ? TrendingUp : trendUp === false ? TrendingDown : Minus

  if (loading) {
    return (
      <div
        style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.xl,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          borderTop: `2px solid ${accentColor}`,
        }}
      >
        <div style={{ height: '11px', width: '45%', background: colors.glassSurface, borderRadius: radius.sm, animation: 'shimmer 1.6s infinite', backgroundSize: '200% 100%' }} />
        <div style={{ height: '28px', width: '55%', background: colors.glassSurface, borderRadius: radius.sm, animation: 'shimmer 1.6s infinite', backgroundSize: '200% 100%' }} />
        <div style={{ height: '10px', width: '30%', background: colors.glassSurface, borderRadius: radius.sm, animation: 'shimmer 1.6s infinite', backgroundSize: '200% 100%' }} />
      </div>
    )
  }

  return (
    <div
      style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderTop: `2px solid ${accentColor}`,
        borderRadius: radius.xl,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: shadow.md,
        transition: transition.base,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle glow effect in the top-right corner */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '80px',
          height: '80px',
          background: `radial-gradient(circle at top right, ${accentColor}10, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Label */}
      <p
        style={{
          color: colors.textMuted,
          fontSize: font.sizes.sm,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          margin: 0,
        }}
      >
        {label}
      </p>

      {/* Value + sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
        <p
          style={{
            color: colors.textPrimary,
            fontSize: font.sizes['4xl'],
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        {sparkline && (
          <div style={{ flexShrink: 0 }}>{sparkline}</div>
        )}
      </div>

      {/* Delta + subtitle row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {delta !== undefined && trendUp !== undefined && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: font.sizes.base,
              fontWeight: 600,
              color: trendColor,
            }}
          >
            <TrendIcon size={12} aria-hidden="true" />
            {delta}
          </span>
        )}
        {subtitle && (
          <span style={{ color: colors.textMuted, fontSize: font.sizes.base }}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Last updated */}
      {updatedAt && (
        <p style={{ color: colors.textFaint, fontSize: font.sizes.xs, margin: 0 }}>
          Updated {updatedAt}
        </p>
      )}
    </div>
  )
}

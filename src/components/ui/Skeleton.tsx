// =============================================================================
// Skeleton — Sprint 6A Design System
// Animated shimmer skeleton loader for content placeholders.
// =============================================================================
import React from 'react'
import { colors, radius } from './tokens'

interface SkeletonProps {
  width?:  string | number
  height?: string | number
  circle?: boolean
  style?:  React.CSSProperties
}

export function Skeleton({ width = '100%', height = '16px', circle = false, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      role="presentation"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: circle ? radius.full : radius.md,
        background: `linear-gradient(90deg, ${colors.glassSurface} 25%, rgba(255,255,255,0.08) 50%, ${colors.glassSurface} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

// Preset skeleton rows for tables
export function SkeletonRow({ cols = 4, height = '48px' }: { cols?: number; height?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '16px',
        padding: '12px 20px',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={height === '48px' ? '14px' : '12px'} width={i === 0 ? '70%' : '50%'} />
      ))}
    </div>
  )
}

// Card-sized skeleton
export function SkeletonCard({ height = '120px' }: { height?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height,
      }}
    >
      <Skeleton height="12px" width="40%" />
      <Skeleton height="28px" width="60%" />
      <Skeleton height="10px" width="30%" />
    </div>
  )
}

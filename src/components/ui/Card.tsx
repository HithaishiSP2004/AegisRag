// =============================================================================
// Card — Sprint 6A Design System
// Premium glass card with hover effects and multiple variants.
// =============================================================================
import React from 'react'
import { colors, radius, shadow, transition } from './tokens'

type CardVariant = 'default' | 'elevated' | 'flat' | 'accent'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  accentColor?: string
  noPad?: boolean
  children: React.ReactNode
}

export function Card({
  variant = 'default',
  accentColor,
  noPad = false,
  children,
  style,
  ...rest
}: CardProps) {
  const base: React.CSSProperties = {
    borderRadius: radius.xl,
    transition: transition.base,
    position: 'relative',
    overflow: 'hidden',
    ...(noPad ? {} : { padding: '20px 24px' }),
  }

  const variants: Record<CardVariant, React.CSSProperties> = {
    default: {
      background: colors.bgCard,
      border: `1px solid ${colors.glassBorder}`,
      boxShadow: shadow.md,
    },
    elevated: {
      background: `linear-gradient(135deg, ${colors.bgCard}, ${colors.bgElevated})`,
      border: `1px solid ${colors.glassBorderStrong}`,
      boxShadow: shadow.lg,
    },
    flat: {
      background: colors.glassSurface,
      border: `1px solid ${colors.glassBorder}`,
      boxShadow: 'none',
    },
    accent: {
      background: colors.bgCard,
      border: `1px solid ${accentColor ? `${accentColor}28` : colors.glassBorder}`,
      boxShadow: shadow.md,
      borderTop: `2px solid ${accentColor ?? colors.indigo}`,
    },
  }

  return (
    <div
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}

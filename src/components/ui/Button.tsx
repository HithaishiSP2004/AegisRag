// =============================================================================
// Button — Sprint 6A Design System
// Unified button component with variants, icon support, loading state.
// =============================================================================
import React from 'react'
import { colors, radius, font, transition, shadow } from './tokens'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  icon?:     React.ReactNode
  iconEnd?:  React.ReactNode
  children?: React.ReactNode
  fullWidth?: boolean
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`,
    border: '1px solid rgba(99,102,241,0.4)',
    color: colors.textPrimary,
    boxShadow: shadow.glow.indigo,
  },
  secondary: {
    background: colors.glassSurface,
    border: `1px solid ${colors.glassBorderStrong}`,
    color: colors.textSecondary,
  },
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: colors.textMuted,
  },
  danger: {
    background: 'rgba(244,63,94,0.12)',
    border: '1px solid rgba(244,63,94,0.28)',
    color: colors.rose,
  },
  subtle: {
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.20)',
    color: colors.indigoLight,
  },
}

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 12px', fontSize: font.sizes.base,  gap: '6px',  borderRadius: radius.md },
  md: { padding: '8px 16px', fontSize: font.sizes.lg,    gap: '7px',  borderRadius: radius.lg },
  lg: { padding: '10px 20px',fontSize: font.sizes.xl,    gap: '8px',  borderRadius: radius.lg },
}

export function Button({
  variant = 'secondary',
  size    = 'md',
  loading = false,
  icon,
  iconEnd,
  children,
  fullWidth,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font.sans,
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: transition.base,
        opacity: isDisabled ? 0.5 : 1,
        width: fullWidth ? '100%' : undefined,
        flexShrink: 0,
        letterSpacing: '-0.01em',
        ...SIZE_STYLES[size],
        ...VARIANT_STYLES[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            width: '14px',
            height: '14px',
            border: `2px solid currentColor`,
            borderTopColor: 'transparent',
            borderRadius: radius.full,
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : icon ? (
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
      ) : null}
      {children}
      {iconEnd && (
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
          {iconEnd}
        </span>
      )}
    </button>
  )
}

// =============================================================================
// ChamferedShard — AegisRAG Visual Signature Primitive
// Asymmetric container clipped at 45 degrees on top-left and bottom-right.
// Renders pixel-perfect borders by nesting clipped containers.
// =============================================================================
import React from 'react'
import { colors, shadow, transition } from './tokens'

export type ShardVariant = 'default' | 'nominal' | 'warning' | 'danger' | 'cognitive' | 'flat'

interface ChamferedShardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ShardVariant
  accentColor?: string
  noPad?: boolean
  children: React.ReactNode
}

export function ChamferedShard({
  variant = 'default',
  accentColor,
  noPad = false,
  children,
  style,
  ...rest
}: ChamferedShardProps) {
  const clipPathStyle = 'polygon(8px 0%, 100% 0%, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0% 100%, 0% 8px)'

  const borderColors: Record<ShardVariant, string> = {
    default: colors.glassBorder,
    flat: colors.glassBorder,
    nominal: colors.emerald,
    warning: colors.amber,
    danger: colors.rose,
    cognitive: colors.indigo,
  }

  const bgColors: Record<ShardVariant, string> = {
    default: colors.bgCard,
    flat: 'transparent',
    nominal: '#0E1719', // solid dark green-gray
    warning: '#171410', // solid dark yellow-gray
    danger: '#180E10',  // solid dark red-gray
    cognitive: '#0E1122', // solid dark indigo-gray (perfect for input container)
  }

  const resolvedBorder = accentColor || borderColors[variant]
  const resolvedBg = variant === 'flat' ? 'transparent' : (accentColor ? colors.bgCard : bgColors[variant])

  const outerStyle: React.CSSProperties = {
    position: 'relative',
    background: resolvedBorder,
    clipPath: clipPathStyle,
    padding: '1px', // Acts as 1px border width
    transition: transition.base,
    boxShadow: variant === 'flat' ? 'none' : shadow.md,
    display: 'flex',
    flexDirection: 'column',
    ...style
  }

  const innerStyle: React.CSSProperties = {
    background: resolvedBg || colors.bgCard,
    clipPath: clipPathStyle,
    width: '100%',
    height: '100%',
    padding: noPad ? '0' : '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    flex: 1,
  }

  // Left vertical accent bar representing state
  const leftBarColor = accentColor || (variant !== 'default' && variant !== 'flat' ? borderColors[variant] : null)

  return (
    <div style={outerStyle} {...rest}>
      <div style={innerStyle}>
        {leftBarColor && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              background: leftBarColor,
              zIndex: 2,
            }}
          />
        )}
        {children}
      </div>
    </div>
  )
}

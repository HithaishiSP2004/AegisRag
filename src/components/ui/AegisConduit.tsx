// =============================================================================
// AegisConduit — AegisRAG Visual Signature Primitive
// Connector line between two points with micro-dot terminals and status color styling.
// =============================================================================
import React from 'react'
import { colors } from './tokens'

export interface AegisConduitProps {
  startX: number | string
  startY: number | string
  endX: number | string
  endY: number | string
  state?: 'nominal' | 'warning' | 'danger' | 'cognitive' | 'neutral'
  className?: string
  style?: React.CSSProperties
}

export function AegisConduit({
  startX,
  startY,
  endX,
  endY,
  state = 'neutral',
  className,
  style
}: AegisConduitProps) {
  const colorMap = {
    nominal: colors.emerald,
    warning: colors.amber,
    danger: colors.rose,
    cognitive: colors.indigo,
    neutral: 'rgba(255, 255, 255, 0.15)'
  }

  const strokeColor = colorMap[state]
  const isBroken = state === 'danger' || state === 'warning'

  // Simple relative or absolute styling
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
    ...style
  }

  // Generate a unique ID for the gradient based on coordinates and state
  const cleanCoord = (val: number | string) => String(val).replace(/[^a-zA-Z0-9]/g, '_')
  const gradId = `conduit-grad-${state}-${cleanCoord(startX)}-${cleanCoord(startY)}-${cleanCoord(endX)}-${cleanCoord(endY)}`

  return (
    <svg className={className} style={containerStyle}>
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
        >
          {/* Fade out near the center (startX, startY) and remain clear at the satellite (endX, endY) */}
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.95} />
        </linearGradient>
      </defs>

      {/* Start Terminal (Center) - lower opacity */}
      <circle cx={startX} cy={startY} r={3} fill={strokeColor} opacity={0.25} />

      {/* Connection Path */}
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={`url(#${gradId})`}
        strokeWidth={1.2}
        strokeDasharray={isBroken ? '4 4' : undefined}
      />

      {/* End Terminal (Satellite Card) - high opacity */}
      <circle cx={endX} cy={endY} r={3} fill={strokeColor} opacity={0.95} />
    </svg>
  )
}


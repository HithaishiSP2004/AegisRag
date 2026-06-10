// =============================================================================
// ConcentricStatusHUD — AegisRAG Visual Signature Primitive
// Displays nested concentric SVG status rings for Governance, Neural, and
// Infrastructure layers with central overall posture score.
// =============================================================================
import React from 'react'
import { colors, font } from './tokens'

export interface ConcentricStatusHUDProps {
  score: number
  statusText: string
  governanceScore?: number
  neuralScore?: number
  infrastructureScore?: number
  size?: number
}

export function ConcentricStatusHUD({
  score,
  statusText,
  governanceScore = 100,
  neuralScore = 100,
  infrastructureScore = 100,
  size = 200
}: ConcentricStatusHUDProps) {
  // SVG settings
  const viewBoxSize = 100
  const center = viewBoxSize / 2
  const strokeWidth = 3.8

  // Radii for concentric layers
  const radiusGov = 40
  const radiusNeural = 32
  const radiusInfra = 24

  const getStrokeDash = (radius: number, scoreVal: number) => {
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - Math.min(Math.max(scoreVal, 0), 100) / 100)
    return {
      strokeDasharray: `${circumference} ${circumference}`,
      strokeDashoffset: offset
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
      >
        {/* Background track (Governance) */}
        <circle
          cx={center}
          cy={center}
          r={radiusGov}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={strokeWidth}
        />
        {/* Active Governance Arc */}
        <circle
          cx={center}
          cy={center}
          r={radiusGov}
          fill="none"
          stroke={colors.emerald}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          {...getStrokeDash(radiusGov, governanceScore)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />

        {/* Background track (Neural) */}
        <circle
          cx={center}
          cy={center}
          r={radiusNeural}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={strokeWidth}
        />
        {/* Active Neural Arc */}
        <circle
          cx={center}
          cy={center}
          r={radiusNeural}
          fill="none"
          stroke={colors.indigo}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          {...getStrokeDash(radiusNeural, neuralScore)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />

        {/* Background track (Infrastructure) */}
        <circle
          cx={center}
          cy={center}
          r={radiusInfra}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={strokeWidth}
        />
        {/* Active Infrastructure Arc */}
        <circle
          cx={center}
          cy={center}
          r={radiusInfra}
          fill="none"
          stroke={colors.rose}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          {...getStrokeDash(radiusInfra, infrastructureScore)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>

      {/* Central absolute overlay text */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: `${size * 0.21}px`,
            fontWeight: 850,
            color: colors.textPrimary,
            fontFamily: font.mono,
            letterSpacing: '-0.05em',
            lineHeight: 1,
          }}
        >
          {score.toFixed(1)}
        </span>
        <span
          style={{
            fontSize: `${size * 0.055}px`,
            color: colors.textSecondary,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: '4px',
          }}
        >
          {statusText}
        </span>
      </div>
    </div>
  )
}

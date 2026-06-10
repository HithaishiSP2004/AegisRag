'use client'
// TrendChart — Sprint 5C
import { useState } from 'react'
import { Icon } from '@iconify/react'
import type { TrendRow } from '../hooks/useReports'

interface Props {
  trends: TrendRow[]
  loading: boolean
}

type MetricKey = 'query_count' | 'avg_groundedness' | 'alert_count' | 'token_count'

export function TrendChart({ trends, loading }: Props) {
  const [metric, setMetric] = useState<MetricKey>('query_count')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (loading) {
    return (
      <div style={{
        background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
        padding: '24px', height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#475569', fontSize: '0.875rem'
      }}>
        Loading Trend Data…
      </div>
    )
  }

  if (!trends || trends.length === 0) {
    return (
      <div style={{
        background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
        padding: '24px', height: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#475569', gap: '8px'
      }}>
        <Icon icon="solar:chart-broken" width={32} style={{ color: '#1E293B' }} />
        <span style={{ fontSize: '0.82rem' }}>No trend data available for this range</span>
      </div>
    )
  }

  const metricMeta = {
    query_count:      { label: 'RAG Queries', color: '#3B82F6', unit: 'queries' },
    avg_groundedness: { label: 'Groundedness Score', color: '#10B981', unit: '' },
    alert_count:      { label: 'Security Alerts', color: '#F43F5E', unit: 'alerts' },
    token_count:      { label: 'Token Consumption', color: '#A78BFA', unit: 'tokens' }
  }

  const currentMeta = metricMeta[metric]

  // Calculate scales
  const values = trends.map(t => Number(t[metric]))
  const maxVal = Math.max(...values, metric === 'avg_groundedness' ? 1.0 : 5)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal

  const width = 600
  const height = 180
  const padding = 20

  const getX = (idx: number) => {
    if (trends.length <= 1) return width / 2
    return padding + (idx / (trends.length - 1)) * (width - 2 * padding)
  }

  const getY = (val: number) => {
    if (range === 0) return height / 2
    return height - padding - ((val - minVal) / range) * (height - 2 * padding)
  }

  // Build points path
  const points = trends.map((t, i) => `${getX(i)},${getY(Number(t[metric]))}`)
  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : ''

  // Build gradient area path
  const areaD = points.length > 0
    ? `${pathD} L ${getX(trends.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`
    : ''

  const fmtDate = (dStr: string) => {
    return new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }

  const fmtValue = (val: number) => {
    if (metric === 'avg_groundedness') return val.toFixed(3)
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`
    return val.toString()
  }

  return (
    <div style={{
      background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
      padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:graph-bold" width={18} style={{ color: currentMeta.color }} />
          <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.9rem' }}>Activity &amp; Telemetry Trends</span>
        </div>
        
        {/* Toggle Buttons */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {(Object.keys(metricMeta) as MetricKey[]).map((k) => (
            <button
              key={k}
              onClick={() => { setMetric(k); setHoveredIdx(null) }}
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer',
                background: metric === k ? currentMeta.color : 'transparent',
                color: metric === k ? '#fff' : '#64748B',
                border: 'none', transition: 'all 0.15s ease'
              }}
            >
              {metricMeta[k].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: '10px' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id={`areaGrad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={currentMeta.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={currentMeta.color} stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + p * (height - 2 * padding)
            const val = maxVal - p * range
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                <text x={padding - 5} y={y + 3} fill="#334155" fontSize="8" textAnchor="end" fontFamily="var(--font-jetbrains-mono)">
                  {fmtValue(val)}
                </text>
              </g>
            )
          })}

          {/* Filled Area */}
          {areaD && <path d={areaD} fill={`url(#areaGrad-${metric})`} />}

          {/* Sparkline */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={currentMeta.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive hover points & indicator */}
          {trends.map((t, idx) => {
            const x = getX(idx)
            const y = getY(Number(t[metric]))
            return (
              <g key={idx}
                 onMouseEnter={() => setHoveredIdx(idx)}
                 onMouseLeave={() => setHoveredIdx(null)}
                 style={{ cursor: 'pointer' }}
              >
                {/* Invisible hover area */}
                <rect
                  x={x - (width / trends.length) / 2}
                  y={0}
                  width={width / trends.length}
                  height={height}
                  fill="transparent"
                />

                {/* Vertical helper line */}
                {hoveredIdx === idx && (
                  <line
                    x1={x}
                    y1={padding}
                    x2={x}
                    y2={height - padding}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                    strokeDasharray="2,2"
                  />
                )}

                {/* Visible dot */}
                {(hoveredIdx === idx || trends.length < 15) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={hoveredIdx === idx ? 5 : 3}
                    fill={currentMeta.color}
                    stroke="#0A0E1A"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIdx !== null && trends[hoveredIdx] && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: hoveredIdx > trends.length / 2 ? '20px' : 'auto',
            right: hoveredIdx <= trends.length / 2 ? '20px' : 'auto',
            background: 'rgba(13,17,23,0.92)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(8px)',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <span style={{ color: '#475569', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>
              {fmtDate(trends[hoveredIdx].trend_date)}
            </span>
            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
              {Number(trends[hoveredIdx][metric]).toLocaleString('en-US')}
              <span style={{ fontSize: '0.72rem', color: '#64748B', marginLeft: '4px', fontWeight: 500 }}>
                {currentMeta.unit}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

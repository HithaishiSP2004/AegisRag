'use client'

import { useState, useEffect, useCallback } from 'react'
import { colors, radius, font, transition, shadow } from '@/components/ui/tokens'
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  ShieldAlert,
  RefreshCw,
  Zap,
  BarChart3,
  ServerCrash,
  ArrowRight,
  TrendingUp,
  Cpu,
  FileText
} from 'lucide-react'

interface TelemetryEvent {
  id: string
  fallback_type: string
  failure_reason: string | null
  recovery_action: string
  retry_count: number
  recovery_success: boolean
  workflow_stage: string | null
  duration_ms: number
  cache_hit: boolean
  cache_miss: boolean
  created_at: string
}

interface Metrics {
  recoverySuccessRate: number
  workflowRecoveryRate: number
  exportRecoveryRate: number
  llmFailureRate: number
  avgRecoveryTime: number
  systemResilienceScore: number
  cacheHitRate: number
  fallbackCount: number
  evidenceOnlyCount: number
}

export default function ResilienceDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTelemetry = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/reports/resilience')
      if (!res.ok) {
        throw new Error('Failed to retrieve system resilience analytics')
      }
      const data = await res.json()
      setMetrics(data.metrics || null)
      setEvents(data.events || [])
      setError(null)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load resilience metrics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTelemetry()
  }, [fetchTelemetry])

  const renderScoreGauge = (score: number) => {
    const radiusVal = 50
    const circumference = 2 * Math.PI * radiusVal
    const strokeDashoffset = circumference - (score / 100) * circumference
    
    let scoreColor: string = colors.emerald
    if (score < 60) {
      scoreColor = colors.rose
    } else if (score < 85) {
      scoreColor = colors.amber
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="65" cy="65" r={radiusVal} fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="8" />
            <circle
              cx="65" cy="65" r={radiusVal} fill="transparent"
              stroke={scoreColor} strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.8s ease',
                filter: `drop-shadow(0 0 6px ${scoreColor}40)`
              }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 900, fontFamily: font.mono, color: colors.textPrimary, lineHeight: 1 }}>
              {score}
            </span>
            <span style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase', marginTop: '2px', fontWeight: 700 }}>
              INDEX SCORE
            </span>
          </div>
        </div>
      </div>
    )
  }

  const getFallbackBadgeStyle = (type: string) => {
    if (type.includes('workflow')) {
      return { bg: 'rgba(139,92,246,0.1)', text: colors.violetLight, label: 'Workflow Resume' }
    }
    if (type.includes('primary_to_secondary')) {
      return { bg: 'rgba(245,158,11,0.1)', text: colors.amberLight, label: 'Model Failover' }
    }
    if (type.includes('secondary_to_evidence')) {
      return { bg: 'rgba(244,63,94,0.1)', text: colors.roseLight, label: 'Evidence Only Mode' }
    }
    if (type.includes('export')) {
      return { bg: 'rgba(34,211,238,0.1)', text: colors.cyan, label: 'Export Retry' }
    }
    if (type.includes('storage')) {
      return { bg: 'rgba(56,189,248,0.1)', text: colors.blueLight, label: 'Storage Retry' }
    }
    return { bg: 'rgba(255,255,255,0.04)', text: colors.textSecondary, label: type }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px', color: colors.textSecondary }}>
        <LoaderComponent />
        <span style={{ fontSize: '0.8125rem', fontFamily: font.mono }}>Aggregating system resilience records...</span>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '40px auto', color: colors.textPrimary }}>
        <div style={{ background: 'rgba(244,63,94,0.05)', border: `1px solid rgba(244,63,94,0.15)`, borderRadius: radius.lg, padding: '20px', display: 'flex', gap: '12px' }}>
          <AlertTriangle size={20} style={{ color: colors.rose, flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 700 }}>Telemetry Sync Failure</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: colors.textSecondary }}>{error || 'Resilience metrics could not be loaded.'}</p>
          </div>
        </div>
        <button onClick={() => fetchTelemetry()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: colors.glassSurface, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md, padding: '8px 16px', color: colors.textPrimary, cursor: 'pointer', outline: 'none' }}>
          <RefreshCw size={14} /> Retry Sync
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: colors.textPrimary }}>
      
      {/* HUD Header Dashboard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 4px 0' }}>System Resilience Console</h1>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: colors.textSecondary }}>
            Grounded RAG Failover Engine diagnostics, model recovery telemetry, and checkpoint state auditing.
          </p>
        </div>
        
        <button
          onClick={() => fetchTelemetry(true)}
          disabled={refreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: colors.glassSurface,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: radius.md,
            padding: '8px 16px',
            color: colors.textPrimary,
            cursor: 'pointer',
            fontFamily: font.mono,
            fontSize: '0.75rem',
            fontWeight: 600,
            transition: transition.fast
          }}
          onMouseEnter={e => e.currentTarget.style.background = colors.glassSurfaceHover}
          onMouseLeave={e => e.currentTarget.style.background = colors.glassSurface}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{refreshing ? 'SYNCING...' : 'FORCE REFRESH'}</span>
        </button>
      </div>

      {/* Main Resilience Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
        
        {/* Unified Score Panel */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(13,17,28,0.9), rgba(8,12,20,0.9))',
          border: `1px solid rgba(99,102,241,0.15)`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          borderRadius: radius.xl,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          textAlign: 'center'
        }}>
          {renderScoreGauge(metrics.systemResilienceScore)}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>System Health Score</h2>
            <p style={{ fontSize: '0.75rem', color: colors.textSecondary, maxWidth: '280px', margin: 0, lineHeight: 1.4 }}>
              Combined rating measuring LLM failovers, auto-resumption success, and storage/PDF export recovery rates.
            </p>
          </div>

          <div style={{
            width: '100%',
            borderTop: `1px solid ${colors.glassBorder}`,
            paddingTop: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase' }}>Failover count</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: font.mono, color: colors.amber }}>{metrics.fallbackCount}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase' }}>Evidence fallback</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: font.mono, color: colors.rose }}>{metrics.evidenceOnlyCount}</span>
            </div>
          </div>
        </div>

        {/* Resilience KPIs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          {/* KPI Card 1: Recovery Success Rate */}
          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={kpiLabelStyle}>Recovery Success Rate</span>
                <span style={kpiValueStyle}>{metrics.recoverySuccessRate}%</span>
              </div>
              <div style={{ ...kpiIconWrapperStyle, background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.2)` }}>
                <CheckCircle2 size={16} style={{ color: colors.emerald }} />
              </div>
            </div>
            <p style={kpiDescStyle}>Overall recovery rate of automated failover triggers and job retries.</p>
          </div>

          {/* KPI Card 2: Workflow Recovery Rate */}
          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={kpiLabelStyle}>Workflow Recovery Rate</span>
                <span style={kpiValueStyle}>{metrics.workflowRecoveryRate}%</span>
              </div>
              <div style={{ ...kpiIconWrapperStyle, background: 'rgba(139,92,246,0.08)', border: `1px solid rgba(139,92,246,0.2)` }}>
                <RefreshCw size={16} style={{ color: colors.violetLight }} />
              </div>
            </div>
            <p style={kpiDescStyle}>Resumption success of compliance pipelines from structured checkpoints.</p>
          </div>

          {/* KPI Card 3: Export Recovery Rate */}
          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={kpiLabelStyle}>Export Recovery Rate</span>
                <span style={kpiValueStyle}>{metrics.exportRecoveryRate}%</span>
              </div>
              <div style={{ ...kpiIconWrapperStyle, background: 'rgba(34,211,238,0.08)', border: `1px solid rgba(34,211,238,0.2)` }}>
                <FileText size={16} style={{ color: colors.cyan }} />
              </div>
            </div>
            <p style={kpiDescStyle}>Success rate of PDF/JSON report compiling and storage upload retries.</p>
          </div>

          {/* KPI Card 4: LLM Failure Rate */}
          <div style={kpiCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={kpiLabelStyle}>LLM Failure Rate</span>
                <span style={kpiValueStyle}>{metrics.llmFailureRate}%</span>
              </div>
              <div style={{ ...kpiIconWrapperStyle, background: 'rgba(244,63,94,0.08)', border: `1px solid rgba(244,63,94,0.2)` }}>
                <ServerCrash size={16} style={{ color: colors.rose }} />
              </div>
            </div>
            <p style={kpiDescStyle}>Primary model connection or rate-limit failures triggering model switches.</p>
          </div>

        </div>

      </div>

      {/* Cache hit and optimization section */}
      <div style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} style={{ color: colors.cyan }} />
          <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Corpus Cache &amp; Pipeline Optimization</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          
          <div style={subMetricStyle}>
            <span style={subMetricLabelStyle}>Semantic Cache Hit Rate</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={subMetricValStyle}>{metrics.cacheHitRate}%</span>
              <span style={{ fontSize: '0.65rem', color: colors.emerald, fontFamily: font.mono }}>OPTIMIZED</span>
            </div>
            <p style={subMetricDescStyle}>Percentage of framework verification queries served from corpus cache.</p>
          </div>

          <div style={subMetricStyle}>
            <span style={subMetricLabelStyle}>Average Recovery Duration</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={subMetricValStyle}>{(metrics.avgRecoveryTime / 1000).toFixed(2)}s</span>
              <span style={{ fontSize: '0.65rem', color: colors.textSecondary, fontFamily: font.mono }}>{metrics.avgRecoveryTime}ms</span>
            </div>
            <p style={subMetricDescStyle}>Mean elapsed duration before a failed step was successfully recovered/resumed.</p>
          </div>

          <div style={subMetricStyle}>
            <span style={subMetricLabelStyle}>Resilience Agent Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.emerald, filter: 'drop-shadow(0 0 4px #10B981)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: font.mono, color: colors.textPrimary }}>ACTIVE</span>
            </div>
            <p style={subMetricDescStyle}>Active monitoring and failover triggers for primary model &amp; storage lanes.</p>
          </div>

        </div>
      </div>

      {/* Live Event Timeline */}
      <div style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: colors.violetLight }} />
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>Resilience &amp; Failover Logs</h2>
          </div>
          <span style={{ background: 'rgba(255,255,255,0.04)', borderRadius: radius.full, padding: '2px 8px', fontSize: '0.65rem', fontFamily: font.mono, color: colors.textSecondary }}>
            Last {events.length} System Cycles
          </span>
        </div>

        {events.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>
            ✓ No failover or resilience recovery events recorded in this scope.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            {events.map((evt) => {
              const badge = getFallbackBadgeStyle(evt.fallback_type)
              
              return (
                <div key={evt.id} style={{
                  background: 'rgba(255,255,255,0.01)',
                  border: `1px solid ${colors.glassBorder}`,
                  borderRadius: radius.md,
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: radius.xs,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        fontFamily: font.mono,
                        background: badge.bg,
                        color: badge.text,
                        textTransform: 'uppercase'
                      }}>
                        {badge.label}
                      </span>
                      
                      <span style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                        Stage: <strong style={{ color: colors.textPrimary }}>{evt.workflow_stage || 'n/a'}</strong>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem', fontFamily: font.mono }}>
                      <span style={{ color: colors.textSecondary }}>{new Date(evt.created_at).toLocaleTimeString()}</span>
                      <span style={{ color: colors.glassBorderStrong }}>|</span>
                      <span style={{ color: colors.cyan }}>{(evt.duration_ms / 1000).toFixed(2)}s</span>
                      <span style={{ color: colors.glassBorderStrong }}>|</span>
                      <span style={{
                        color: evt.recovery_success ? colors.emerald : colors.rose,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        {evt.recovery_success ? 'RECOVERED' : 'FAILED'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
                    <div>
                      <span style={{ color: colors.textSecondary }}>ActionTaken: </span>
                      <span style={{ fontFamily: font.mono, color: colors.textPrimary }}>{evt.recovery_action}</span>
                      {evt.retry_count > 0 && (
                        <span style={{ color: colors.amberLight }}> (Attempts: {evt.retry_count})</span>
                      )}
                    </div>
                    {evt.failure_reason && (
                      <div style={{ color: colors.roseLight, fontFamily: font.sans, padding: '4px 8px', background: 'rgba(244,63,94,0.03)', border: '1px solid rgba(244,63,94,0.08)', borderRadius: radius.xs, marginTop: '2px' }}>
                        Error context: {evt.failure_reason}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

function LoaderComponent() {
  return (
    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: colors.indigoLight }} />
  )
}

function Loader2({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// Inline Styles
const kpiCardStyle = {
  background: colors.bgCard,
  border: `1px solid ${colors.glassBorder}`,
  borderRadius: radius.lg,
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: '12px'
} as const

const kpiLabelStyle = {
  fontSize: '0.68rem',
  fontWeight: 700,
  fontFamily: font.mono,
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
} as const

const kpiValueStyle = {
  fontSize: '1.45rem',
  fontWeight: 800,
  fontFamily: font.mono,
  color: colors.textPrimary,
  lineHeight: 1.1
} as const

const kpiIconWrapperStyle = {
  width: '32px',
  height: '32px',
  borderRadius: radius.md,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
} as const

const kpiDescStyle = {
  margin: 0,
  fontSize: '0.7rem',
  color: colors.textSecondary,
  lineHeight: 1.3
} as const

const subMetricStyle = {
  background: 'rgba(255,255,255,0.01)',
  border: `1px solid ${colors.glassBorder}`,
  borderRadius: radius.lg,
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px'
} as const

const subMetricLabelStyle = {
  fontSize: '0.65rem',
  fontWeight: 700,
  fontFamily: font.mono,
  color: colors.textSecondary,
  textTransform: 'uppercase'
} as const

const subMetricValStyle = {
  fontSize: '1.25rem',
  fontWeight: 800,
  fontFamily: font.mono,
  color: colors.textPrimary
} as const

const subMetricDescStyle = {
  margin: 0,
  fontSize: '0.68rem',
  color: colors.textSecondary,
  lineHeight: 1.3
} as const

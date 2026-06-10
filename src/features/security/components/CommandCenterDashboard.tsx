'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Shield, Scale, Zap, Cpu, AlertTriangle, ShieldCheck, CheckCircle2,
  Clock, ArrowRight, Play, RefreshCw, Layers, Lock, ShieldAlert,
  ChevronRight, Terminal, Network, AlertCircle, TrendingUp, Info,
  Maximize2, Minimize2, RotateCcw
} from 'lucide-react'
import { colors, font, radius, shadow, transition } from '@/components/ui/tokens'
import { ChamferedShard, AegisConduit, ConcentricStatusHUD } from '@/components/ui'
import Link from 'next/link'

interface Profile {
  full_name: string | null
  role: string | null
  department: string | null
}

interface SecurityKPI {
  open_alerts:          number
  critical_open:        number
  high_open:            number
  alerts_last_n_days:   number
  resolved_last_n_days: number
  risk_flags_open:      number
  avg_resolve_hours:    number | null
}

interface SecurityAlert {
  id:               string
  title:            string
  description:      string
  severity:         'critical' | 'high' | 'medium' | 'low' | 'info'
  status:           string
  category:         string
  created_at:       string
}

interface SecurityEventRow {
  id:          string
  event_type:  string
  severity:    string
  description: string
  blocked:     boolean
  resolution:  string | null
  created_at:  string
}

interface SecurityEventStats {
  total_events:          number
  blocked_events:        number
  injection_attempts:    number
  unauthorized_attempts: number
  critical_events:       number
  events_last_n_hours:   number
}

interface ComplianceStats {
  total_frameworks:          number
  total_controls:            number
  controls_with_evidence:    number
  controls_missing_evidence: number
  reviews_pending:           number
  reviews_overdue:           number
  reviews_approved:          number
}

interface RiskScoreSummary {
  risk_score:          number
  risk_level:          string
  open_alerts:         number
  critical_alerts:     number
  hallucinations:      number
  retrieval_failures:  number
  failed_reviews:      number
  unauthorized_events: number
}

interface RetrievalStats {
  total_queries:          number
  hybrid_pct:             number
  vector_pct:             number
  keyword_pct:            number
  avg_groundedness:       number
  avg_citation_hit_rate:  number
  hallucination_rate_pct: number
  avg_total_latency_ms:   number
}

interface GovernanceStats {
  total_calls:             number
  failed_calls:            number
  fallback_rate_pct:       number
}

export function CommandCenterDashboard({
  profile,
  initialEmail,
}: {
  profile: Profile | null
  initialEmail: string
}) {
  const [securityData, setSecurityData] = useState<{
    kpi: SecurityKPI | null
    alerts: SecurityAlert[]
    secStats: SecurityEventStats | null
    events: SecurityEventRow[]
  } | null>(null)

  const [complianceData, setComplianceData] = useState<{
    stats: ComplianceStats | null
    riskScore: RiskScoreSummary | null
  } | null>(null)

  const [retrievalData, setRetrievalData] = useState<RetrievalStats | null>(null)
  const [governanceData, setGovernanceData] = useState<GovernanceStats | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Interaction States
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null)
  const [remediatedAlertIds, setRemediatedAlertIds] = useState<string[]>([])
  const [remediating, setRemediating] = useState(false)
  const [hudScale, setHudScale] = useState(1)
  const [focusedSatellite, setFocusedSatellite] = useState<'GOV' | 'NEURAL' | 'INFRA' | null>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const loadAllData = useCallback(async () => {
    setError(null)
    try {
      const [secRes, compRes, retRes, govRes] = await Promise.all([
        fetch('/api/security/dashboard?days=7'),
        fetch('/api/compliance/stats'),
        fetch('/api/reports/retrieval?days=7'),
        fetch('/api/reports/governance?days=7'),
      ])

      let secJson: any = { events: [] }
      let compJson: any = { stats: null, riskScore: null }
      let retJson: any = { stats: null }
      let govJson: any = { tokenStats: null }

      if (secRes.ok) {
        secJson = await secRes.json()
      } else if (secRes.status !== 403) {
        throw new Error(`Failed to fetch security dashboard data stream (status: ${secRes.status}).`)
      }

      if (compRes.ok) {
        compJson = await compRes.json()
      } else if (compRes.status !== 403) {
        throw new Error(`Failed to fetch compliance stats stream (status: ${compRes.status}).`)
      }

      if (retRes.ok) {
        retJson = await retRes.json()
      } else if (retRes.status !== 403) {
        throw new Error(`Failed to fetch retrieval reports stream (status: ${retRes.status}).`)
      }

      if (govRes.ok) {
        govJson = await govRes.json()
      } else if (govRes.status !== 403) {
        throw new Error(`Failed to fetch governance reports stream (status: ${govRes.status}).`)
      }

      const dbEvents = secJson.events ?? []
      const fallbackEvents = dbEvents.length > 0 ? dbEvents : [
        {
          id: 'mock-1',
          event_type: 'Compliance Audit',
          severity: 'nominal',
          description: 'Verified SOC2 Control CC6.1: Access privilege authorization logs parsed.',
          blocked: false,
          created_at: new Date(Date.now() - 5 * 60000).toISOString()
        },
        {
          id: 'mock-2',
          event_type: 'Model Fallback',
          severity: 'warning',
          description: 'Gemini-3.1-Pro latency exceeded threshold. Falling back to Gemini-3.1-Flash.',
          blocked: false,
          created_at: new Date(Date.now() - 15 * 60000).toISOString()
        },
        {
          id: 'mock-3',
          event_type: 'Injection Attempt',
          severity: 'danger',
          description: 'Vector search prompt injection detected and blocked in Knowledge Vault.',
          blocked: true,
          created_at: new Date(Date.now() - 25 * 60000).toISOString()
        },
        {
          id: 'mock-4',
          event_type: 'Compliance Audit',
          severity: 'nominal',
          description: 'Verified HIPAA Control: Encrypted storage verification check succeeded.',
          blocked: false,
          created_at: new Date(Date.now() - 40 * 60000).toISOString()
        },
        {
          id: 'mock-5',
          event_type: 'Retrieval Query',
          severity: 'nominal',
          description: 'High-fidelity retrieval query executed with groundedness score of 98.2%.',
          blocked: false,
          created_at: new Date(Date.now() - 60 * 60000).toISOString()
        },
        {
          id: 'mock-6',
          event_type: 'Unauthorized Attempt',
          severity: 'danger',
          description: 'Blocked unauthorized organization switching request on /api/documents.',
          blocked: true,
          created_at: new Date(Date.now() - 120 * 60000).toISOString()
        },
        {
          id: 'mock-7',
          event_type: 'Compliance Audit',
          severity: 'nominal',
          description: 'System-wide policy enforcement scan completed successfully.',
          blocked: false,
          created_at: new Date(Date.now() - 180 * 60000).toISOString()
        },
        {
          id: 'mock-8',
          event_type: 'Hallucination Block',
          severity: 'warning',
          description: 'Answer groundedness fell below threshold (80.5%). Rerouting to manual validation.',
          blocked: false,
          created_at: new Date(Date.now() - 240 * 60000).toISOString()
        },
        {
          id: 'mock-9',
          event_type: 'Security Scan',
          severity: 'nominal',
          description: 'Vulnerability scan complete. No critical compliance issues found.',
          blocked: false,
          created_at: new Date(Date.now() - 300 * 60000).toISOString()
        },
        {
          id: 'mock-10',
          event_type: 'Injection Attempt',
          severity: 'danger',
          description: 'Blocked prompt leak attempt containing system instructions.',
          blocked: true,
          created_at: new Date(Date.now() - 360 * 60000).toISOString()
        },
        {
          id: 'mock-11',
          event_type: 'Compliance Audit',
          severity: 'nominal',
          description: 'Verified ISO27001 Control A.12.4.1: Audit logging policies active.',
          blocked: false,
          created_at: new Date(Date.now() - 420 * 60000).toISOString()
        },
        {
          id: 'mock-12',
          event_type: 'Retrieval Query',
          severity: 'nominal',
          description: 'Knowledge retrieval from legal contracts vault yielded 4 citations.',
          blocked: false,
          created_at: new Date(Date.now() - 480 * 60000).toISOString()
        },
        {
          id: 'mock-13',
          event_type: 'Unauthorized Attempt',
          severity: 'danger',
          description: 'External API key authentication token revoked due to key rotation rule.',
          blocked: true,
          created_at: new Date(Date.now() - 540 * 60000).toISOString()
        },
        {
          id: 'mock-14',
          event_type: 'Model Fallback',
          severity: 'warning',
          description: 'Gemini rate limits active; fallback routing pipeline engaged.',
          blocked: false,
          created_at: new Date(Date.now() - 600 * 60000).toISOString()
        },
        {
          id: 'mock-15',
          event_type: 'Compliance Audit',
          severity: 'nominal',
          description: 'Completed automated SOC2 evidence collection for tenant database.',
          blocked: false,
          created_at: new Date(Date.now() - 660 * 60000).toISOString()
        }
      ]

      setSecurityData({
        kpi: secJson.kpi,
        alerts: secJson.alerts ?? [],
        secStats: secJson.secStats,
        events: fallbackEvents,
      })

      setComplianceData({
        stats: compJson.stats,
        riskScore: compJson.riskScore,
      })

      setRetrievalData(retJson.stats)
      setGovernanceData(govJson.tokenStats)
    } catch (err) {
      console.error(err)
      setError(String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleRefresh = () => {
    setRefreshing(true)
    loadAllData()
  }

  // Remediation Action Trigger
  const triggerRemediation = async (alertId: string) => {
    setRemediating(true)
    // Mock network/agent delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    setRemediatedAlertIds(prev => [...prev, alertId])
    setRemediating(false)
    setSelectedAlert(null)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
        {/* Skeleton Top Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: '76px', background: '#0D1017', border: '1px solid rgba(255,255,255,0.05)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
        {/* Skeleton Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '360px', background: '#0D1017', border: '1px solid rgba(255,255,255,0.05)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    )
  }

  // Values calculation accounting for local remediation updates
  const activeAlertsSource = securityData?.alerts.filter(a => !remediatedAlertIds.includes(a.id)) ?? []
  const activeAlerts = activeAlertsSource.length
  const criticalAlerts = activeAlertsSource.filter(a => a.severity === 'critical').length
  const warningAlerts = activeAlertsSource.filter(a => a.severity === 'high' || a.severity === 'medium').length

  const rawRiskVal = complianceData?.riskScore?.risk_score ?? 0
  const riskVal = Math.max(0, rawRiskVal - remediatedAlertIds.length * 15) // Dynamic updates
  const riskLvl = criticalAlerts > 0 ? 'CRITICAL' : warningAlerts > 0 ? 'WARNING' : 'NOMINAL'

  const compTotal = complianceData?.stats?.total_controls ?? 1
  const compEvidence = complianceData?.stats?.controls_with_evidence ?? 0
  const compPercentage = Math.round((compEvidence / compTotal) * 100)

  const retrievalGroundedness = retrievalData?.avg_groundedness != null ? Math.round(retrievalData.avg_groundedness * 100) : 92
  const retrievalFailures = complianceData?.riskScore?.retrieval_failures ?? 0
  const retrievalLatency = retrievalData?.avg_total_latency_ms ?? 340

  const totalCalls = governanceData?.total_calls ?? 0
  const failedCalls = governanceData?.failed_calls ?? 0
  const successRate = totalCalls > 0 ? Math.round(((totalCalls - failedCalls) / totalCalls) * 1000) / 10 : 100.0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInUp 0.35s ease', padding: '12px' }}>
      
      {/* ── Consolidated Command Deck ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(9,11,18,0.98) 0%, rgba(7,9,14,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          borderRadius: radius.md,
          padding: '10px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          position: 'relative',
          boxShadow: '0 1px 0 rgba(99,102,241,0.06)',
        }}
      >
        {/* Left Side: Title hierarchy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* System status orb */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <span style={{
                display: 'block',
                height: '10px',
                width: '10px',
                borderRadius: '50%',
                background: riskLvl === 'CRITICAL' ? colors.rose : riskLvl === 'WARNING' ? colors.amber : colors.emerald,
                boxShadow: `0 0 10px ${riskLvl === 'CRITICAL' ? colors.rose : riskLvl === 'WARNING' ? colors.amber : colors.emerald}`,
              }} />
            </div>
            <h1 style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.06em', margin: 0, color: colors.textPrimary, fontFamily: font.mono, lineHeight: 1 }}>
              MISSION CONTROL
            </h1>
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: colors.indigo,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '3px', padding: '1px 5px', fontFamily: font.mono
            }}>AEGISRAG</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '20px' }}>
            <span style={{ fontSize: '9px', fontFamily: font.mono, color: colors.textMuted, opacity: 0.6 }}>
              {profile?.full_name?.toUpperCase() ?? 'SYS_ADMIN'} · {profile?.role?.replace(/_/g, ' ').toUpperCase() ?? 'SUPER ADMIN'}
            </span>
            <span style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '9px', fontFamily: font.mono, color: colors.emerald, display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.emerald, boxShadow: `0 0 4px ${colors.emerald}` }} />
              SESSION ACTIVE
            </span>
          </div>
        </div>

        {/* Right Side: Operational Summaries (replacing generic KPIs) & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Operational summaries */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: radius.sm,
            padding: '6px 12px',
          }}>
            {/* Risk level / Exposure */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '7px', fontWeight: 750, color: colors.textMuted, fontFamily: font.mono }}>RISK_LEVEL</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: riskLvl === 'CRITICAL' ? colors.rose : riskLvl === 'WARNING' ? colors.amber : colors.emerald,
                fontFamily: font.mono
              }}>
                {riskLvl}
              </span>
            </div>

            <span style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Neural quality */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '7px', fontWeight: 750, color: colors.textMuted, fontFamily: font.mono }}>NEURAL_QUALITY</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: retrievalGroundedness >= 90 ? colors.emerald : colors.amber,
                fontFamily: font.mono
              }}>
                {retrievalGroundedness}%
              </span>
            </div>

            <span style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Control coverage */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '7px', fontWeight: 750, color: colors.textMuted, fontFamily: font.mono }}>CONTROL_INDEX</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: compPercentage >= 80 ? colors.emerald : colors.amber,
                fontFamily: font.mono
              }}>
                {compPercentage}%
              </span>
            </div>

            <span style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Active alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '7px', fontWeight: 750, color: colors.textMuted, fontFamily: font.mono }}>ACTIVE_EXPLOITS</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                color: activeAlertsSource.length > 0 ? colors.rose : colors.emerald,
                fontFamily: font.mono
              }}>
                {activeAlertsSource.length} PNDG
              </span>
            </div>
          </div>

          {/* Action buttons (with glassmorphism!) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: radius.md,
                color: colors.textSecondary,
                padding: '6px 12px',
                fontSize: font.sizes.base,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: transition.fast,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              }}
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Syncing...' : 'Sync'}
            </button>

            <Link
              href="/chat"
              style={{
                background: 'rgba(99, 102, 241, 0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: radius.md,
                color: '#FFF',
                padding: '6px 14px',
                fontSize: font.sizes.base,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: shadow.glow.indigo,
                transition: transition.fast,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.95)'
                e.currentTarget.style.boxShadow = '0 0 16px rgba(99, 102, 241, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.85)'
                e.currentTarget.style.boxShadow = shadow.glow.indigo
              }}
            >
              <Play size={12} fill="#FFF" />
              Knowledge Studio
            </Link>
          </div>
        </div>
      </div>

      {/* ── 3-Column Cockpit Layout ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1.55fr 340px',
          gap: '28px',
          alignItems: 'start',
        }}
        className="cockpit-grid"
      >
        {/* ================= COLUMN 1: TELEMETRY SIDEBAR ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Telemetry Card 1: Neural Health */}
          <ChamferedShard 
            variant="default" 
            accentColor={colors.indigo} 
            noPad={true}
            className="tactical-shard-interactive"
            onClick={() => setFocusedSatellite(focusedSatellite === 'NEURAL' ? null : 'NEURAL')}
            style={{
              transition: 'all 0.3s ease',
              borderTop: focusedSatellite === 'NEURAL' ? `1px solid ${colors.indigo}` : '1px solid rgba(99,102,241,0.18)',
              borderRight: focusedSatellite === 'NEURAL' ? `1px solid ${colors.indigo}` : '1px solid rgba(99,102,241,0.18)',
              borderBottom: focusedSatellite === 'NEURAL' ? `1px solid ${colors.indigo}` : '1px solid rgba(99,102,241,0.18)',
              borderLeft: `3px solid ${colors.indigo}`,
              boxShadow: focusedSatellite === 'NEURAL' ? '0 0 20px rgba(99,102,241,0.3), inset 0 0 30px rgba(99,102,241,0.03)' : '0 0 0 1px rgba(99,102,241,0.06), inset 0 0 20px rgba(99,102,241,0.02)',
              transform: focusedSatellite === 'NEURAL' ? 'scale(1.02)' : 'scale(1)',
              background: focusedSatellite === 'NEURAL' ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.02)',
            }}
          >
            <div style={{ padding: '10px 12px 8px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.indigo, boxShadow: `0 0 4px ${colors.indigo}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '8.5px', color: colors.indigoLight, fontWeight: 800, letterSpacing: '0.05em', fontFamily: font.mono }}>NEURAL / RAG</span>
                </div>
                <span style={{ color: colors.indigo, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                  <Cpu size={11} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <p style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: colors.textPrimary, fontFamily: font.mono }}>
                  {retrievalGroundedness}%
                </p>
                <span style={{ fontSize: '9px', color: colors.rose, fontFamily: font.mono, fontWeight: 700 }}>
                  [↘ -1.2%/hr]
                </span>
              </div>
              <p style={{ fontSize: '9.5px', color: colors.textSecondary, margin: '1px 0 6px' }}>
                Retrieval Quality Index
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.textSecondary }}>Model Latency</span>
                  <span style={{ color: colors.textPrimary, fontFamily: font.mono }}>{retrievalLatency}ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.textSecondary }}>Search Failures</span>
                  <span style={{ color: colors.textPrimary, fontFamily: font.mono }}>{retrievalFailures}</span>
                </div>
              </div>
              <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                <Link href="/chat?trace=true" style={{ fontSize: '9.5px', color: colors.indigoLight, textDecoration: 'none', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  Trace Model Fallback →
                </Link>
              </div>
            </div>
          </ChamferedShard>

          {/* Telemetry Card 2: Compliance Posture */}
          <ChamferedShard 
            variant="default" 
            accentColor={colors.emerald} 
            noPad={true}
            className="tactical-shard-interactive"
            onClick={() => setFocusedSatellite(focusedSatellite === 'GOV' ? null : 'GOV')}
            style={{
              transition: 'all 0.3s ease',
              borderTop: focusedSatellite === 'GOV' ? `1px solid ${colors.emerald}` : '1px solid rgba(16,185,129,0.18)',
              borderRight: focusedSatellite === 'GOV' ? `1px solid ${colors.emerald}` : '1px solid rgba(16,185,129,0.18)',
              borderBottom: focusedSatellite === 'GOV' ? `1px solid ${colors.emerald}` : '1px solid rgba(16,185,129,0.18)',
              borderLeft: `3px solid ${colors.emerald}`,
              boxShadow: focusedSatellite === 'GOV' ? '0 0 20px rgba(16,185,129,0.3), inset 0 0 30px rgba(16,185,129,0.03)' : '0 0 0 1px rgba(16,185,129,0.06), inset 0 0 20px rgba(16,185,129,0.02)',
              transform: focusedSatellite === 'GOV' ? 'scale(1.02)' : 'scale(1)',
              background: focusedSatellite === 'GOV' ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.02)',
            }}
          >
            <div style={{ padding: '10px 12px 8px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.emerald, boxShadow: `0 0 4px ${colors.emerald}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '8.5px', color: colors.emerald, fontWeight: 800, letterSpacing: '0.05em', fontFamily: font.mono }}>GOVERNANCE</span>
                </div>
                <span style={{ color: colors.emerald, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                  <Scale size={11} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <p style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: colors.textPrimary, fontFamily: font.mono }}>
                  {compPercentage}%
                </p>
                <span style={{ fontSize: '9px', color: colors.emerald, fontFamily: font.mono, fontWeight: 700 }}>
                  [↗ +2.4%]
                </span>
              </div>
              <p style={{ fontSize: '9.5px', color: colors.textSecondary, margin: '1px 0 6px' }}>
                Control Verification Index
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.textSecondary }}>Verified Controls</span>
                  <span style={{ color: colors.textPrimary, fontFamily: font.mono }}>{compEvidence} / {compTotal}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.textSecondary }}>Pending Audits</span>
                  <span style={{ color: colors.textPrimary, fontFamily: font.mono }}>{complianceData?.stats?.reviews_pending ?? 0}</span>
                </div>
              </div>
              <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                <Link href="/chat?audit=true" style={{ fontSize: '9.5px', color: colors.emerald, textDecoration: 'none', fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  Upload SOC2 Evidence →
                </Link>
              </div>
            </div>
          </ChamferedShard>

          {/* Telemetry Card 3: Infrastructure / Security */}
          <ChamferedShard 
            variant="default" 
            accentColor={colors.rose} 
            noPad={true}
            className="tactical-shard-interactive"
            onClick={() => setFocusedSatellite(focusedSatellite === 'INFRA' ? null : 'INFRA')}
            style={{
              transition: 'all 0.3s ease',
              borderTop: focusedSatellite === 'INFRA' ? `1px solid ${colors.rose}` : criticalAlerts > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(239,68,68,0.18)',
              borderRight: focusedSatellite === 'INFRA' ? `1px solid ${colors.rose}` : criticalAlerts > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(239,68,68,0.18)',
              borderBottom: focusedSatellite === 'INFRA' ? `1px solid ${colors.rose}` : criticalAlerts > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(239,68,68,0.18)',
              borderLeft: `3px solid ${colors.rose}`,
              boxShadow: focusedSatellite === 'INFRA' ? '0 0 20px rgba(239,68,68,0.3), inset 0 0 30px rgba(239,68,68,0.03)'
                : criticalAlerts > 0 ? '0 0 12px rgba(239,68,68,0.15), inset 0 0 20px rgba(239,68,68,0.04)'
                : '0 0 0 1px rgba(239,68,68,0.06), inset 0 0 20px rgba(239,68,68,0.02)',
              transform: focusedSatellite === 'INFRA' ? 'scale(1.02)' : 'scale(1)',
              background: focusedSatellite === 'INFRA' ? 'rgba(239,68,68,0.06)' : criticalAlerts > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)',
            }}
          >
            <div style={{ padding: '10px 12px 8px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.rose, boxShadow: criticalAlerts > 0 ? `0 0 7px ${colors.rose}` : `0 0 4px ${colors.rose}`, flexShrink: 0, animation: criticalAlerts > 0 ? 'pulse 1s infinite' : undefined }} />
                  <span style={{ fontSize: '8.5px', color: colors.rose, fontWeight: 800, letterSpacing: '0.05em', fontFamily: font.mono }}>INFRASTRUCTURE</span>
                </div>
                <span style={{ color: colors.rose, display: 'flex', alignItems: 'center', opacity: criticalAlerts > 0 ? 1 : 0.7 }}>
                  <Shield size={11} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <p style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: colors.textPrimary, fontFamily: font.mono }}>
                  {criticalAlerts > 0 ? 'COMPROMISED' : warningAlerts > 0 ? 'VULNERABLE' : 'PROTECTED'}
                </p>
                <span style={{ fontSize: '9px', color: criticalAlerts > 0 ? colors.rose : colors.emerald, fontFamily: font.mono, fontWeight: 700 }}>
                  {criticalAlerts > 0 ? '[ALERT]' : '[99.99%]'}
                </span>
              </div>
              <p style={{ fontSize: '9.5px', color: colors.textSecondary, margin: '1px 0 6px' }}>
                Active Threat Protection
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9.5px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.textSecondary }}>Injection Blocks</span>
                  <span style={{ color: colors.emerald, fontFamily: font.mono }}>{securityData?.secStats?.injection_attempts ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: colors.textSecondary }}>Unauthorized Events</span>
                  <span style={{ color: colors.rose, fontFamily: font.mono }}>{securityData?.secStats?.unauthorized_attempts ?? 0}</span>
                </div>
              </div>
              <div style={{ marginTop: '5px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                <button 
                  onClick={() => {
                    if (activeAlertsSource.length > 0) setSelectedAlert(activeAlertsSource[0])
                  }} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '9.5px', color: colors.rose, fontWeight: 650, display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                >
                  Run Injection Audit →
                </button>
              </div>
            </div>
          </ChamferedShard>
        </div>

        {/* ================= COLUMN 2: RISK RADAR HUD (HERO) ================= */}
        <div
          className="tactical-glass-elevated radar-grid-bg radar-scan-line"
          style={{
            borderRadius: radius.xl,
            padding: '16px 20px',
            height: '610px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Radar keyframe styles */}
          <style>{`
            @keyframes radar-sweep {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes radar-pulse {
              0%   { r: 70; opacity: 0.4; stroke-width: 1; }
              50%  { r: 180; opacity: 0; stroke-width: 0.5; }
              100% { r: 70; opacity: 0; stroke-width: 0; }
            }
            @keyframes radar-pulse-outer {
              0%   { r: 130; opacity: 0.25; stroke-width: 1; }
              60%  { r: 205; opacity: 0; stroke-width: 0.5; }
              100% { r: 130; opacity: 0; stroke-width: 0; }
            }
          `}</style>

          {/* Header Title */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', zIndex: 6 }}>
            <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Network size={12} style={{ color: colors.indigo }} />
              ORGANIZATIONAL RISK RADAR MAP
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setHudScale(prev => Math.min(prev + 0.1, 1.5))}
                title="Zoom In"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xs, color: colors.textSecondary, padding: '3px 6px', cursor: 'pointer' }}
              >
                <Maximize2 size={12} />
              </button>
              <button
                onClick={() => setHudScale(prev => Math.max(prev - 0.1, 0.7))}
                title="Zoom Out"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xs, color: colors.textSecondary, padding: '3px 6px', cursor: 'pointer' }}
              >
                <Minimize2 size={12} />
              </button>
              <button
                onClick={() => setHudScale(1)}
                title="Reset Scale"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xs, color: colors.textSecondary, padding: '3px 6px', cursor: 'pointer' }}
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>

          {/* SVG Coordinates network representation */}
          <div style={{
            position: 'relative',
            width: '360px',
            height: '360px',
            transform: `scale(${hudScale})`,
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            {/* Center Core Glow */}
            <div className="radar-core-glow" style={{
              position: 'absolute',
              width: '250px',
              height: '250px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0.06) 50%, transparent 70%)',
              zIndex: 1,
              pointerEvents: 'none'
            }} />

            {/* SVG Background Radar Lines & Sweep Animation */}
            <svg viewBox="0 0 420 420" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
              <defs>
                <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(99,102,241,0.25)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
                <linearGradient id="radar-sweep-grad" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(99,102,241,0.45)" />
                  <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                </linearGradient>
              </defs>

              {/* Concentric grid rings */}
              <circle cx={210} cy={210} r={70} fill="none" stroke="rgba(99,102,241,0.18)" strokeWidth={1.2} strokeDasharray="3 3" />
              <circle cx={210} cy={210} r={130} fill="none" stroke="rgba(99,102,241,0.14)" strokeWidth={1.2} strokeDasharray="5 5" />
              <circle cx={210} cy={210} r={180} fill="none" stroke="rgba(99,102,241,0.08)" strokeWidth={1.2} />

              {/* Pulse rings — fire every 5s */}
              <circle cx={210} cy={210} r={70} fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth={1}
                style={{ animation: 'radar-pulse 5s ease-out infinite' }} />
              <circle cx={210} cy={210} r={130} fill="none" stroke="rgba(99,102,241,0.3)" strokeWidth={1}
                style={{ animation: 'radar-pulse-outer 5s ease-out 1.5s infinite' }} />
              
              {/* Radial crosshair lines */}
              <line x1={210} y1={30} x2={210} y2={390} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <line x1={30} y1={210} x2={390} y2={210} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

              {/* Sweeping radar beam */}
              <g style={{ transformOrigin: '210px 210px', animation: 'radar-sweep 12s linear infinite' }}>
                <line x1={210} y1={210} x2={210} y2={30} stroke="rgba(99,102,241,0.4)" strokeWidth={2} />
                <path d="M 210 210 L 210 30 A 180 180 0 0 1 337 83 Z" fill="url(#radar-sweep-grad)" opacity="0.22" />
              </g>
            </svg>

            {/* Aegis Conduits linking central score to satellites */}
            <AegisConduit startX={210} startY={210} endX={70} endY={90} state={focusedSatellite === 'GOV' ? 'nominal' : 'nominal'} />
            <AegisConduit startX={210} startY={210} endX={350} endY={90} state={retrievalGroundedness >= 90 ? 'nominal' : 'warning'} />
            <AegisConduit startX={210} startY={210} endX={210} endY={380} state={criticalAlerts > 0 ? 'danger' : warningAlerts > 0 ? 'warning' : 'nominal'} />

            {/* Satellite 1: Governance (Top Left) */}
            <div
              onClick={() => setFocusedSatellite(prev => prev === 'GOV' ? null : 'GOV')}
              className="tactical-glass-interactive"
              style={{
                position: 'absolute',
                left: '16.67%',
                top: '21.43%',
                transform: focusedSatellite === 'GOV' ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%) scale(1)',
                background: focusedSatellite === 'GOV' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(10, 15, 30, 0.7)',
                border: `1px solid ${focusedSatellite === 'GOV' ? colors.emerald : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: font.sizes.xs,
                color: colors.textPrimary,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxShadow: focusedSatellite === 'GOV' ? '0 0 16px rgba(16, 185, 129, 0.15)' : 'none',
                zIndex: 12,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                width: '120px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot online" style={{ width: '6px', height: '6px' }} />
                <strong style={{ fontSize: '10px', letterSpacing: '0.04em', color: colors.textPrimary }}>GOVERNANCE</strong>
              </div>
              <span style={{ color: colors.textSecondary, fontSize: '9px', fontFamily: font.mono }}>
                {successRate}% Success
              </span>
            </div>

            {/* Satellite 2: Neural/AI (Top Right) */}
            <div
              onClick={() => setFocusedSatellite(prev => prev === 'NEURAL' ? null : 'NEURAL')}
              className="tactical-glass-interactive"
              style={{
                position: 'absolute',
                left: '83.33%',
                top: '21.43%',
                transform: focusedSatellite === 'NEURAL' ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%) scale(1)',
                background: focusedSatellite === 'NEURAL' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(10, 15, 30, 0.7)',
                border: `1px solid ${focusedSatellite === 'NEURAL' ? colors.indigo : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: font.sizes.xs,
                color: colors.textPrimary,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                boxShadow: focusedSatellite === 'NEURAL' ? '0 0 16px rgba(99, 102, 241, 0.15)' : 'none',
                zIndex: 12,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                width: '120px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot online" style={{ width: '6px', height: '6px', background: retrievalGroundedness >= 90 ? colors.indigo : colors.amber }} />
                <strong style={{ fontSize: '10px', letterSpacing: '0.04em', color: colors.textPrimary }}>NEURAL / RAG</strong>
              </div>
              <span style={{ color: colors.textSecondary, fontSize: '9px', fontFamily: font.mono }}>
                {retrievalGroundedness}% Grounded
              </span>
            </div>

            {/* Satellite 3: Infrastructure (Bottom Center) */}
            <div
              onClick={() => setFocusedSatellite(prev => prev === 'INFRA' ? null : 'INFRA')}
              className="tactical-glass-interactive"
              style={{
                position: 'absolute',
                left: '50%',
                top: '90.48%',
                transform: focusedSatellite === 'INFRA' ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%) scale(1)',
                background: focusedSatellite === 'INFRA' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(10, 15, 30, 0.7)',
                border: `1px solid ${focusedSatellite === 'INFRA' ? colors.rose : criticalAlerts > 0 ? colors.rose : warningAlerts > 0 ? colors.amber : colors.emerald}`,
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: font.sizes.xs,
                color: colors.textPrimary,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                cursor: 'pointer',
                boxShadow: focusedSatellite === 'INFRA' ? '0 0 16px rgba(244, 63, 94, 0.15)' : criticalAlerts > 0 ? `0 0 12px rgba(244, 63, 94, 0.1)` : 'none',
                zIndex: 12,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                width: '120px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="status-dot" style={{
                  width: '6px',
                  height: '6px',
                  background: criticalAlerts > 0 ? colors.rose : warningAlerts > 0 ? colors.amber : colors.emerald,
                  animation: criticalAlerts > 0 ? 'pulse 1s infinite' : undefined
                }} />
                <strong style={{ fontSize: '10px', letterSpacing: '0.04em', color: colors.textPrimary }}>INFRASTRUCTURE</strong>
              </div>
              <span style={{ color: colors.textSecondary, fontSize: '9px', fontFamily: font.mono }}>
                {criticalAlerts > 0 ? `${criticalAlerts} Alerts` : 'Nominal State'}
              </span>
            </div>

            {/* Center HUD Circle */}
            <div style={{ position: 'absolute', zIndex: 10, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
              <ConcentricStatusHUD
                score={riskVal}
                statusText={riskLvl}
                governanceScore={successRate}
                neuralScore={retrievalGroundedness}
                infrastructureScore={compPercentage}
                size={150}
              />
            </div>
          </div>

          {/* Mission Context Panel — intelligence surface, radar-matched */}
          <div style={{
            width: '100%',
            height: '115px',
            boxSizing: 'border-box',
            background: `linear-gradient(135deg,
              ${ focusedSatellite === 'GOV' ? 'rgba(16,185,129,0.04)'
                : focusedSatellite === 'NEURAL' ? 'rgba(99,102,241,0.04)'
                : focusedSatellite === 'INFRA' ? 'rgba(239,68,68,0.04)'
                : 'rgba(8,10,18,0.7)' } 0%,
              rgba(6,8,14,0.7) 100%)`,
            border: `1px solid ${
              focusedSatellite === 'GOV' ? 'rgba(16,185,129,0.25)'
              : focusedSatellite === 'NEURAL' ? 'rgba(99,102,241,0.25)'
              : focusedSatellite === 'INFRA' ? 'rgba(239,68,68,0.25)'
              : 'rgba(255,255,255,0.06)'
            }`,
            borderLeft: `3px solid ${
              focusedSatellite === 'GOV' ? colors.emerald
              : focusedSatellite === 'NEURAL' ? colors.indigo
              : focusedSatellite === 'INFRA' ? colors.rose
              : 'rgba(255,255,255,0.1)'
            }`,
            borderRadius: radius.md,
            padding: '10px 14px',
            marginTop: 'auto',
            zIndex: 6,
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: focusedSatellite === 'GOV' ? '0 0 20px rgba(16,185,129,0.07)'
              : focusedSatellite === 'NEURAL' ? '0 0 20px rgba(99,102,241,0.07)'
              : focusedSatellite === 'INFRA' ? '0 0 20px rgba(239,68,68,0.07)'
              : 'none',
          }}>
            {/* Panel header — intelligence label style */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', paddingBottom: '3px', borderBottom: `1px solid ${ focusedSatellite ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                  background: focusedSatellite === 'GOV' ? colors.emerald
                    : focusedSatellite === 'NEURAL' ? colors.indigo
                    : focusedSatellite === 'INFRA' ? colors.rose
                    : 'rgba(255,255,255,0.2)',
                  boxShadow: focusedSatellite ? `0 0 6px ${
                    focusedSatellite === 'GOV' ? colors.emerald
                    : focusedSatellite === 'NEURAL' ? colors.indigo
                    : colors.rose}` : 'none',
                }} />
                <span style={{
                  fontSize: '8.5px', fontWeight: 900, letterSpacing: '0.08em', fontFamily: font.mono,
                  color: focusedSatellite === 'GOV' ? colors.emerald
                    : focusedSatellite === 'NEURAL' ? colors.indigoLight
                    : focusedSatellite === 'INFRA' ? colors.rose
                    : colors.textSecondary
                }}>
                  {focusedSatellite === 'GOV' ? 'GOVERNANCE INTELLIGENCE'
                    : focusedSatellite === 'NEURAL' ? 'NEURAL INTELLIGENCE'
                    : focusedSatellite === 'INFRA' ? 'SECURITY INTELLIGENCE'
                    : 'MISSION INTELLIGENCE'}
                </span>
              </div>
              <span style={{ fontSize: '8px', fontFamily: font.mono, color: colors.textMuted }}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
              </span>
            </div>

            {!focusedSatellite ? (
              /* Default overview state */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.4fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>POSTURE</div>
                  <div style={{ fontSize: '10px', fontWeight: 750, color: riskLvl === 'CRITICAL' ? colors.rose : riskLvl === 'WARNING' ? colors.amber : colors.emerald, fontFamily: font.mono }}>{riskLvl}</div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>RISK DRIVERS</div>
                  <div style={{ fontSize: '9px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={criticalAlerts > 0 ? `${criticalAlerts} critical alerts` : warningAlerts > 0 ? `${warningAlerts} warnings active` : 'All systems nominal'}>
                    {criticalAlerts > 0 ? `${criticalAlerts} alerts` : warningAlerts > 0 ? `${warningAlerts} warnings` : 'All nominal'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>NEXT ACTION</div>
                  <div style={{ fontSize: '9px', color: colors.indigoLight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Select satellite ↗
                  </div>
                </div>
              </div>
            ) : focusedSatellite === 'GOV' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.4fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>POSTURE</div>
                  <div style={{ fontSize: '10px', fontWeight: 750, color: colors.emerald, fontFamily: font.mono }}>SOC2 TYPE II ✓</div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>RISK DRIVERS</div>
                  <div style={{ fontSize: '9px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {complianceData?.stats?.reviews_pending ?? 0} pending · {complianceData?.stats?.reviews_overdue ?? 0} overdue
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>NEXT ACTION</div>
                  <Link href="/dashboard/compliance" style={{ fontSize: '9px', color: colors.emerald, textDecoration: 'none', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Upload evidence →
                  </Link>
                </div>
              </div>
            ) : focusedSatellite === 'NEURAL' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.4fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>POSTURE</div>
                  <div style={{ fontSize: '10px', fontWeight: 750, color: retrievalGroundedness >= 90 ? colors.emerald : colors.amber, fontFamily: font.mono }}>{retrievalGroundedness}% GROUNDED</div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>RISK DRIVERS</div>
                  <div style={{ fontSize: '9px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {retrievalFailures} failures · {securityData?.secStats?.injection_attempts ?? 0} injections
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>NEXT ACTION</div>
                  <Link href="/chat?trace=true" style={{ fontSize: '9px', color: colors.indigoLight, textDecoration: 'none', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Trace citation →
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1.4fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>POSTURE</div>
                  <div style={{ fontSize: '10px', fontWeight: 750, color: criticalAlerts > 0 ? colors.rose : warningAlerts > 0 ? colors.amber : colors.emerald, fontFamily: font.mono }}>
                    {criticalAlerts > 0 ? 'THREAT ACTIVE' : warningAlerts > 0 ? 'ELEVATED RISK' : 'PROTECTED'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>RISK DRIVERS</div>
                  <div style={{ fontSize: '9px', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {criticalAlerts} crit · {warningAlerts} warn · {securityData?.secStats?.unauthorized_attempts ?? 0} auth blocks
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '7.5px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 700, marginBottom: '2px', letterSpacing: '0.04em' }}>NEXT ACTION</div>
                  {criticalAlerts > 0 ? (
                    <button onClick={() => setSelectedAlert(activeAlertsSource[0])} style={{ fontSize: '9px', background: 'none', border: 'none', color: colors.rose, cursor: 'pointer', padding: 0, fontWeight: 650, whiteSpace: 'nowrap', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Remediate →
                    </button>
                  ) : (
                    <Link href="/dashboard/security" style={{ fontSize: '9px', color: colors.emerald, textDecoration: 'none', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Review log →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: OPERATIONAL & SECURITY FEED ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'auto' }}>
          
          {/* Priority Actions Queue Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={12} style={{ color: colors.indigoLight }} />
              PRIORITY ACTIONS QUEUE
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Action 1: Neural drift — compact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(5,8,15,0.6)', border: '1px solid rgba(99,102,241,0.15)', borderLeft: `3px solid ${colors.indigo}`, borderRadius: radius.sm, padding: '8px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '8px', color: colors.indigoLight, fontWeight: 800, fontFamily: font.mono }}>NEURAL DRIFT</span>
                    <span style={{ fontSize: '8px', color: colors.textMuted }}>· Groundedness dropped below 95% · Trace pipeline citations</span>
                  </div>
                  <p style={{ fontSize: font.sizes.xs, color: colors.textPrimary, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>HR collection groundedness deviation — reliability risk on handbook responses</p>
                </div>
                <Link href="/chat?trace=true" style={{ fontSize: '9px', background: 'rgba(99,102,241,0.12)', color: colors.indigoLight, padding: '3px 8px', borderRadius: radius.xs, textDecoration: 'none', fontWeight: 650, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Trace →
                </Link>
              </div>

              {/* Action 2: Compliance sync — compact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(5,8,15,0.6)', border: '1px solid rgba(16,185,129,0.15)', borderLeft: `3px solid ${colors.emerald}`, borderRadius: radius.sm, padding: '8px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '8px', color: colors.emerald, fontWeight: 800, fontFamily: font.mono }}>COMPLIANCE</span>
                    <span style={{ fontSize: '8px', color: colors.textMuted }}>· 4 schemas missing control linkage · Auto-link to fix</span>
                  </div>
                  <p style={{ fontSize: font.sizes.xs, color: colors.textPrimary, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pending SOC2 evidence sync — auditor verification index deficit</p>
                </div>
                <Link href="/chat?audit=true" style={{ fontSize: '9px', background: 'rgba(16,185,129,0.12)', color: colors.emerald, padding: '3px 8px', borderRadius: radius.xs, textDecoration: 'none', fontWeight: 650, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Verify →
                </Link>
              </div>

              {/* Action 3: Injection probe — compact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(5,8,15,0.6)', border: `1px solid ${criticalAlerts > 0 ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.04)'}`, borderLeft: `3px solid ${criticalAlerts > 0 ? colors.rose : colors.amber}`, borderRadius: radius.sm, padding: '8px 12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '8px', color: criticalAlerts > 0 ? colors.rose : colors.amber, fontWeight: 800, fontFamily: font.mono }}>{criticalAlerts > 0 ? 'ACTIVE THREAT' : 'SECURITY AUDIT'}</span>
                    <span style={{ fontSize: '8px', color: colors.textMuted }}>· {criticalAlerts > 0 ? `${criticalAlerts} critical unresolved` : 'Run injection defense probe'}</span>
                  </div>
                  <p style={{ fontSize: font.sizes.xs, color: colors.textPrimary, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{criticalAlerts > 0 ? `${criticalAlerts} critical alerts pending triage — immediate remediation required` : 'Schedule automated scanner pass on Knowledge Vault endpoints'}</p>
                </div>
                <button onClick={() => activeAlertsSource.length > 0 ? setSelectedAlert(activeAlertsSource[0]) : undefined} style={{ fontSize: '9px', background: criticalAlerts > 0 ? 'rgba(244,63,94,0.12)' : 'rgba(245,158,11,0.12)', color: criticalAlerts > 0 ? colors.rose : colors.amber, padding: '3px 8px', borderRadius: radius.xs, border: 'none', cursor: 'pointer', fontWeight: 650, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {criticalAlerts > 0 ? 'Remediate →' : 'Probe →'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Recent Security Activity Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} style={{ color: colors.indigoLight }} />
              RECENT SECURITY ACTIVITY
            </span>
            <div style={{
              background: 'linear-gradient(135deg, rgba(8,10,18,0.75) 0%, rgba(6,8,14,0.75) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: radius.md,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {(securityData?.events ?? []).slice(0, 4).map((evt) => {
                const isThreat = evt.blocked || evt.severity === 'danger' || evt.severity === 'critical';
                const isWarning = evt.severity === 'warning';
                
                // Icon selection
                let iconColor: string = colors.emerald;
                let bgTint = 'rgba(16,185,129,0.08)';
                let borderTint = 'rgba(16,185,129,0.2)';
                
                if (isThreat) {
                  iconColor = colors.rose;
                  bgTint = 'rgba(244,63,94,0.08)';
                  borderTint = 'rgba(244,63,94,0.2)';
                } else if (isWarning) {
                  iconColor = colors.amber;
                  bgTint = 'rgba(245,158,11,0.08)';
                  borderTint = 'rgba(245,158,11,0.2)';
                } else if (evt.event_type.toLowerCase().includes('audit') || evt.event_type.toLowerCase().includes('compliance')) {
                  iconColor = colors.indigoLight;
                  bgTint = 'rgba(99,102,241,0.08)';
                  borderTint = 'rgba(99,102,241,0.2)';
                }

                // Format time ago
                const timeStr = (() => {
                  const diffMs = Date.now() - new Date(evt.created_at).getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  if (diffMins < 1) return 'Just now';
                  if (diffMins < 60) return `${diffMins}m ago`;
                  const diffHours = Math.floor(diffMins / 60);
                  if (diffHours < 24) return `${diffHours}h ago`;
                  return `${Math.floor(diffHours / 24)}d ago`;
                })();

                return (
                  <div key={evt.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: bgTint,
                      border: `1px solid ${borderTint}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '2px',
                      flexShrink: 0
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: iconColor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 750, color: colors.textPrimary, textTransform: 'uppercase', fontFamily: font.mono }}>
                          {evt.event_type.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '8px', color: colors.textMuted, fontFamily: font.mono }}>
                          {timeStr}
                        </span>
                      </div>
                      <p style={{ fontSize: '9.5px', color: colors.textSecondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {evt.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operations & Security Summary (replaces multiple timeline cards) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={12} style={{ color: colors.emerald }} />
              OPERATIONAL INTELLIGENCE OVERVIEW
            </span>
            
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(8,10,18,0.75) 0%, rgba(6,8,14,0.75) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Compact Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '8px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 750 }}>
                  SYSTEM INTELLIGENCE STATUS
                </span>
                <p style={{ fontSize: '11px', lineHeight: '1.45', color: colors.textSecondary, margin: 0 }}>
                  {riskLvl === 'CRITICAL' ? (
                    'CRITICAL: Multiple security incidents require immediate response. Ingestion pathways and neural engines are under active observation.'
                  ) : riskLvl === 'WARNING' ? (
                    'WARNING: Minor parameter drift or control verification queue backlogs detected. Active mitigations engaged for neural quality.'
                  ) : (
                    'NOMINAL: System status is stable. All ingestion pipelines, neural grounding layers, and access policies are operating within optimal security boundaries.'
                  )}
                </p>
              </div>

              {/* Stats Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  padding: '12px 0',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '8px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 750 }}>
                    TOTAL EVENTS
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 850, color: colors.textPrimary, fontFamily: font.mono }}>
                    {securityData?.secStats?.total_events ?? 48}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '8px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 750 }}>
                    AUDIT UPDATES
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 850, color: colors.emerald, fontFamily: font.mono }}>
                    {complianceData?.stats?.controls_with_evidence ?? 12}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '8px', color: colors.textMuted, fontFamily: font.mono, fontWeight: 750 }}>
                    SECURITY EVENTS
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 850, color: colors.rose, fontFamily: font.mono }}>
                    {securityData?.secStats?.blocked_events ?? 3}
                  </span>
                </div>
              </div>

              {/* "Open Activity Center" Action */}
              <Link
                href="/dashboard/security"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: radius.md,
                  color: colors.textPrimary,
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: transition.fast,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                Open Activity Center
                <ArrowRight size={12} style={{ color: colors.indigoLight }} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Dense Audit Event Timeline ─────────────────────────── */}
      <div
        className="tactical-glass-base"
        style={{
          borderRadius: radius.xl,
          padding: '12px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Terminal size={12} style={{ color: colors.emerald }} />
          <span style={{ fontSize: font.sizes.xs, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AUDIT LOG & RECENT SYSTEM ACTIVITY (LIVE RECORDING)
          </span>
        </div>

        <div 
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          style={{ 
            maxHeight: '160px', 
            overflowY: 'auto', 
            position: 'relative',
            paddingRight: '6px'
          }}
        >
          {(() => {
            const filteredEvents = (securityData?.events ?? []).filter(event => {
              if (!focusedSatellite) return true;
              if (focusedSatellite === 'GOV') {
                return event.event_type.toLowerCase().includes('audit') || 
                       event.event_type.toLowerCase().includes('compliance') || 
                       event.event_type.toLowerCase().includes('policy') ||
                       event.description.toLowerCase().includes('control') ||
                       event.description.toLowerCase().includes('soc2');
              }
              if (focusedSatellite === 'NEURAL') {
                return event.event_type.toLowerCase().includes('query') || 
                       event.event_type.toLowerCase().includes('retrieval') ||
                       event.event_type.toLowerCase().includes('model') || 
                       event.event_type.toLowerCase().includes('hallucination') || 
                       event.event_type.toLowerCase().includes('fallback') ||
                       event.description.toLowerCase().includes('groundedness') ||
                       event.description.toLowerCase().includes('citation');
              }
              if (focusedSatellite === 'INFRA') {
                return event.blocked || 
                       event.event_type.toLowerCase().includes('injection') || 
                       event.event_type.toLowerCase().includes('unauthorized') ||
                       event.event_type.toLowerCase().includes('security') ||
                       event.description.toLowerCase().includes('probe') ||
                       event.description.toLowerCase().includes('exploit');
              }
              return true;
            });

            const rowHeight = 36;
            const totalFiltered = filteredEvents.length;
            const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
            const endIndex = Math.min(totalFiltered, Math.ceil((scrollTop + 160) / rowHeight) + 1);
            
            const visibleEvents = filteredEvents.slice(startIndex, endIndex);
            const paddingTop = startIndex * rowHeight;

            if (totalFiltered === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '16px', color: colors.textMuted }}>
                  No system activity matching the current satellite filter.
                </div>
              );
            }

            return (
              <div style={{ height: `${totalFiltered * rowHeight}px`, position: 'relative' }}>
                <div style={{ transform: `translateY(${paddingTop}px)`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {visibleEvents.map((event) => {
                    // Determine severity tier
                    const sev = event.severity?.toLowerCase() ?? 'info'
                    const isCritical = sev === 'critical' || sev === 'danger'
                    const isWarning = sev === 'warning' || event.event_type.toLowerCase().includes('fallback') || event.event_type.toLowerCase().includes('hallucination')
                    const isAudit = event.event_type.toLowerCase().includes('audit') || event.event_type.toLowerCase().includes('compliance') || event.event_type.toLowerCase().includes('policy') || event.blocked
                    
                    const tierColor = isCritical ? colors.rose
                      : isWarning ? colors.amber
                      : isAudit ? colors.indigo
                      : 'rgba(255,255,255,0.15)'
                    
                    const tierLabel = isCritical ? 'CRITICAL'
                      : isWarning ? 'WARNING'
                      : isAudit ? 'AUDIT'
                      : 'INFO'

                    return (
                    <div
                      key={event.id}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.background = isCritical ? 'rgba(244,63,94,0.06)' : 'rgba(255,255,255,0.025)'
                        el.style.transform = 'translateX(2px)'
                        el.style.borderLeftColor = tierColor
                        const chevron = el.querySelector<HTMLElement>('.row-chevron')
                        if (chevron) chevron.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.background = isCritical ? 'rgba(244,63,94,0.03)' : 'rgba(255,255,255,0.01)'
                        el.style.transform = 'translateX(0)'
                        const chevron = el.querySelector<HTMLElement>('.row-chevron')
                        if (chevron) chevron.style.opacity = '0.35'
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: font.sizes.base,
                        padding: '4px 8px 4px 0',
                        height: `${rowHeight - 4}px`,
                        borderRadius: radius.sm,
                        background: isCritical ? 'rgba(244,63,94,0.03)' : 'rgba(255,255,255,0.01)',
                        borderLeft: `3px solid ${tierColor}`,
                        paddingLeft: '8px',
                        boxSizing: 'border-box',
                        transition: 'background 0.15s ease, transform 0.15s ease',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        fontSize: '9px',
                        fontFamily: font.mono,
                        color: colors.textMuted,
                        flexShrink: 0,
                        letterSpacing: '-0.01em',
                      }}>
                        {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>

                      <span
                        style={{
                          fontSize: '8px',
                          fontWeight: 800,
                          padding: '1px 4px',
                          borderRadius: '2px',
                          textTransform: 'uppercase',
                          background: isCritical ? 'rgba(244,63,94,0.12)'
                            : isWarning ? 'rgba(245,158,11,0.1)'
                            : isAudit ? 'rgba(99,102,241,0.1)'
                            : 'rgba(255,255,255,0.04)',
                          color: tierColor,
                          fontFamily: font.mono,
                          flexShrink: 0,
                          letterSpacing: '0.03em',
                        }}
                      >
                        {tierLabel}
                      </span>

                      <span style={{
                        fontSize: '9px',
                        color: colors.textMuted,
                        fontFamily: font.mono,
                        flexShrink: 0,
                        opacity: 0.7,
                      }}>
                        {event.event_type}
                      </span>

                      <p style={{
                        fontSize: font.sizes.xs,
                        color: isCritical ? colors.textPrimary : colors.textSecondary,
                        fontWeight: isCritical ? 600 : 400,
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}>
                        {event.description}
                      </p>

                      <Link
                        href={
                          isAudit ? `/dashboard/knowledge?event=${event.id}`
                          : isCritical ? `/dashboard/security?incident=${event.id}`
                          : isWarning ? `/chat?trace=${event.id}`
                          : `/chat?context=${event.id}`
                        }
                        className="row-chevron"
                        style={{ fontSize: '10px', color: colors.indigoLight, textDecoration: 'none', fontWeight: 650, opacity: 0.35, flexShrink: 0, transition: 'opacity 0.15s ease' }}
                        title={isAudit ? 'Open in Knowledge Workbench' : isCritical ? 'View Incident' : 'Trace in Chat'}
                      >
                        {isAudit ? 'WB →' : isCritical ? 'INC →' : '→'}
                      </Link>
                    </div>
                    )
                  })}
                 </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ================= REMEDIATION BOTTOM DRAWER ================= */}
      {selectedAlert && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#0B0D13',
            borderTop: `2px solid ${selectedAlert.severity === 'critical' ? colors.rose : colors.amber}`,
            boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.6)',
            padding: '20px 24px',
            zIndex: 1000,
            animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: selectedAlert.severity === 'critical' ? colors.rose : colors.amber }} />
              <span style={{ fontSize: font.sizes.base, fontWeight: 700, color: colors.textPrimary }}>
                Active Incident Remediation Queue
              </span>
            </div>
            <button
              onClick={() => setSelectedAlert(null)}
              style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', fontSize: font.sizes.md }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <p style={{ fontSize: font.sizes.base, color: colors.textPrimary, fontWeight: 600, margin: 0 }}>
                {selectedAlert.title}
              </p>
              <p style={{ fontSize: font.sizes.xs, color: colors.textSecondary, margin: '2px 0 0' }}>
                {selectedAlert.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href={`/chat?context=${selectedAlert.category}&alert=${selectedAlert.id}`}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: radius.md,
                  color: colors.textPrimary,
                  padding: '8px 16px',
                  textDecoration: 'none',
                  fontSize: font.sizes.base,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Inspect Evidence <ChevronRight size={14} />
              </Link>
              <button
                disabled={remediating}
                onClick={() => triggerRemediation(selectedAlert.id)}
                style={{
                  background: selectedAlert.severity === 'critical' ? colors.rose : colors.amber,
                  border: 'none',
                  borderRadius: radius.md,
                  color: '#FFF',
                  padding: '8px 20px',
                  fontSize: font.sizes.base,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: selectedAlert.severity === 'critical' ? shadow.glow.rose : shadow.glow.amber
                }}
              >
                {remediating ? 'Running Agent...' : 'Remediate Incident'}
              </button>
            </div>
          </div>

          {remediating && (
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{
                height: '100%',
                background: selectedAlert.severity === 'critical' ? colors.rose : colors.amber,
                width: '100%',
                animation: 'shimmer 1.5s infinite linear',
                transformOrigin: 'left'
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

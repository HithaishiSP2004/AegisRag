'use client'
import { useState } from 'react'
import { Shield, ShieldAlert, Sparkles, Activity, AlertOctagon, Terminal } from 'lucide-react'
import { colors, radius, font } from '@/components/ui/tokens'
import type { SecurityReportData } from '../hooks/useReports'

interface Props {
  data: SecurityReportData | null
  loading: boolean
}

export function SecurityScorecard({ data, loading }: Props) {
  const [activeAdvisory, setActiveAdvisory] = useState<'drift' | 'access' | 'policy'>('drift')

  if (loading) {
    return (
      <div style={{
        background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
        padding: '24px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textSecondary, fontSize: '0.875rem'
      }}>
        Loading Security Intelligence Center…
      </div>
    )
  }

  if (!data) return null

  const eventsSummary = data.eventsSummary
  const mismatches = data.mismatches ?? []

  // H4 FIX: Use real event data with zero-based defaults — no fabricated fallback numbers
  const totalEvents = eventsSummary?.total ?? 0
  const blockedEvents = eventsSummary?.blocked ?? 0
  const severities = eventsSummary?.severities ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  const types = eventsSummary?.types ?? {}

  // Severity colors
  const sevColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical': return '#F43F5E'
      case 'high':     return '#FB923C'
      case 'medium':   return '#F59E0B'
      case 'low':      return '#22D3EE'
      default:         return '#64748B'
    }
  }

  // M7 FIX: Use real security events from the API instead of a hardcoded static timeline.
  // recentEvents comes from /api/reports/security → security_events table.
  const recentEvents = data.recentEvents ?? []

  const advisories = {
    drift: {
      title: 'Configuration & Sensitivity Drift Advisory',
      what: 'Telemetry detected a mismatch between declared and actual document sensitivity.',
      why: 'Content classification engines flagged confidential HIPAA markers in documents labeled as public.',
      impact: 'Increases structural risk score and violates NIST-CSF PR.IP guidelines.',
      next: 'Trigger automatic document quarantine and reclassification workflow.'
    },
    access: {
      title: 'MFA & Access Telemetry Advisory',
      what: 'Authentication audit trials reported outstanding MFA setup logs.',
      why: 'Integration latency between Azure AD and GRC verification daemon.',
      impact: 'Blocks SOC2 CC6.2 evidence verification pipeline.',
      next: 'Configure direct webhooks for real-time authentication logs collection.'
    },
    policy: {
      title: 'Model Governance Policy Advisory',
      what: 'RAG query groundedness dipped transiently below 80%.',
      why: 'Temporary database connection latency caused semantic chunking retrieval dropouts.',
      impact: 'Model output hallucination rate grows to 1.8%, triggering internal governance alerts.',
      next: 'Re-index chunk parameters and allocate secondary database replicas.'
    }
  }

  const advisory = advisories[activeAdvisory]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Security Intelligence Hero */}
      <div style={{
        background: '#0B0F19',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: radius.xl,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={18} style={{ color: '#F43F5E' }} />
            <div>
              <h3 style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Security Intelligence &amp; Event Center
              </h3>
              <p style={{ color: colors.textSecondary, fontSize: '11px', margin: '2px 0 0 0' }}>
                Event telemetry logs, attack vectors, attack timeline, and automated alerts queues.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '10px', background: 'rgba(244, 63, 94, 0.1)', color: '#F43F5E', padding: '3px 8px', borderRadius: radius.full, fontWeight: 700 }}>
            INTELLIGENCE SCANNING ACTIVE
          </span>
        </div>

        {/* Severity Heatmap & Event Types Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Severity Heatmap */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: radius.lg, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 600 }}>Severity Heatmap &amp; Threat Counts</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
              {['critical', 'high', 'medium', 'low', 'info'].map((sev) => {
                const count = severities[sev] ?? 0
                const color = sevColor(sev)
                return (
                  <div key={sev} style={{
                    background: `${color}06`,
                    border: `1px solid ${color}20`,
                    borderRadius: radius.md,
                    padding: '12px 6px'
                  }}>
                    <span style={{ color: color, fontSize: '16px', fontWeight: 800 }}>{count}</span>
                    <p style={{ color: colors.textMuted, fontSize: '8px', textTransform: 'uppercase', fontWeight: 700, margin: '4px 0 0' }}>{sev}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Event Categories */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: radius.lg, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 600 }}>Active Event Categories</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(types).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                  <span style={{ color: colors.textSecondary }}>{type}</span>
                  <span style={{ color: colors.textPrimary, fontWeight: 700 }}>{count} events</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Attack Timeline vs Advisory */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* Left: Timeline & Mismatches */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Attack Timeline */}
          <div style={{
            background: '#0B0F19', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: radius.xl,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '12px' }}>Real-time Policy Violation Timeline</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentEvents.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: colors.textMuted, fontSize: '11px' }}>
                  No security events recorded in the selected period.
                </div>
              ) : (
                recentEvents.map((item) => {
                  const ts = new Date(item.created_at)
                  const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  const label = item.description || item.event_type.replace(/_/g, ' ')
                  return (
                    <div key={item.id} style={{
                      display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.005)',
                      border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: radius.md
                    }}>
                      <span style={{ fontFamily: font.mono, fontSize: '10px', color: colors.textMuted }}>{timeStr}</span>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sevColor(item.severity) }} />
                      <span style={{ color: colors.textPrimary, fontSize: '11px', flex: 1 }}>{label}</span>
                      <span style={{ fontSize: '9px', fontWeight: 700, color: sevColor(item.severity) }}>{item.severity.toUpperCase()}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* File mismatches */}
          <div style={{
            background: '#0B0F19', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '12px' }}>Document Sensitivity Mismatches</span>
            {mismatches.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: colors.textMuted, fontSize: '11px' }}>
                No sensitivity mismatches detected!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {mismatches.map((m) => (
                  <div key={m.id} style={{
                    background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: radius.md, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 600 }}>{m.documents?.filename}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: colors.textMuted }}>
                        <span>Declared: <strong style={{ color: '#22D3EE' }}>{m.declared_sensitivity}</strong></span>
                        <span>detected: <strong style={{ color: '#F43F5E' }}>{m.detected_sensitivity}</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#FB923C' }}>{m.risk_score}</span>
                      <p style={{ color: colors.textMuted, fontSize: '8px', margin: 0 }}>Risk Score</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Security Advisory Narrative */}
        <div style={{
          background: '#0B0F19', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: radius.xl,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} style={{ color: '#F43F5E' }} />
              Cyber Security Advisory Narrative
            </h4>
          </div>

          {/* Tab selector */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: radius.md }}>
            {(['drift', 'access', 'policy'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setActiveAdvisory(opt)}
                style={{
                  flex: 1, padding: '4px 6px', fontSize: '10px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: radius.sm,
                  background: activeAdvisory === opt ? 'rgba(244,63,94,0.15)' : 'transparent',
                  color: activeAdvisory === opt ? '#F43F5E' : colors.textMuted, transition: 'all 0.2s'
                }}
              >
                {opt === 'drift' ? 'Drift' : opt === 'access' ? 'Access' : 'Policy'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase' }}>What Happened?</span>
              <p style={{ color: colors.textPrimary, fontSize: '11px', margin: '2px 0 0 0', lineHeight: 1.4 }}>{advisory.what}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase' }}>Why Did It Happen?</span>
              <p style={{ color: colors.textPrimary, fontSize: '11px', margin: '2px 0 0 0', lineHeight: 1.4 }}>{advisory.why}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase' }}>What is the Impact?</span>
              <p style={{ color: colors.textPrimary, fontSize: '11px', margin: '2px 0 0 0', lineHeight: 1.4 }}>{advisory.impact}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: '#F43F5E', fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>What Should Be Done Next?</span>
              <p style={{ color: '#F43F5E', fontSize: '11px', fontWeight: 600, margin: '2px 0 0 0', lineHeight: 1.4 }}>{advisory.next}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

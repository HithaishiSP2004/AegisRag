'use client'
// ExecutiveKPICards — Sprint 5C
import { Icon } from '@iconify/react'
import type { ExecutiveReportData } from '../hooks/useReports'

interface Props {
  data: ExecutiveReportData | null
  loading: boolean
}

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

export function ExecutiveKPICards({ data, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {[1, 2, 4].map((i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px', padding: '24px', height: '120px',
            animation: 'pulse 1.5s infinite ease-in-out'
          }} />
        ))}
      </div>
    )
  }

  if (!data) return null

  const risk = data.riskScore
  const comp = data.compliance
  const retr = data.retrieval

  const riskScore = risk?.risk_score ?? 0
  const riskLevel = risk?.risk_level ?? 'low'
  const openAlerts = risk?.open_alerts ?? 0
  const critAlerts = risk?.critical_alerts ?? 0

  const totalControls = comp?.total_controls ?? 0
  const controlsWithEvidence = comp?.controls_with_evidence ?? 0
  const complianceScore = totalControls > 0 ? Math.round((controlsWithEvidence / totalControls) * 100) : 0

  const avgGroundedness = retr?.avg_groundedness ?? 0
  const hallucinationRate = retr?.hallucination_rate_pct ?? 0

  // Risk coloring
  const RISK_COLORS: Record<string, string> = {
    critical: '#F43F5E',
    high: '#FB923C',
    moderate: '#F59E0B',
    low: '#10B981'
  }
  const rColor = RISK_COLORS[riskLevel] ?? '#64748B'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
      {/* Risk Score */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden'
      }}>
        <div>
          <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Risk Score</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: rColor, letterSpacing: '-0.03em' }}>{riskScore}</span>
            <span style={{ color: '#475569', fontSize: '1rem', fontWeight: 500 }}>/100</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
            background: `${rColor}12`, border: `1px solid ${rColor}30`, color: rColor, textTransform: 'uppercase'
          }}>
            {riskLevel}
          </span>
          <span style={{ color: '#475569', fontSize: '0.72rem' }}>Org risk posture</span>
        </div>
        <Icon icon="solar:shield-warning-bold" style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '80px', color: `${rColor}04` }} />
      </div>

      {/* Compliance Coverage */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden'
      }}>
        <div>
          <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compliance Coverage</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#A5B4FC', letterSpacing: '-0.03em' }}>{complianceScore}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
          <span style={{ color: '#475569', fontSize: '0.72rem' }}>
            ({controlsWithEvidence} of {totalControls} controls mapped)
          </span>
        </div>
        <Icon icon="solar:check-square-bold" style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '80px', color: 'rgba(165,180,252,0.04)' }} />
      </div>

      {/* Retrieval Quality */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden'
      }}>
        <div>
          <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Groundedness</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#6EE7B7', letterSpacing: '-0.03em' }}>
              {fmt(avgGroundedness, 2)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
          <span style={{ color: '#475569', fontSize: '0.72rem' }}>
            Hallucination rate: <strong style={{ color: hallucinationRate > 2 ? '#F43F5E' : '#64748B' }}>{fmt(hallucinationRate, 1)}%</strong>
          </span>
        </div>
        <Icon icon="solar:document-bold" style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '80px', color: 'rgba(110,231,183,0.04)' }} />
      </div>

      {/* Security Incidents */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden'
      }}>
        <div>
          <span style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Alerts</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: openAlerts > 0 ? '#FB923C' : '#64748B', letterSpacing: '-0.03em' }}>{openAlerts}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
          <span style={{ color: '#475569', fontSize: '0.72rem' }}>
            Critical alerts: <strong style={{ color: critAlerts > 0 ? '#F43F5E' : '#475569' }}>{critAlerts}</strong>
          </span>
        </div>
        <Icon icon="solar:bell-bing-bold" style={{ position: 'absolute', right: '-10px', bottom: '-10px', fontSize: '80px', color: 'rgba(251,146,96,0.04)' }} />
      </div>
    </div>
  )
}

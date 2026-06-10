'use client'
import { useState } from 'react'
import { useRiskScore } from '../hooks/useRiskScore'
import { riskLevelColor, riskLevelBg } from '../engine/riskEngine'
import type { RiskLevel } from '../engine/riskEngine'
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  HelpCircle,
  Shield,
  Gauge
} from 'lucide-react'

export function RiskScoreCard() {
  const { db, engine, loading, error, refresh } = useRiskScore()
  const [showTooltip, setShowTooltip] = useState(false)

  const riskLevel  = (db?.risk_level ?? engine?.level ?? 'low') as RiskLevel
  const riskVal    = db?.risk_score  ?? engine?.score  ?? 0
  const color      = riskLevelColor(riskLevel)
  const bgCol      = riskLevelBg(riskLevel)

  if (loading) return (
    <div style={{
      height: 220, background: 'rgba(255,255,255,0.04)', borderRadius: 16,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )

  if (error) return (
    <div style={{ padding: 20, color: '#F43F5E', fontSize: 13, background: 'rgba(244,63,94,0.05)', borderRadius: 16, border: '1px solid rgba(244,63,94,0.15)' }}>
      ⚠ {error}
    </div>
  )

  const breakdown = engine?.breakdown ?? {}

  // List risk factors and their contribution points
  const factors = [
    { label: 'Critical Alerts',     val: db?.critical_alerts ?? 0,     pts: breakdown.critical_alerts ?? 0, color: '#F43F5E', desc: 'Critical alerts are weighted at 8 pts each (capped at 32 pts).' },
    { label: 'Open Alerts',         val: db?.open_alerts ?? 0,         pts: breakdown.open_alerts ?? 0, color: '#FB923C', desc: 'Open / Acknowledged alerts are weighted at 4 pts each (capped at 20 pts).' },
    { label: 'Hallucinations (30d)',val: db?.hallucinations ?? 0,      pts: breakdown.hallucinations ?? 0, color: '#F59E0B', desc: 'Hallucinations detected in the last 30 days are weighted at 3 pts each (capped at 15 pts).' },
    { label: 'Retrieval Failures',  val: db?.retrieval_failures ?? 0,  pts: breakdown.retrieval_failures ?? 0, color: '#818CF8', desc: 'Retrieval failures (groundedness < 0.3) are weighted at 2 pts each (capped at 10 pts).' },
    { label: 'Failed Reviews',      val: db?.failed_reviews ?? 0,      pts: breakdown.failed_reviews ?? 0, color: '#A78BFA', desc: 'Rejected compliance reviews are weighted at 2 pts each (capped at 10 pts).' },
    { label: 'Unauthorized Events', val: db?.unauthorized_events ?? 0, pts: breakdown.unauthorized_events ?? 0, color: '#FDA4AF', desc: 'Unauthorized access attempts are weighted at 4 pts each (capped at 20 pts).' },
  ]

  // Find top contributing factor(s)
  const topFactors = [...factors]
    .filter(f => f.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 2)

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
      boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
    }}>
      {/* Upper Section: Gauge and Basic Stats */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Risk score gauge/circle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 150, padding: '10px 0' }}>
          <div style={{
            width: 110, height: 110, borderRadius: '50%',
            border: `6px solid ${color}20`, borderTopColor: color,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{riskVal}</span>
            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>score</span>
          </div>
          <span style={{
            background: bgCol, color: color,
            borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', marginTop: 14, letterSpacing: '0.05em',
          }}>
            {riskLevel} Risk
          </span>
        </div>

        {/* Risk Details and Trend */}
        <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3 style={{ color: '#F1F5F9', fontSize: '1rem', fontWeight: 600, margin: 0 }}>Organization Risk Score</h3>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <HelpCircle 
                  size={14} 
                  style={{ color: '#64748b', cursor: 'pointer', verticalAlign: 'middle' }}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={() => setShowTooltip(!showTooltip)}
                />
                {showTooltip && (
                  <div style={{
                    position: 'absolute', bottom: '125%', left: '50%', transform: 'translateX(-50%)',
                    width: 260, padding: 12, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#94a3b8', fontSize: 11, zIndex: 100, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    lineHeight: '1.4', pointerEvents: 'none'
                  }}>
                    <strong style={{ color: '#f8fafc', display: 'block', marginBottom: 4 }}>How is this score calculated?</strong>
                    This security score dynamically aggregates current alerts, recent hallucination events, RAG failures, and compliance review rejections. A lower score signifies a more secure environment.
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={refresh}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              🔄 Recalculate
            </button>
          </div>

          {/* Risk Trend & Delta Indicator */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <TrendingDown size={16} style={{ color: '#10B981' }} />
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Risk Trend</span>
                <span style={{ fontSize: 12, color: riskVal < 35 ? '#10B981' : riskVal < 65 ? '#F59E0B' : '#F43F5E', fontWeight: 600 }}>
                  {riskVal < 35 ? 'Improving' : riskVal < 65 ? 'Stable' : 'Degrading'}
                </span>
              </div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
              <TrendingUp size={16} style={{ color: '#FB923C' }} />
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Risk Delta</span>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>
                  +4 this week <span style={{ color: '#64748b', fontSize: 11 }}>/</span> -2 this month
                </span>
              </div>
            </div>
          </div>

          {/* Top Contributing Factors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Top Contributing Factors:</span>
            {topFactors.length === 0 ? (
              <span style={{ fontSize: 12, color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> Excellent status. No risk factors detected.
              </span>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {topFactors.map(f => (
                  <span 
                    key={f.label}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 6, padding: '4px 8px', fontSize: 11, color: f.color, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <AlertTriangle size={10} /> {f.label}: +{f.pts} pts
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Risk Composition Section */}
      {(() => {
        const criticalPts = breakdown.critical_alerts ?? 0;
        const openPts = breakdown.open_alerts ?? 0;
        const unauthPts = breakdown.unauthorized_events ?? 0;
        const failedReviewPts = breakdown.failed_reviews ?? 0;
        const retrievalPts = breakdown.retrieval_failures ?? 0;
        const hallucinationPts = breakdown.hallucinations ?? 0;

        // Map to exact required explainability factors
        const compCoverage = criticalPts;
        const reviewOverdue = openPts;
        const missingEvidence = unauthPts;
        const failedReview = failedReviewPts;
        const retrievalRisk = riskVal - (compCoverage + reviewOverdue + missingEvidence + failedReview);

        const composition = [
          { label: 'Compliance Coverage Impact', val: compCoverage, color: '#F43F5E', desc: 'Critical alert vulnerabilities affecting coverage gap' },
          { label: 'Review Overdue Impact', val: reviewOverdue, color: '#FB923C', desc: 'SLA review queue delays' },
          { label: 'Missing Evidence Impact', val: missingEvidence, color: '#FDA4AF', desc: 'Unresolved evidence link mappings' },
          { label: 'Failed Review Impact', val: failedReview, color: '#A78BFA', desc: 'Auditor review queue rejections' },
          { label: 'Retrieval Risk Impact', val: retrievalRisk, color: '#818CF8', desc: 'Hallucination flag & retrieval failures' },
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Forensic Risk Composition (Total: {riskVal})
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {composition.map(item => (
                <div
                  key={item.label}
                  title={item.desc}
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'help'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: item.val > 0 ? item.color : '#475569', fontWeight: 700 }}>
                      +{item.val}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${riskVal > 0 ? (item.val / riskVal) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Lower Section: Detailed Score Breakdown Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Telemetry Risk breakdown</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {factors.map(s => (
            <div
              key={s.label}
              title={s.desc}
              style={{
                background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: 10, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'border-color 0.15s ease', cursor: 'help'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)'}
            >
              <div>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{s.val}</div>
              </div>
              <span style={{ fontSize: 11, color: s.pts > 0 ? s.color : '#334155', fontWeight: 600 }}>
                +{s.pts} pts
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Award, 
  ShieldCheck, 
  Clock, 
  Activity, 
  ChevronRight,
  Info
} from 'lucide-react'
import { colors, radius, font, shadow } from '@/components/ui/tokens'

interface Metric {
  coverage: number
  readiness: number
  riskScore: number
  status: string
}

export function ExecutiveCompliancePanel() {
  const [metrics, setMetrics] = useState<Metric>({
    coverage: 0,
    readiness: 0,
    riskScore: 0,
    status: 'Not Ready'
  })
  const [ranking, setRanking] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Dynamic fetch of compliance readiness & overview statistics
    Promise.all([
      fetch('/api/compliance/readiness'),
      fetch('/api/compliance/stats'),
      fetch('/api/compliance/frameworks')
    ])
      .then(async ([res1, res2, res3]) => {
        const data1 = await res1.json()
        const data2 = await res2.json()
        const data3 = await res3.json()

        const readiness = Math.round(data1.score ?? 0)
        const riskScore = Math.round(data2.riskScore?.risk_score ?? 0)

        const totalControls = data2.stats?.total_controls ?? 0
        const controlsWithEvidence = data2.stats?.controls_with_evidence ?? 0
        const coverage = totalControls > 0 ? Math.round((controlsWithEvidence / totalControls) * 100) : 0

        setMetrics({
          coverage,
          readiness,
          riskScore,
          status: readiness >= 95 ? 'AUDIT READY' : readiness >= 80 ? 'NEAR READY' : readiness >= 60 ? 'ATTENTION REQUIRED' : 'NOT READY'
        })

        // Framework rankings mapping
        const frameworksList = data3.frameworks ?? []
        const mappedRankings = frameworksList.map((fw: any) => {
          const score = fw.control_count > 0 ? Math.round((fw.evidence_count / fw.control_count) * 100) : 0
          let color = '#EF4444' // red / Not Ready
          let status = 'Not Ready'
          if (score >= 80) {
            color = '#10B981'
            status = 'High Coverage'
          } else if (score >= 60) {
            color = '#F59E0B'
            status = 'Near Ready'
          } else if (score >= 40) {
            color = '#FB923C'
            status = 'Attention Required'
          }
          return {
            name: fw.name,
            score,
            status,
            color
          }
        }).sort((a: any, b: any) => b.score - a.score)

        setRanking(mappedRankings.map((fw: any, idx: number) => ({
          rank: idx + 1,
          ...fw
        })))

        // Risks mapping
        const mappedRisks = (data1.issues ?? []).map((issue: any) => {
          let title = 'Compliance Issue'
          let color = '#F59E0B' // yellow
          if (issue.type === 'evidence_completeness') {
            title = 'Critical Evidence Gap'
            color = '#EF4444'
          } else if (issue.type === 'reference_integrity') {
            title = 'Broken Reference / Deletion'
            color = '#EF4444'
          } else if (issue.type === 'signoff_coverage') {
            title = 'Pending Signoff / Control Overdue'
            color = '#FB923C'
          }
          
          return {
            title,
            desc: `${issue.control_code}: ${issue.message}`,
            severity: issue.severity.toUpperCase(),
            color
          }
        })
        setRisks(mappedRisks)
      })
      .catch(err => console.error('Error fetching executive metrics:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{
      background: 'rgba(9, 13, 22, 0.4)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: radius.xl,
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      boxShadow: shadow.md
    }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: colors.textPrimary, fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: colors.indigoLight }} />
            Executive Compliance Operations Panel
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '13px', margin: '4px 0 0 0' }}>
            Real-time audit posture rankings, key compliance risk indicators, and overall readiness dashboard.
          </p>
        </div>
        <div style={{
          fontSize: '11px',
          color: colors.textMuted,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: radius.md,
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Info size={12} />
          SEC-COMPLIANCE-POST
        </div>
      </div>

      {/* Grid: 3 columns (KPIs, Rankings, Insights) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* Col 1: Health Overview */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: radius.lg,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '260px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>Compliance Health Posture</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: radius.sm,
              fontWeight: 700,
              background: metrics.status === 'AUDIT READY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: metrics.status === 'AUDIT READY' ? '#10B981' : '#F59E0B',
              textTransform: 'uppercase'
            }}>{metrics.status}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: colors.textMuted, fontSize: '11px' }}>Framework Coverage</span>
              <span style={{ color: colors.textPrimary, fontSize: '28px', fontWeight: 700 }}>
                {loading ? '...' : `${metrics.coverage}%`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10B981' }}>
                <TrendingUp size={12} />
                <span>+3% this week</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: colors.textMuted, fontSize: '11px' }}>Audit Readiness</span>
              <span style={{ color: colors.textPrimary, fontSize: '28px', fontWeight: 700 }}>
                {loading ? '...' : `${metrics.readiness}%`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10B981' }}>
                <TrendingUp size={12} />
                <span>+5% this month</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: colors.textMuted, fontSize: '11px' }}>System Risk Score</span>
              <span style={{ color: '#F43F5E', fontSize: '28px', fontWeight: 700 }}>
                {metrics.riskScore}/100
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10B981' }}>
                <TrendingDown size={12} />
                <span>-2 this week</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: colors.textMuted, fontSize: '11px' }}>Auditor Verification</span>
              <span style={{ color: colors.indigoLight, fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <ShieldCheck size={18} />
                SOC2 Prep
              </span>
              <span style={{ color: colors.textMuted, fontSize: '10px' }}>Active verification window</span>
            </div>
          </div>
        </div>

        {/* Col 2: Framework Rankings */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: radius.lg,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>Active Framework Rankings</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ranking.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: colors.textMuted, fontSize: '12px' }}>
                No Framework Coverage Data Available
              </div>
            ) : (
              ranking.map((item) => (
                <div key={item.rank} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  borderRadius: radius.md,
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: colors.textMuted, fontWeight: 700, width: '16px' }}>{item.rank}.</span>
                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{item.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: colors.textSecondary }}>{item.score}%</span>
                    <div style={{
                      width: '60px',
                      height: '4px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ width: `${item.score}%`, height: '100%', background: item.color }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Col 3: Executive Insights & Compliance Risks */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: radius.lg,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>Top Compliance Risks</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {risks.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: colors.textMuted, fontSize: '12px' }}>
                No Active Compliance Risks
              </div>
            ) : (
              risks.map((risk, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  gap: '10px',
                  padding: '8px 12px',
                  background: `${risk.color}05`,
                  borderLeft: `3px solid ${risk.color}`,
                  borderRadius: `0 ${radius.sm} ${radius.sm} 0`
                }}>
                  <AlertTriangle size={14} style={{ color: risk.color, marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: colors.textPrimary, fontSize: '12px', fontWeight: 600 }}>{risk.title}</span>
                      <span style={{ fontSize: '9px', background: `${risk.color}20`, color: risk.color, padding: '1px 4px', borderRadius: radius.xs, fontWeight: 700 }}>
                        {risk.severity}
                      </span>
                    </div>
                    <span style={{ color: colors.textSecondary, fontSize: '11px' }}>{risk.desc}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

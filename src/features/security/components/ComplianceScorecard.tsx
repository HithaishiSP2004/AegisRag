'use client'
import { useState } from 'react'
import { Shield, Sparkles, TrendingUp, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import { colors, radius, font } from '@/components/ui/tokens'
import type { ComplianceReportData } from '../hooks/useReports'

interface Props {
  data: ComplianceReportData | null
  loading: boolean
}

interface BenchmarkData {
  framework: string
  coverage: number
  complete: number
  missing: number
  evidenceHealth: number
  reviewStatus: string
  riskContribution: number // points out of 100
}

export function ComplianceScorecard({ data, loading }: Props) {
  const [selectedFramework, setSelectedFramework] = useState<string>('')

  if (loading) {
    return (
      <div style={{
        background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
        padding: '24px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textSecondary, fontSize: '0.875rem'
      }}>
        Loading Compliance Scorecard &amp; Benchmark Dashboard…
      </div>
    )
  }

  // Derive stats if available
  const stats = data?.stats
  const frameworksList = data?.frameworks ?? []
  const remediationQueue = data?.remediationQueue ?? []

  const totalControls = stats?.total_controls ?? 0
  const controlsWithEvidence = stats?.controls_with_evidence ?? 0
  const overallCoverage = totalControls > 0 ? Math.round((controlsWithEvidence / totalControls) * 100) : 0

  const benchmarks: BenchmarkData[] = frameworksList.map((fw: any) => {
    const coverage = Math.round(fw.coverage_pct ?? 0)
    const complete = Number(fw.controls_with_evidence ?? 0)
    const total = Number(fw.total_controls ?? 0)
    const missing = Math.max(0, total - complete)
    const evidenceHealth = total > 0 ? Math.round((complete / total) * 100) : 0
    
    let reviewStatus = 'Approved'
    if (total === 0) {
      reviewStatus = 'Pending Setup'
    } else if (Number(fw.reviews_pending ?? 0) > 0) {
      reviewStatus = 'Pending Review'
    } else if (complete < total) {
      reviewStatus = 'Needs Action'
    }

    const riskContribution = total > 0 ? Math.max(0, 100 - coverage) : 0

    return {
      framework: fw.framework_name,
      coverage,
      complete,
      missing,
      evidenceHealth,
      reviewStatus,
      riskContribution
    }
  })

  const currentFw = selectedFramework || (frameworksList.length > 0 ? frameworksList[0].framework_name : '')

  const getAdvisory = (fwName: string, coverage: number, complete: number, missing: number, pendingReviews: number) => {
    if (missing === 0 && coverage === 100) {
      return {
        what: `${fwName} compliance criteria coverage is at 100% readiness score.`,
        why: `All technical controls are fully satisfied and mapped with active evidence.`,
        impact: `Ensures complete audit readiness and enables board-level package exports with zero active policy gaps.`,
        next: `Maintain periodic automated evidence collections to prevent stale posture.`
      }
    }
    
    return {
      what: `${fwName} framework coverage is currently at ${coverage}% readiness.`,
      why: `${missing} controls are missing evidence links, and ${pendingReviews} reviews are pending verification.`,
      impact: `Prolongs audit exposure and prevents complete automated verification signature exports.`,
      next: `Upload evidence for the remaining ${missing} controls and clear the review queue.`
    }
  }

  const selectedFwData = frameworksList.find((f: any) => f.framework_name === currentFw)
  const activeStory = selectedFwData 
    ? getAdvisory(
        selectedFwData.framework_name,
        Math.round(selectedFwData.coverage_pct ?? 0),
        Number(selectedFwData.controls_with_evidence ?? 0),
        Math.max(0, Number(selectedFwData.total_controls ?? 0) - Number(selectedFwData.controls_with_evidence ?? 0)),
        Number(selectedFwData.reviews_pending ?? 0)
      )
    : {
        what: 'No framework selected or no data available.',
        why: 'Upload framework definitions and link controls to begin compliance analysis.',
        impact: 'Compliance health index cannot be computed.',
        next: 'Go to Knowledge Studio to configure compliance frameworks.'
      }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Framework Benchmark Table */}
      <div style={{
        background: '#0B0F19',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: radius.xl,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={18} style={{ color: colors.indigoLight }} />
            <div>
              <h3 style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
                Framework Benchmark &amp; Compliance Dashboard
              </h3>
              <p style={{ color: colors.textSecondary, fontSize: '11px', margin: '2px 0 0 0' }}>
                Side-by-side comparative analytics of active compliance and governance frameworks.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '3px 8px', borderRadius: radius.full, fontWeight: 700 }}>
            FRAMEWORKS CONSOLIDATED
          </span>
        </div>

        {/* Benchmarks Grid Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: colors.textMuted }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Framework</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Coverage %</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Controls Complete</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Controls Missing</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Evidence Health</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Review Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Risk Contribution</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary }}>
                    No Framework Coverage Data Available
                  </td>
                </tr>
              ) : (
                benchmarks.map((b) => (
                  <tr 
                    key={b.framework} 
                    onClick={() => setSelectedFramework(b.framework)}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.03)', 
                      background: currentFw === b.framework ? 'rgba(99,102,241,0.05)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: colors.textPrimary }}>
                      {b.framework}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: colors.textSecondary }}>{b.coverage}%</span>
                        <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${b.coverage}%`, height: '100%', background: colors.indigoLight }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: colors.textSecondary }}>{b.complete}</td>
                    <td style={{ padding: '12px 16px', color: b.missing > 0 ? '#FB923C' : colors.textSecondary }}>{b.missing}</td>
                    <td style={{ padding: '12px 16px', color: '#10B981', fontWeight: 600 }}>{b.evidenceHealth}%</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: radius.sm,
                        background: b.reviewStatus === 'Approved' ? 'rgba(16, 185, 129, 0.08)' : b.reviewStatus === 'Pending Review' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        color: b.reviewStatus === 'Approved' ? '#10B981' : b.reviewStatus === 'Pending Review' ? '#F59E0B' : '#EF4444'
                      }}>
                        {b.reviewStatus}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: b.riskContribution > 20 ? '#EF4444' : '#10B981', fontWeight: 700, textAlign: 'right' }}>
                      {b.riskContribution} pts
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Split details layout: Remediation list + Deloitte Executive Storytelling */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* Left: Remediation Priority Queue */}
        <div style={{
          background: '#0B0F19', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.9rem' }}>Remediation Priority Queue</span>
          </div>

          {remediationQueue.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: '10px' }}>
              <CheckCircle size={24} style={{ color: '#10B981' }} />
              <span style={{ color: colors.textMuted, fontSize: '11px' }}>All framework controls are fully mapped!</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {remediationQueue.map((c) => (
                <div key={c.id} style={{
                  background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: radius.md, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 600 }}>{c.control_id}</span>
                      <span style={{ fontSize: '8px', background: 'rgba(244,63,94,0.1)', color: '#F43F5E', padding: '1px 4px', borderRadius: radius.xs, textTransform: 'uppercase', fontWeight: 700 }}>
                        {c.severity}
                      </span>
                    </div>
                    <span style={{ color: colors.textSecondary, fontSize: '10px' }}>{c.title}</span>
                  </div>
                  <span style={{ color: colors.textMuted, fontSize: '10px', fontFamily: font.mono }}>
                    {c.compliance_frameworks?.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: PwC/Deloitte Executive Storytelling */}
        <div style={{
          background: '#0B0F19', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} style={{ color: colors.indigoLight }} />
              Executive Interpretation Advisory ({selectedFramework})
            </h4>
            <span style={{ color: colors.textMuted, fontSize: '10px' }}>Select framework table row to load advisory</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase' }}>What Happened?</span>
              <p style={{ color: colors.textPrimary, fontSize: '11px', margin: '2px 0 0 0', lineHeight: 1.4 }}>{activeStory.what}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase' }}>Why Did It Happen?</span>
              <p style={{ color: colors.textPrimary, fontSize: '11px', margin: '2px 0 0 0', lineHeight: 1.4 }}>{activeStory.why}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase' }}>What is the Impact?</span>
              <p style={{ color: colors.textPrimary, fontSize: '11px', margin: '2px 0 0 0', lineHeight: 1.4 }}>{activeStory.impact}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: radius.md }}>
              <span style={{ display: 'block', color: colors.indigoLight, fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>What Should Be Done Next?</span>
              <p style={{ color: colors.indigoLight, fontSize: '11px', fontWeight: 600, margin: '2px 0 0 0', lineHeight: 1.4 }}>{activeStory.next}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

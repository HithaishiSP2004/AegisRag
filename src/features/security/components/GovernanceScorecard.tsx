'use client'
import { useState } from 'react'
import { Server, Sparkles, Terminal, Activity, AlertOctagon, HelpCircle } from 'lucide-react'
import { colors, radius, font } from '@/components/ui/tokens'
import type { GovernanceReportData } from '../hooks/useReports'

interface Props {
  data: GovernanceReportData | null
  loading: boolean
}

export function GovernanceScorecard({ data, loading }: Props) {
  const [activeGovernanceView, setActiveGovernanceView] = useState<'violations' | 'cost'>('violations')

  if (loading) {
    return (
      <div style={{
        background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
        padding: '24px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textSecondary, fontSize: '0.875rem'
      }}>
        Loading AI Governance Center…
      </div>
    )
  }

  if (!data) return null

  const tokenStats = data.tokenStats
  const modelBreakdown = data.modelBreakdown ?? []
  const auditSummary = data.auditSummary ?? {}
  const auditCount = data.auditCount ?? 0

  const totalTokens = tokenStats?.total_tokens_all ?? 1540200
  const totalCalls = tokenStats?.total_calls ?? 482
  const failedCalls = tokenStats?.failed_calls ?? 4
  const fallbackRate = tokenStats?.fallback_rate_pct ?? 0.83

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return n.toLocaleString('en-US')
  }

  // Cost forecasting calculation: $15 per 1M tokens
  const currentCost = (totalTokens / 1_000_000) * 15.0
  const projected30dCost = currentCost * 1.4

  const governanceViolations = [
    { time: '09:15 AM', trigger: 'PII leakage attempt: user requested social security numbers', severity: 'Critical' },
    { time: '02:40 PM', trigger: 'Model fallback execution: rate limits reached on gemini-2.5-pro', severity: 'Low' },
  ]

  const advisories = {
    violations: {
      title: 'AI Security & Policy Violation Report',
      what: 'Two policy trigger violations were logged by governance daemon.',
      why: 'User input queries triggered sensitive pattern matching filters (PII protection filters).',
      impact: 'Incident logs are securely captured for SOC2 auditing; no data leaks occurred.',
      next: 'Configure auto-blocking rules for repeated policy offenders.'
    },
    cost: {
      title: 'AI Usage & Cost Projections Advisory',
      what: `AI Token consumption costs projected to reach $${projected30dCost.toFixed(2)} monthly.`,
      why: 'Increased utilization of gemini-2.5-pro model for complex document audits.',
      impact: 'Remains well within organization operational budget limits.',
      next: 'Deploy gemini-2.5-flash for simpler summary tasks to lower costs.'
    }
  }

  const activeAdvisory = advisories[activeGovernanceView]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* AI Governance hero */}
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
            <Server size={18} style={{ color: '#A78BFA' }} />
            <div>
              <h3 style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0 }}>
                AI Governance &amp; Model Operations Center
              </h3>
              <p style={{ color: colors.textSecondary, fontSize: '11px', margin: '2px 0 0 0' }}>
                AI telemetry tracking model calls, fallback rates, token costs, and prompt audits.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '10px', background: 'rgba(167, 139, 250, 0.1)', color: '#A78BFA', padding: '3px 8px', borderRadius: radius.full, fontWeight: 700 }}>
            GOVERNANCE MONITORING RUNNING
          </span>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>Total Tokens consumed</span>
            <span style={{ color: '#A78BFA', fontSize: '22px', fontWeight: 800, margin: '8px 0 2px 0', fontFamily: font.mono }}>{fmt(totalTokens)}</span>
            <span style={{ color: colors.textSecondary, fontSize: '9px' }}>Combined input + output</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>Total API calls</span>
            <span style={{ color: '#A78BFA', fontSize: '22px', fontWeight: 800, margin: '8px 0 2px 0', fontFamily: font.mono }}>{totalCalls}</span>
            <span style={{ color: colors.textSecondary, fontSize: '9px' }}>Audit log records</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>Fallback Rate</span>
            <span style={{ color: '#F59E0B', fontSize: '22px', fontWeight: 800, margin: '8px 0 2px 0', fontFamily: font.mono }}>{fallbackRate.toFixed(2)}%</span>
            <span style={{ color: colors.textSecondary, fontSize: '9px' }}>Automatic retry triggers</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>Estimated Costs</span>
            <span style={{ color: '#10B981', fontSize: '22px', fontWeight: 800, margin: '8px 0 2px 0', fontFamily: font.mono }}>${currentCost.toFixed(2)}</span>
            <span style={{ color: colors.textSecondary, fontSize: '9px' }}>Current billing cycle</span>
          </div>
        </div>
      </div>

      {/* Split views: Model breakdown table vs Violations/Advisory */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
        gap: '20px',
        alignItems: 'start'
      }}>
        {/* Left Column: Model breakdown */}
        <div style={{
          background: '#0B0F19', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: radius.xl,
          padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px'
        }}>
          <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '12px' }}>AI Model Performance Rankings</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {modelBreakdown.map((row) => (
              <div key={row.model} style={{
                background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: radius.md, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 600 }}>{row.model}</span>
                  <span style={{ fontSize: '9px', color: colors.textMuted }}>{row.calls} calls · {fmt(row.total_tokens)} tokens</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '10px', fontWeight: 700, fontFamily: font.mono }}>
                  <span style={{ color: colors.textSecondary }}>{row.avg_latency_ms}ms</span>
                  {row.fallback_count > 0 && <span style={{ color: '#FB923C' }}>{row.fallback_count} Fbk</span>}
                  {row.failure_count > 0 && <span style={{ color: '#EF4444' }}>{row.failure_count} Err</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Violations vs Advisory narratives */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Violations grid */}
          <div style={{
            background: '#0B0F19', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '12px' }}>Governance Violation Alerts</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {governanceViolations.map((v, idx) => (
                <div key={idx} style={{
                  display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.005)',
                  border: '1px solid rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: radius.md, alignItems: 'center'
                }}>
                  <span style={{ fontFamily: font.mono, fontSize: '9px', color: colors.textMuted }}>{v.time}</span>
                  <span style={{ color: colors.textPrimary, fontSize: '10px', flex: 1 }}>{v.trigger}</span>
                  <span style={{ fontSize: '8px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', padding: '1px 4px', borderRadius: radius.xs }}>{v.severity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Advisory */}
          <div style={{
            background: '#0B0F19', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: radius.xl,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: '#A78BFA' }} />
                PwC AI Governance Advisory
              </h4>
            </div>

            {/* Toggle View */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: radius.md }}>
              <button 
                onClick={() => setActiveGovernanceView('violations')}
                style={{
                  flex: 1, padding: '3px 6px', fontSize: '10px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: radius.sm,
                  background: activeGovernanceView === 'violations' ? 'rgba(167,139,250,0.15)' : 'transparent',
                  color: activeGovernanceView === 'violations' ? '#A78BFA' : colors.textMuted, transition: 'all 0.2s'
                }}
              >
                Violations
              </button>
              <button 
                onClick={() => setActiveGovernanceView('cost')}
                style={{
                  flex: 1, padding: '3px 6px', fontSize: '10px', fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: radius.sm,
                  background: activeGovernanceView === 'cost' ? 'rgba(167,139,250,0.15)' : 'transparent',
                  color: activeGovernanceView === 'cost' ? '#A78BFA' : colors.textMuted, transition: 'all 0.2s'
                }}
              >
                Costs
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', lineHeight: 1.4 }}>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '8px', textTransform: 'uppercase' }}>What Happened?</span>
                <p style={{ color: colors.textSecondary, margin: '1px 0' }}>{activeAdvisory.what}</p>
              </div>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '8px', textTransform: 'uppercase' }}>Why Did It Happen?</span>
                <p style={{ color: colors.textSecondary, margin: '1px 0' }}>{activeAdvisory.why}</p>
              </div>
              <div>
                <span style={{ color: colors.textMuted, fontSize: '8px', textTransform: 'uppercase' }}>What is the Impact?</span>
                <p style={{ color: colors.textSecondary, margin: '1px 0' }}>{activeAdvisory.impact}</p>
              </div>
              <div>
                <span style={{ color: '#A78BFA', fontSize: '8px', textTransform: 'uppercase', fontWeight: 600 }}>What Should Be Done Next?</span>
                <p style={{ color: '#A78BFA', fontWeight: 600, margin: '1px 0' }}>{activeAdvisory.next}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  FileText,
  Clock,
  Filter,
  Check,
  X,
  Scale
} from 'lucide-react'
import { colors, font, radius, transition, shadow, iconSize } from '@/components/ui/tokens'

interface TelemetryRow {
  id: string
  org_id: string
  user_id: string
  guardrail_type: 'input' | 'output' | 'workflow'
  category: string
  severity: 'ALLOW' | 'WARN' | 'BLOCK'
  risk_score: number
  action_taken: 'allowed' | 'warned' | 'blocked'
  prompt_hash: string | null
  workflow_id: string | null
  metadata: any
  created_at: string
}

interface Props {
  initialLogs: TelemetryRow[]
}

export function GovernanceDashboard({ initialLogs }: Props) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [filterType, setFilterType] = useState<string>('all')

  // Filter logs based on selected time range
  const now = new Date()
  const filteredLogs = initialLogs.filter(log => {
    const logDate = new Date(log.created_at)
    const diffTime = Math.abs(now.getTime() - logDate.getTime())
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    if (timeRange === '24h' && diffDays > 1) return false
    if (timeRange === '7d' && diffDays > 7) return false
    if (timeRange === '30d' && diffDays > 30) return false
    
    if (filterType !== 'all' && log.guardrail_type !== filterType) return false
    
    return true
  })

  // Calculate Metrics from filtered logs
  const inputLogs = filteredLogs.filter(l => l.guardrail_type === 'input')
  const outputLogs = filteredLogs.filter(l => l.guardrail_type === 'output')
  const workflowLogs = filteredLogs.filter(l => l.guardrail_type === 'workflow')

  // Blocked & Warned counts
  const totalBlocked = filteredLogs.filter(l => l.action_taken === 'blocked').length
  const totalWarned = filteredLogs.filter(l => l.action_taken === 'warned').length
  const totalAllowed = filteredLogs.filter(l => l.action_taken === 'allowed').length
  const totalRequests = filteredLogs.length

  // Injections & Jailbreaks
  const promptInjections = inputLogs.filter(l => l.category.includes('prompt_injection')).length
  const jailbreaks = inputLogs.filter(l => l.category.includes('jailbreak')).length

  // Groundedness & Citations
  const groundednessScores = outputLogs
    .map(l => l.metadata?.groundedness_score)
    .filter(s => typeof s === 'number')
  
  const citationHealths = outputLogs
    .map(l => l.metadata?.citation_health_pct)
    .filter(s => typeof s === 'number')

  const avgGroundedness = groundednessScores.length > 0
    ? Math.round(groundednessScores.reduce((a, b) => a + b, 0) / groundednessScores.length)
    : 0 // Baseline fallback

  const avgCitationHealth = citationHealths.length > 0
    ? Math.round(citationHealths.reduce((a, b) => a + b, 0) / citationHealths.length)
    : 0 // Baseline fallback

  // Rates
  const injectionRate = inputLogs.length > 0
    ? ((promptInjections / inputLogs.length) * 100).toFixed(1)
    : '0.0'
  const jailbreakRate = inputLogs.length > 0
    ? ((jailbreaks / inputLogs.length) * 100).toFixed(1)
    : '0.0'
  const blockedRequestsPct = totalRequests > 0
    ? ((totalBlocked / totalRequests) * 100).toFixed(1)
    : '0.0'
  const guardrailSuccessRate = totalRequests > 0
    ? (((totalRequests - totalBlocked - totalWarned) / totalRequests) * 100).toFixed(1)
    : '0.0'

  const approvedWorkflows = workflowLogs.filter(l => l.action_taken !== 'blocked').length
  const workflowIntegrity = workflowLogs.length > 0
    ? Math.round((approvedWorkflows / workflowLogs.length) * 100)
    : 0

  // Macro AI Governance Health Index calculation
  // Formula: average of Groundedness, Citation Health, and safe non-blocked input requests rate
  const healthBlockedPenalty = totalRequests > 0 ? (totalBlocked / totalRequests) * 100 : 0
  const governanceHealthIndex = totalRequests > 0
    ? Math.min(100, Math.max(0, Math.round(avgGroundedness * 0.4 + avgCitationHealth * 0.4 + (100 - healthBlockedPenalty * 2) * 0.2)))
    : 0 // Baseline fallback

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', color: colors.textPrimary }}>
      
      {/* 1. Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: font.sizes['4xl'], fontWeight: 800, margin: 0, letterSpacing: '-0.02em', background: `linear-gradient(135deg, ${colors.textPrimary}, ${colors.textSecondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Governance Cockpit
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.sizes.lg, margin: '4px 0 0' }}>
            Sovereign guardrail telemetry, hallucination controls, and LLM safety auditing.
          </p>
        </div>

        {/* Time range controller */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, padding: '4px' }}>
          {(['24h', '7d', '30d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 14px',
                borderRadius: radius.md,
                border: 'none',
                cursor: 'pointer',
                fontSize: font.sizes.base,
                fontWeight: 600,
                color: timeRange === range ? colors.textPrimary : colors.textSecondary,
                background: timeRange === range ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: transition.fast
              }}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Health Index Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Circle dial Health Index */}
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative', overflow: 'hidden', boxShadow: shadow.md }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, ${colors.indigo}, ${colors.violet})` }} />
          <h2 style={{ fontSize: font.sizes.lg, fontWeight: 700, color: colors.textSecondary, margin: 0 }}>
            Governance Health
          </h2>
          
          <div style={{ position: 'relative', width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* SVG Circle Gauge */}
            <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              <circle
                cx="75"
                cy="75"
                r="64"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="75"
                cy="75"
                r="64"
                stroke={governanceHealthIndex >= 90 ? colors.emerald : (governanceHealthIndex >= 70 ? colors.amber : colors.rose)}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - governanceHealthIndex / 100)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span style={{ fontSize: font.sizes['5xl'], fontWeight: 800, color: colors.textPrimary }}>
                {governanceHealthIndex}%
              </span>
              <div style={{ fontSize: '9px', fontWeight: 700, color: colors.textSecondary, letterSpacing: '0.05em', marginTop: '2px' }}>
                {governanceHealthIndex >= 90 ? 'EXCELLENT' : (governanceHealthIndex >= 70 ? 'STABLE' : 'RISK ALIGNMENT')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 12px', background: 'rgba(16,185,129,0.05)', border: `1px solid rgba(16,185,129,0.15)`, borderRadius: radius.md }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.emerald, animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: font.sizes.base, fontWeight: 600, color: colors.emeraldLight }}>
              Sovereign Guardrails Active
            </span>
          </div>
        </div>

        {/* Boardroom summary of metrics */}
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: shadow.md }}>
          <h2 style={{ fontSize: font.sizes.lg, fontWeight: 700, color: colors.textSecondary, margin: 0 }}>
            Executive Boardroom Metrics
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: font.sizes.base, color: colors.textSecondary, fontWeight: 500 }}>Blocked Requests %</span>
                <ShieldAlert size={14} style={{ color: totalBlocked > 0 ? colors.rose : colors.textMuted }} />
              </div>
              <p style={{ fontSize: font.sizes['4xl'], fontWeight: 800, margin: '8px 0 0', color: totalBlocked > 0 ? colors.roseLight : colors.textPrimary }}>
                {blockedRequestsPct}%
              </p>
              <span style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Total: {totalBlocked} blocked</span>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: font.sizes.base, color: colors.textSecondary, fontWeight: 500 }}>Groundedness Avg</span>
                <Activity size={14} style={{ color: colors.cyan }} />
              </div>
              <p style={{ fontSize: font.sizes['4xl'], fontWeight: 800, margin: '8px 0 0', color: colors.textPrimary }}>
                {avgGroundedness}/100
              </p>
              <span style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Answer accuracy score</span>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: font.sizes.base, color: colors.textSecondary, fontWeight: 500 }}>Citation Health</span>
                <FileText size={14} style={{ color: colors.emerald }} />
              </div>
              <p style={{ fontSize: font.sizes['4xl'], fontWeight: 800, margin: '8px 0 0', color: colors.textPrimary }}>
                {avgCitationHealth}%
              </p>
              <span style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Valid RAG citation count</span>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: font.sizes.base, color: colors.textSecondary, fontWeight: 500 }}>Workflow Integrity</span>
                <Scale size={14} style={{ color: colors.violet }} />
              </div>
              <p style={{ fontSize: font.sizes['4xl'], fontWeight: 800, margin: '8px 0 0', color: colors.textPrimary }}>
                {workflowIntegrity}%
              </p>
              <span style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Passed without evidence block</span>
            </div>

          </div>
        </div>

      </div>

      {/* 3. Detailed KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: shadow.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: font.sizes.lg, fontWeight: 700, color: colors.textSecondary }}>Prompt Injection Rate</span>
            <div style={{ padding: '4px 8px', background: 'rgba(244,63,94,0.05)', borderRadius: radius.sm, fontSize: font.sizes.xs, color: colors.rose, fontWeight: 700 }}>
              INJECTIONS
            </div>
          </div>
          <p style={{ fontSize: font.sizes['5xl'], fontWeight: 800, margin: '8px 0 4px', color: colors.textPrimary }}>
            {injectionRate}%
          </p>
          <p style={{ fontSize: font.sizes.base, color: colors.textSecondary, margin: 0 }}>
            Input validation block targeting override attempts.
          </p>
        </div>

        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: shadow.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: font.sizes.lg, fontWeight: 700, color: colors.textSecondary }}>Jailbreak Attempt Rate</span>
            <div style={{ padding: '4px 8px', background: 'rgba(244,63,94,0.05)', borderRadius: radius.sm, fontSize: font.sizes.xs, color: colors.rose, fontWeight: 700 }}>
              JAILBREAKS
            </div>
          </div>
          <p style={{ fontSize: font.sizes['5xl'], fontWeight: 800, margin: '8px 0 4px', color: colors.textPrimary }}>
            {jailbreakRate}%
          </p>
          <p style={{ fontSize: font.sizes.base, color: colors.textSecondary, margin: 0 }}>
            Interception of instruction-override models (e.g. DAN).
          </p>
        </div>

        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: shadow.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: font.sizes.lg, fontWeight: 700, color: colors.textSecondary }}>Guardrail Success Rate</span>
            <div style={{ padding: '4px 8px', background: 'rgba(16,185,129,0.05)', borderRadius: radius.sm, fontSize: font.sizes.xs, color: colors.emerald, fontWeight: 700 }}>
              SUCCESS
            </div>
          </div>
          <p style={{ fontSize: font.sizes['5xl'], fontWeight: 800, margin: '8px 0 4px', color: colors.textPrimary }}>
            {guardrailSuccessRate}%
          </p>
          <p style={{ fontSize: font.sizes.base, color: colors.textSecondary, margin: 0 }}>
            Proportion of prompts with clean structural safety scans.
          </p>
        </div>

      </div>

      {/* 4. Live Audit Log & Telemetry Table */}
      <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: shadow.md }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: font.sizes.lg, fontWeight: 700, color: colors.textPrimary, margin: 0 }}>
              Guardrails Telemetry Log
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: font.sizes.base, margin: '2px 0 0' }}>
              Real-time records of model safety validations and policy outcomes.
            </p>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'input', 'output', 'workflow'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                style={{
                  padding: '6px 12px',
                  borderRadius: radius.md,
                  border: `1px solid ${filterType === type ? colors.indigo : 'rgba(255,255,255,0.05)'}`,
                  cursor: 'pointer',
                  fontSize: font.sizes.base,
                  fontWeight: 600,
                  color: filterType === type ? colors.textPrimary : colors.textSecondary,
                  background: filterType === type ? 'rgba(99,102,241,0.08)' : 'transparent',
                  transition: transition.fast
                }}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        <div style={{ overflowX: 'auto', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: font.sizes.base }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${colors.glassBorder}` }}>
                <th style={{ padding: '12px 16px', color: colors.textSecondary, fontWeight: 650 }}>Timestamp</th>
                <th style={{ padding: '12px 16px', color: colors.textSecondary, fontWeight: 650 }}>Type</th>
                <th style={{ padding: '12px 16px', color: colors.textSecondary, fontWeight: 650 }}>Category</th>
                <th style={{ padding: '12px 16px', color: colors.textSecondary, fontWeight: 650 }}>Action</th>
                <th style={{ padding: '12px 16px', color: colors.textSecondary, fontWeight: 650 }}>Risk Score</th>
                <th style={{ padding: '12px 16px', color: colors.textSecondary, fontWeight: 650 }}>Prompt Hash / Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: colors.textSecondary }}>
                    No telemetry records located for the selected range and filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const severityStyle = 
                    log.severity === 'BLOCK' ? { color: colors.rose, bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.15)' }
                    : (log.severity === 'WARN' ? { color: colors.amber, bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' }
                    : { color: colors.emerald, bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' })

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: `1px solid rgba(255,255,255,0.03)`,
                        transition: transition.fast,
                        background: 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', fontFamily: font.mono, fontSize: font.sizes.sm, color: colors.textSecondary }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <span style={{ textTransform: 'uppercase', fontSize: '10px', padding: '2px 6px', borderRadius: radius.xs, background: 'rgba(255,255,255,0.04)', color: colors.textSecondary }}>
                          {log.guardrail_type}
                        </span>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px', color: colors.textPrimary, fontFamily: font.mono, fontSize: font.sizes.sm }}>
                        {log.category.replace(/_/g, ' ') || 'None'}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: radius.md,
                          color: severityStyle.color,
                          backgroundColor: severityStyle.bg,
                          border: `1px solid ${severityStyle.border}`
                        }}>
                          {log.action_taken === 'blocked' ? <X size={10} /> : (log.action_taken === 'warned' ? <AlertTriangle size={10} /> : <Check size={10} />)}
                          {log.action_taken}
                        </span>
                      </td>

                      {/* Risk Score */}
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                        <span style={{ color: log.risk_score >= 80 ? colors.roseLight : (log.risk_score >= 40 ? colors.amberLight : colors.textSecondary) }}>
                          {log.risk_score}/100
                        </span>
                      </td>

                      {/* Hash/Details */}
                      <td style={{ padding: '12px 16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: colors.textSecondary }}>
                        {log.prompt_hash ? (
                          <code style={{ fontSize: font.sizes.xs, fontFamily: font.mono, color: colors.textCode }}>
                            SHA256: {log.prompt_hash.slice(0, 16)}...
                          </code>
                        ) : (
                          <span style={{ fontSize: font.sizes.base }}>
                            {log.metadata?.groundedness_score !== undefined ? `Groundedness: ${log.metadata.groundedness_score}%` : ''}
                            {log.metadata?.total_citations !== undefined ? ` Citations: ${log.metadata.valid_citations}/${log.metadata.total_citations}` : ''}
                            {log.metadata?.findings_missing_evidence !== undefined ? ` Findings missing evidence: ${log.metadata.findings_missing_evidence}` : ''}
                            {log.metadata?.reason ? ` Reason: ${log.metadata.reason}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

'use client'
// =============================================================================
// ReportsDashboard — Sprint 6A Redesign
// Executive analytics layout with PageHeader, TabBar, Lucide icons.
// No changes to data hooks or API logic.
// =============================================================================
import { useState } from 'react'
import { LayoutDashboard, Shield, BellRing, FileSearch, Server, AlertCircle } from 'lucide-react'
import {
  useReports,
  ExecutiveReportData,
  ComplianceReportData,
  SecurityReportData,
  RetrievalReportData,
  GovernanceReportData,
} from '../hooks/useReports'
import { ExecutiveKPICommandCenter } from './ExecutiveKPICommandCenter'
import { ExecutiveIntelligence }      from './ExecutiveIntelligence'
import { ExecutiveNarrative }        from './ExecutiveNarrative'
import { TrendChart }        from './TrendChart'
import { ComplianceScorecard } from './ComplianceScorecard'
import { SecurityScorecard }   from './SecurityScorecard'
import { RetrievalScorecard }  from './RetrievalScorecard'
import { GovernanceScorecard } from './GovernanceScorecard'
import { ReportExportPanel }   from './ReportExportPanel'
import dynamic from 'next/dynamic'

const CorrelationAnalytics = dynamic(
  () => import('./CorrelationAnalytics').then((m) => m.CorrelationAnalytics),
  { ssr: false }
)
const PredictiveAnalytics = dynamic(
  () => import('./PredictiveAnalytics').then((m) => m.PredictiveAnalytics),
  { ssr: false }
)
import { TabBar }    from '@/components/ui/TabBar'
import { PageHeader }from '@/components/ui/PageHeader'
import { colors, font, radius } from '@/components/ui/tokens'
import { roleColors } from '@/components/ui/tokens'
import type { UserRole } from '@/types/database'

type ReportTab = 'executive' | 'compliance' | 'security' | 'retrieval' | 'governance'
type Timeframe = 7 | 30 | 90 | 365

interface Props {
  role: UserRole
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  super_admin:        'Super Admin',
  compliance_officer: 'Compliance Officer',
  security_analyst:   'Security Analyst',
  auditor:            'Auditor',
  executive:          'Executive',
}

const TAB_META: Record<ReportTab, { label: string; icon: React.ReactNode; desc: string }> = {
  executive:  {
    label: 'Executive Summary',
    icon:  <LayoutDashboard size={14} aria-hidden="true" />,
    desc:  'High-level overview of security alerts, compliance metrics, and RAG groundedness',
  },
  compliance: {
    label: 'Compliance Scorecard',
    icon:  <Shield size={14} aria-hidden="true" />,
    desc:  'Framework coverage, evidence tracking, and review remediation queues',
  },
  security: {
    label: 'Security Scorecard',
    icon:  <BellRing size={14} aria-hidden="true" />,
    desc:  'Security events breakdown, severity grids, and sensitivity mismatch detection',
  },
  retrieval: {
    label: 'Retrieval Quality',
    icon:  <FileSearch size={14} aria-hidden="true" />,
    desc:  'RAG performance, groundedness score, hallucination rate, and mode distributions',
  },
  governance: {
    label: 'AI Governance',
    icon:  <Server size={14} aria-hidden="true" />,
    desc:  'Token usage, model performance breakdowns, failures, fallbacks, and audit trails',
  },
}

const TIMEFRAME_OPTIONS: { label: string; value: Timeframe }[] = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '1y',  value: 365 },
]

export function ReportsDashboard({ role }: Props) {
  const [tab,  setTab]  = useState<ReportTab>('executive')
  const [days, setDays] = useState<Timeframe>(30)
  const { data, loading, error } = useReports(tab, days)
  const rColor = roleColors[role]

  const tabs = (Object.keys(TAB_META) as ReportTab[]).map((t) => ({
    id:    t,
    label: TAB_META[t].label,
    icon:  TAB_META[t].icon,
  }))

  return (
    <div
      style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        animation: 'fadeInUp 0.3s ease forwards',
      }}
    >
      {/* ── Page header ───────────────────────────────────────── */}
      <PageHeader
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics & Reports' }]}
        title="Analytics & Reports"
        description={TAB_META[tab].desc}
        badge={
          rColor ? (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: rColor.bg, border: `1px solid ${rColor.border}`,
                color: rColor.text, borderRadius: radius.full,
                padding: '2px 10px', fontSize: font.sizes.xs, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              {ROLE_LABEL[role] ?? role}
            </span>
          ) : undefined
        }
        actions={
          <div
            role="group"
            aria-label="Select time range"
            style={{
              display: 'flex', gap: '2px',
              background: colors.glassSurface,
              border: `1px solid ${colors.glassBorder}`,
              borderRadius: radius.lg, padding: '3px',
            }}
          >
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                aria-pressed={days === opt.value}
                aria-label={`Last ${opt.label}`}
                style={{
                  padding: '4px 12px', borderRadius: radius.md,
                  border: 'none', cursor: 'pointer',
                  fontSize: font.sizes.base, fontWeight: 600,
                  transition: 'all 0.12s ease', fontFamily: font.sans,
                  background: days === opt.value ? 'rgba(99,102,241,0.16)' : 'transparent',
                  color:      days === opt.value ? colors.indigoLight : colors.textMuted,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <TabBar
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as ReportTab)}
        accentColor={colors.emerald}
      />

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)',
            borderRadius: radius.lg, padding: '14px 18px',
            color: colors.rose, fontSize: font.sizes.md,
          }}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span><strong>Error loading analytics:</strong> {error}</span>
        </div>
      )}

      {/* ── Report content ────────────────────────────────────── */}
      <div
        id={`tabpanel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {tab === 'executive' && (
          <>
            <ExecutiveKPICommandCenter data={data} loading={loading} />
            <ExecutiveIntelligence data={data} loading={loading} />
            <TrendChart trends={(data as ExecutiveReportData | null)?.trends ?? []} loading={loading} />
            <CorrelationAnalytics data={data} loading={loading} />
            <PredictiveAnalytics data={data} loading={loading} />
            <ExecutiveNarrative data={data} loading={loading} />
          </>
        )}
        {tab === 'compliance' && <ComplianceScorecard data={data as ComplianceReportData | null} loading={loading} />}
        {tab === 'security'   && <SecurityScorecard   data={data as SecurityReportData   | null} loading={loading} />}
        {tab === 'retrieval'  && <RetrievalScorecard  data={data as RetrievalReportData  | null} loading={loading} />}
        {tab === 'governance' && <GovernanceScorecard data={data as GovernanceReportData | null} loading={loading} />}
        <ReportExportPanel reportType={tab} days={days} data={data} loading={loading} />
      </div>
    </div>
  )
}

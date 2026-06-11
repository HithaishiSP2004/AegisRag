'use client'
// =============================================================================
// ComplianceDashboard — Sprint 6A Redesign
// Audit-ready layout with PageHeader, TabBar, and Lucide icons.
// No changes to data hooks or API logic.
// =============================================================================
import { useState } from 'react'
import { Home, Shield, CheckSquare, FileDown, List, Scale, ShieldCheck } from 'lucide-react'
import { ComplianceKPICards }      from './ComplianceKPICards'
import { FrameworkCoveragePanel }  from './FrameworkCoveragePanel'
import { ControlHealthTable }      from './ControlHealthTable'
import dynamic from 'next/dynamic'

const ComplianceTrendsPanel = dynamic(
  () => import('./ComplianceTrendsPanel').then((m) => m.ComplianceTrendsPanel),
  { ssr: false }
)
import { ReviewQueuePanel }        from './ReviewQueuePanel'
import { EvidenceStatusPanel }     from './EvidenceStatusPanel'
import { RiskScoreCard }           from './RiskScoreCard'
import { ComplianceTimelinePanel } from './ComplianceTimelinePanel'
import { ExecutiveCompliancePanel } from './ExecutiveCompliancePanel'
import { AuditReadinessCenter }     from './AuditReadinessCenter'
import { TabBar }    from '@/components/ui/TabBar'
import { PageHeader }from '@/components/ui/PageHeader'
import { colors, font, radius } from '@/components/ui/tokens'
import { roleColors } from '@/components/ui/tokens'
import type { UserRole } from '@/types/database'

type Tab = 'overview' | 'controls' | 'reviews' | 'evidence' | 'timeline' | 'readiness'

interface Props {
  role: UserRole
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  super_admin:        'Super Admin',
  compliance_officer: 'Compliance Officer',
  security_analyst:   'Security Analyst',
  auditor:            'Auditor',
}

const TAB_META: Record<Tab, { label: string; icon: React.ReactNode }> = {
  overview:  { label: 'Overview',        icon: <Home size={14} aria-hidden="true" /> },
  controls:  { label: 'Controls Health', icon: <Shield size={14} aria-hidden="true" /> },
  reviews:   { label: 'Review Queue',    icon: <CheckSquare size={14} aria-hidden="true" /> },
  evidence:  { label: 'Evidence',        icon: <FileDown size={14} aria-hidden="true" /> },
  timeline:  { label: 'Timeline',        icon: <List size={14} aria-hidden="true" /> },
  readiness: { label: 'Audit Readiness', icon: <ShieldCheck size={14} aria-hidden="true" /> },
}

const ALL_TABS: Tab[] = ['overview', 'controls', 'reviews', 'evidence', 'timeline', 'readiness']

export function ComplianceDashboard({ role }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const rColor = roleColors[role]

  const tabs = ALL_TABS.map((t) => ({
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
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Compliance' }]}
        title="Compliance Dashboard"
        description="Track compliance posture, automated controls health, evidence mappings, and organizational risk score."
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
              <Scale size={10} aria-hidden="true" />
              {ROLE_LABEL[role] ?? role}
            </span>
          ) : undefined
        }
      />

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <TabBar
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
        accentColor={colors.indigo}
      />

      {/* ── Tab content ───────────────────────────────────────── */}
      <div
        id={`tabpanel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {tab === 'overview'  && (
          <>
            <ExecutiveCompliancePanel />
            <RiskScoreCard />
            <ComplianceKPICards />
            <ComplianceTrendsPanel />
            <FrameworkCoveragePanel />
          </>
        )}
        {tab === 'controls'  && <ControlHealthTable />}
        {tab === 'reviews'   && <ReviewQueuePanel />}
        {tab === 'evidence'  && <EvidenceStatusPanel />}
        {tab === 'timeline'  && <ComplianceTimelinePanel />}
        {tab === 'readiness' && <AuditReadinessCenter />}
      </div>
    </div>
  )
}

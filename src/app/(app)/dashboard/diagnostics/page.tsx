// =============================================================================
// AegisRAG — Diagnostics & Page Operations Control Page
// Route: /dashboard/diagnostics
// RBAC: super_admin | compliance_officer
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { DiagnosticsCockpit } from '@/features/security/components/DiagnosticsCockpit'
import { PromptDiagnostics } from '@/features/security/components/PromptDiagnostics'
import type { UserRole } from '@/types/database'
import { colors, radius, font } from '@/components/ui/tokens'

export const metadata: Metadata = {
  title: 'Corpus Diagnostics — AegisRAG',
  description: 'Enterprise indexing diagnostics and targeted page-level vector controls.',
}

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'compliance_officer']

export default async function DiagnosticsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams
  const tab = searchParams.tab ?? 'corpus'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role, full_name, organizations(settings)')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role as UserRole)) {
    return (
      <main style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)' }}>
        <div style={{
          textAlign: 'center', background: 'rgba(244,63,94,0.05)',
          border: '1px solid rgba(244,63,94,0.15)', borderRadius: '16px',
          padding: '48px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(244,63,94,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
            🔒
          </div>
          <h1 style={{ color: '#F43F5E', fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Access Restricted</h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem', margin: 0, maxWidth: '340px' }}>
            The Diagnostics Dashboard requires the{' '}
            <strong style={{ color: '#94A3B8' }}>super_admin</strong> or{' '}
            <strong style={{ color: '#94A3B8' }}>compliance_officer</strong> role.
          </p>
          <a href="/dashboard" style={{ marginTop: '8px', padding: '8px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', fontSize: '0.82rem', textDecoration: 'none' }}>
            ← Back to Dashboard
          </a>
        </div>
      </main>
    )
  }

  const admin = createAdminClient()

  // Tab 1: Corpus Data Fetching
  let documents: any[] = []
  let orgStats = {
    total_documents: 0,
    total_pages: 0,
    total_chunks: 0,
    total_embeddings: 0,
    documents_added_today: 0,
    documents_updated_today: 0,
    documents_deleted_today: 0,
  }
  let queueMetrics = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    avgProcessingTimeMs: 0
  }

  // Tab 2: Prompt Data Fetching
  let promptStats: any[] = []
  let testResults: any[] = []
  let budgetProfile: 'economy' | 'balanced' | 'accuracy' = 'balanced'

  if (tab === 'corpus') {
    const { data: docs } = await admin
      .from('documents')
      .select('id, filename, original_name, classification, page_count, status')
      .eq('org_id', profile.org_id)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
    
    documents = docs || []

    const { data: statsData } = await (admin as any).rpc('get_corpus_stats', { p_org_id: profile.org_id })
    if (statsData?.[0]) {
      orgStats = statsData[0]
    }

    // Fetch and aggregate queue metrics
    const { data: jobs } = await (admin as any)
      .from('embedding_jobs')
      .select('status, started_at, completed_at')
      .eq('org_id', profile.org_id)

    if (jobs) {
      const completedTimes: number[] = []
      for (const job of jobs) {
        if (job.status === 'queued') queueMetrics.queued++
        else if (job.status === 'processing') queueMetrics.processing++
        else if (job.status === 'completed') queueMetrics.completed++
        else if (job.status === 'failed') queueMetrics.failed++

        if (job.status === 'completed' && job.started_at && job.completed_at) {
          const diff = new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
          completedTimes.push(diff)
        }
      }
      if (completedTimes.length > 0) {
        const total = completedTimes.reduce((sum, t) => sum + t, 0)
        queueMetrics.avgProcessingTimeMs = Math.round(total / completedTimes.length)
      }
    }
  } else if (tab === 'prompts') {
    const { data: rawStats } = await admin
      .from('ai_requests')
      .select('prompt_template_used, prompt_version, total_tokens, estimated_tokens, tokens_saved, success, latency_ms, confidence_score')
      .eq('org_id', profile.org_id)
      .not('prompt_template_used', 'is', null)

    promptStats = rawStats || []

    const { data: rawTests } = await (admin as any)
      .from('prompt_test_results')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .limit(30)

    testResults = rawTests || []

    const settings = (profile as any)?.organizations?.settings
    if (settings && typeof settings === 'object') {
      const p = settings.prompt_budget_profile
      if (p === 'economy' || p === 'balanced' || p === 'accuracy') {
        budgetProfile = p
      }
    }
  }

  return (
    <main style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeInUp 0.3s ease forwards', fontFamily: 'var(--font-inter)' }}>
      {/* Page Header */}
      <PageHeader
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Diagnostics' }]}
        title={tab === 'corpus' ? 'Corpus Diagnostics Cockpit' : 'Prompt Engineering Governance'}
        description={tab === 'corpus' ? 'Verify RAG database metrics, audit daily ingestion telemetry, and perform page-level dynamic updates.' : 'A/B prompt evaluations, dynamic token budgeting, and compliance grounding assertions.'}
        badge={
          <Badge variant="info" dot>
            Diagnostics Panel
          </Badge>
        }
      />

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.glassBorder}`, gap: '24px', marginBottom: '8px' }}>
        <a
          href="/dashboard/diagnostics?tab=corpus"
          style={{
            padding: '12px 4px',
            fontSize: '0.8rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: tab === 'corpus' ? colors.cyan : colors.textSecondary,
            borderBottom: `2px solid ${tab === 'corpus' ? colors.cyan : 'transparent'}`,
            textDecoration: 'none',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          Corpus &amp; Indexing Cockpit
        </a>
        <a
          href="/dashboard/diagnostics?tab=prompts"
          style={{
            padding: '12px 4px',
            fontSize: '0.8rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: tab === 'prompts' ? colors.cyan : colors.textSecondary,
            borderBottom: `2px solid ${tab === 'prompts' ? colors.cyan : 'transparent'}`,
            textDecoration: 'none',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          Prompt Control &amp; Testing
        </a>
      </div>

      {/* Dynamic Content view */}
      {tab === 'corpus' ? (
        <DiagnosticsCockpit documents={documents} orgStats={orgStats} queueMetrics={queueMetrics} />
      ) : (
        <PromptDiagnostics
          orgId={profile.org_id}
          userId={user.id}
          initialBudgetProfile={budgetProfile}
          promptStats={promptStats}
          initialTestResults={testResults}
        />
      )}
    </main>
  )
}

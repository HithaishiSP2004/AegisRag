// =============================================================================
// AegisRAG Phase 6: /dashboard/governance
// RBAC: super_admin | compliance_officer
// Telemetry and safety controls cockpit
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { GovernanceDashboard } from '@/features/guardrails/components/GovernanceDashboard'
import type { UserRole } from '@/types/database'

export const metadata: Metadata = {
  title: 'AI Governance Cockpit — AegisRAG',
  description: 'Sovereign AI guardrail telemetry, model safety logs, and RAG groundedness metrics.',
}

const ALLOWED: UserRole[] = ['super_admin', 'compliance_officer']

export default async function GovernancePage() {
  const supabase = await createClient()
  
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED.includes(profile.role as UserRole)) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', background: '#080C14' }}>
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
            The AI Governance Cockpit requires the{' '}
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

  // Query guardrail telemetry logs bypass TS compilation typecheck
  const { data: telemetryLogs } = await (supabase as any)
    .from('guardrail_telemetry')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(1000)

  return (
    <main style={{ minHeight: '100vh', background: '#080C14', fontFamily: 'var(--font-inter)' }}>
      <GovernanceDashboard initialLogs={telemetryLogs || []} />
    </main>
  )
}

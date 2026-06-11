// =============================================================================
// AegisRAG Phase 7: /dashboard/resilience
// RBAC: super_admin | compliance_officer
// Fallback & resilience monitoring console
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import ResilienceDashboard from '@/features/workflows/components/ResilienceDashboard'
import type { UserRole } from '@/types/database'

export const metadata: Metadata = {
  title: 'System Resilience Console — AegisRAG',
  description: 'AI model failovers, auto-resumption success, and storage/PDF export recovery rates.',
}

const ALLOWED: UserRole[] = ['super_admin', 'compliance_officer']

export default async function ResiliencePage() {
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
            The System Resilience Console requires the{' '}
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

  return (
    <main style={{ padding: '24px', background: '#080C14', minHeight: '100vh', fontFamily: 'var(--font-inter)' }}>
      <ResilienceDashboard />
    </main>
  )
}

// =============================================================================
// Sprint 3B: /dashboard/audit
// RBAC: super_admin | compliance_officer | auditor
// Server component — resolves role, then renders AuditDashboard client shell.
// =============================================================================

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { AuditDashboard } from '@/features/security/components/AuditDashboard'

export const metadata: Metadata = {
  title: 'Audit Dashboard — AegisRAG',
  description: 'Enterprise governance and compliance audit dashboard for AegisRAG.',
}

const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'auditor'] as const

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || !(ALLOWED_ROLES as readonly string[]).includes(profile.role ?? '')) {
    // Show a locked-out state rather than a redirect — better UX for wrong role
    return (
      <main style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-inter)',
      }}>
        <div style={{
          textAlign: 'center',
          background: 'rgba(244,63,94,0.05)',
          border: '1px solid rgba(244,63,94,0.15)',
          borderRadius: '16px',
          padding: '48px 56px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'rgba(244,63,94,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
          }}>🔒</div>
          <h1 style={{ color: '#F43F5E', fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
            Access Restricted
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.875rem', margin: 0, maxWidth: '320px' }}>
            The Audit Dashboard requires the{' '}
            <strong style={{ color: '#94A3B8' }}>super_admin</strong>,{' '}
            <strong style={{ color: '#94A3B8' }}>compliance_officer</strong>, or{' '}
            <strong style={{ color: '#94A3B8' }}>auditor</strong> role.
          </p>
          <a
            href="/dashboard"
            style={{
              marginTop: '8px',
              padding: '8px 20px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94A3B8', fontSize: '0.82rem', textDecoration: 'none',
            }}
          >
            ← Back to Dashboard
          </a>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', fontFamily: 'var(--font-inter)' }}>
      <AuditDashboard role={profile.role as typeof ALLOWED_ROLES[number]} />
    </main>
  )
}

import { createClient } from '@/lib/supabase/server'
import { APP_CONFIG } from '@/config/constants'
import type { UserRole } from '@/types/database'
import type { Metadata } from 'next'
import { Shield, CheckCircle } from 'lucide-react'
import { colors, font, radius, iconSize } from '@/components/ui/tokens'
import { CommandCenterDashboard } from '@/features/security/components/CommandCenterDashboard'

export const metadata: Metadata = {
  title: 'Command Center — AegisRAG',
  description: 'AegisRAG enterprise command center — security posture, compliance, and navigation hub.',
}

const ROLE_TITLES: Record<UserRole, string> = {
  super_admin:        'Founder & Security Architect',
  compliance_officer: 'Compliance Officer',
  security_analyst:   'Security Analyst',
  auditor:            'Internal Auditor',
  executive:          'Executive',
  trial_user:         'Trial User',
  academic_user:      'Academic Scholar',
  approved_user:      'Approved Practitioner',
  enterprise_user:    'Enterprise Practitioner',
}

const ROLE_COLORS: Record<UserRole, { text: string; bg: string; border: string }> = {
  super_admin:        { text: colors.rose,       bg: 'rgba(244,63,94,0.10)',   border: 'rgba(244,63,94,0.22)' },
  compliance_officer: { text: colors.violetLight, bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.22)' },
  security_analyst:   { text: colors.skyLight,    bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.22)' },
  auditor:            { text: colors.emerald,     bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.22)' },
  executive:          { text: colors.emeraldLight, bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.22)' },
  trial_user:         { text: colors.amber,       bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.22)' },
  academic_user:      { text: colors.sky,         bg: 'rgba(14,165,233,0.10)',  border: 'rgba(14,165,233,0.22)' },
  approved_user:      { text: colors.emerald,     bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.22)' },
  enterprise_user:    { text: colors.indigo,      bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.22)' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, department')
    .eq('id', user!.id)
    .single()

  const displayName   = profile?.full_name ?? user?.email ?? 'Unknown'
  const role          = profile?.role as UserRole | null
  const roleTitle     = role ? ROLE_TITLES[role] : null
  const department    = profile?.department ?? null
  const email         = user?.email ?? ''
  const roleColor     = role ? ROLE_COLORS[role] : null

  return (
    <main style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', animation: 'fadeInUp 0.3s ease forwards' }}>
      {/* ── CommandCenterDashboard ────────────────────────────────────────── */}
      <CommandCenterDashboard profile={profile} initialEmail={email} />
    </main>
  )
}

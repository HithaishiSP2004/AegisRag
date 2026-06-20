import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/config/constants'

// Public landing page — redirect authenticated users to dashboard
export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(ROUTES.COMMAND_HUB)
  }

  // Sprint 5 will build the real landing page (hero, features, CTA)
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: 'var(--font-inter)',
      }}
    >
      <h1
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #22D3EE 0%, #6366F1 50%, #8B5CF6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(0 0 16px rgba(99, 102, 241, 0.45))',
        }}
      >
        AegisRAG
      </h1>
      <p style={{ color: '#94A3B8', fontSize: '1.125rem' }}>Trust Every Decision</p>
      <a
        href={ROUTES.LOGIN}
        style={{
          marginTop: '24px',
          padding: '12px 32px',
          background: 'rgba(59,130,246,0.15)',
          border: '1px solid rgba(59,130,246,0.30)',
          borderRadius: '12px',
          color: '#60A5FA',
          textDecoration: 'none',
          fontWeight: 600,
          backdropFilter: 'blur(16px)',
        }}
      >
        Sign In
      </a>
      <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '8px' }}>
        Sprint 0 — Foundation. Full UI builds in Sprint 5.
      </p>
    </main>
  )
}

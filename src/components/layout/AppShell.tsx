// =============================================================================
// AppShell — Sprint 6A Layout
// Server component: fetches user profile then renders Sidebar + content area.
// =============================================================================
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './Sidebar'
import { GlobalIntelligenceBar } from './GlobalIntelligenceBar'
import { colors } from '@/components/ui/tokens'

interface AppShellProps {
  children: React.ReactNode
}

export async function AppShell({ children }: AppShellProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userName: string | undefined
  let role: string | undefined

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    userName = profile?.full_name ?? undefined
    role     = profile?.role ?? undefined
  }

  return (
    <div
      className="app-shell"
      style={{ background: colors.bgBase }}
    >
      <Sidebar
        userEmail={user?.email}
        userName={userName}
        role={role}
      />
      <div className="app-main">
        <GlobalIntelligenceBar />
        <div className="app-content">
          {children}
        </div>
      </div>
    </div>
  )
}

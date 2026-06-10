import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/config/constants'
import { AppShell } from '@/components/layout/AppShell'

// Auth guard for all (app) routes + persistent AppShell layout
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  return <AppShell>{children}</AppShell>
}

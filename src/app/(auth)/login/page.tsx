import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/config/constants'
import LoginForm from './LoginForm'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to Command Hub if already logged in
  if (user) {
    redirect(ROUTES.COMMAND_HUB)
  }

  const { error } = await searchParams

  return <LoginForm error={error} />
}

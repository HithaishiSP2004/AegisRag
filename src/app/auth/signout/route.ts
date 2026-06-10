import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROUTES } from '@/config/constants'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Clear any potential session cookies or client-side caching by doing a redirect to the login page
  const response = NextResponse.redirect(new URL(ROUTES.LOGIN, request.url), {
    status: 302,
  })

  return response
}

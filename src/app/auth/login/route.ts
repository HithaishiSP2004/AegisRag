import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROUTES } from '@/config/constants'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(
      new URL(`${ROUTES.LOGIN}?error=Invalid credentials`, request.url),
      { status: 302 }
    )
  }

  return NextResponse.redirect(new URL(ROUTES.COMMAND_HUB, request.url), { status: 302 })
}

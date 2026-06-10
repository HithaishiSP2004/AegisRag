import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROUTES } from '@/config/constants'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string
  const orgName = formData.get('orgName') as string

  const supabase = await createClient()

  // Sign up using Supabase auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        org_name: orgName,
      },
      emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(error.message)}`, request.url),
      { status: 302 }
    )
  }

  // If email confirmation is required, redirect to verify-email
  if (data.user && !data.session) {
    return NextResponse.redirect(new URL('/verify-email', request.url), { status: 302 })
  }

  return NextResponse.redirect(new URL(ROUTES.COMMAND_HUB, request.url), { status: 302 })
}

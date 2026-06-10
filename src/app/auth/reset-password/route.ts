import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ROUTES } from '@/config/constants'

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = formData.get('password') as string

  const supabase = await createClient()

  // Update password in Supabase Auth
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return NextResponse.redirect(
      new URL(`/reset-password?error=${encodeURIComponent(error.message)}`, request.url),
      { status: 302 }
    )
  }

  // Redirect to reset password page with success status
  return NextResponse.redirect(
    new URL('/reset-password?success=true', request.url),
    { status: 302 }
  )
}

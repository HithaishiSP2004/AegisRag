import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendEmail, getPasswordResetEmailTemplate } from '@/lib/email'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const origin = new URL(request.url).origin

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    const supabaseAdmin = createAdminClient()
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      }
    })

    if (error) {
      console.error('[PASSWORD RESET DEV ERROR] generateLink failed:', error)
      return NextResponse.redirect(
        new URL(`/forgot-password?error=${encodeURIComponent(error.message)}`, request.url),
        { status: 302 }
      )
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      return NextResponse.redirect(
        new URL(`/forgot-password?error=${encodeURIComponent('Failed to generate reset link.')}`, request.url),
        { status: 302 }
      )
    }

    const emailSent = await sendEmail({
      to: email,
      subject: 'AegisRAG Password Recovery Request',
      html: getPasswordResetEmailTemplate(actionLink)
    })

    if (!emailSent) {
      return NextResponse.redirect(
        new URL(`/forgot-password?error=${encodeURIComponent('Failed to send recovery email.')}`, request.url),
        { status: 302 }
      )
    }

    return NextResponse.redirect(
      new URL(`/forgot-password?sent=true&email=${encodeURIComponent(email)}`, request.url),
      { status: 302 }
    )
  }

  // Production: standard Supabase resetPasswordForEmail flow (no redirect)
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return NextResponse.redirect(
      new URL(`/forgot-password?error=${encodeURIComponent(error.message)}`, request.url),
      { status: 302 }
    )
  }

  return NextResponse.redirect(
    new URL(`/forgot-password?sent=true&email=${encodeURIComponent(email)}`, request.url),
    { status: 302 }
  )
}

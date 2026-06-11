import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getOtpEmailTemplate } from '@/lib/email'
import { createHash } from 'crypto'

// C1 FIX: In-memory otpStore replaced with persistent Supabase table (otp_requests).
// C2 FIX: Plaintext OTP is never logged.

const RESTRICTED_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'proton.me',
  'protonmail.com',
  'mailinator.com',
  'yopmail.com',
  'dispostable.com',
  'guerrillamail.com',
  'tempmail.com',
]

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const domain = email.split('@')[1].toLowerCase()
    if (RESTRICTED_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: 'Please use your organization or institution email address.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    const now = new Date()

    // ── Rate-limit check ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabaseAdmin as any)
      .from('otp_requests')
      .select('request_history')
      .eq('email', email)
      .single()

    if (existing?.request_history) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      const recentRequests = (existing.request_history as string[]).filter(
        (t: string) => t > oneHourAgo
      )

      if (recentRequests.length >= 5) {
        return NextResponse.json(
          { error: 'Maximum 5 OTP requests per hour. Please try again later.' },
          { status: 429 }
        )
      }

      const lastRequest = existing.request_history[existing.request_history.length - 1] as string
      if (lastRequest && now.getTime() - new Date(lastRequest).getTime() < 60_000) {
        return NextResponse.json(
          { error: 'Please wait 60 seconds before requesting another code.' },
          { status: 429 }
        )
      }
    }

    // ── Generate 6-digit OTP ──────────────────────────────────────────────────
    // C2 FIX: OTP is hashed immediately — plaintext never written to any log.
    const otp = Math.floor(100_000 + Math.random() * 900_000).toString()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString()

    // Upsert: create or replace the OTP record for this email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (supabaseAdmin as any)
      .from('otp_requests')
      .upsert(
        {
          email,
          otp_hash: hashOtp(otp),
          expires_at: expiresAt,
          attempts: 0,
          request_history: existing?.request_history
            ? [...(existing.request_history as string[]), now.toISOString()].slice(-10)
            : [now.toISOString()],
          updated_at: now.toISOString(),
        },
        { onConflict: 'email' }
      )

    if (upsertErr) {
      console.error('[request-otp] DB upsert error:', upsertErr.message)
      return NextResponse.json({ error: 'Failed to store verification code. Please try again.' }, { status: 500 })
    }

    // ── Dispatch email (fire-and-forget) ──────────────────────────────────────
    sendEmail({
      to: email,
      subject: 'AegisRAG Verification Code',
      html: getOtpEmailTemplate(otp)
    }).catch(err => {
      console.error('[EMAIL SEND FAILURE]', err)
    })

    // ── Audit log ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgs } = await (supabaseAdmin as any)
      .from('organizations')
      .select('id, name, settings, domain')

    const existingOrg = orgs?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => o.settings?.domain === domain || o.domain === domain
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from('audit_events').insert({
      org_id: (existingOrg as any)?.id || undefined,
      event_type: 'OTP_REQUESTED',
      actor: email,
      description: `OTP generated for onboarding email ${email} (${existingOrg ? 'Existing Workspace: ' + (existingOrg as any).name : 'New Workspace'})`,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully.'
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error.'
    console.error('Request OTP Error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

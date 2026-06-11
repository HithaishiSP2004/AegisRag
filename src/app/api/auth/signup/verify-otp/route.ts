import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// C1 FIX: Reads OTP records from Supabase otp_requests table, not in-memory Map.

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json()
    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and verification code are required.' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // ── Load OTP record ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stored, error: fetchErr } = await (supabaseAdmin as any)
      .from('otp_requests')
      .select('otp_hash, expires_at, attempts')
      .eq('email', email)
      .single()

    if (fetchErr || !stored) {
      return NextResponse.json({ error: 'No verification code request found.' }, { status: 400 })
    }

    const now = Date.now()

    // ── Check expiry ──────────────────────────────────────────────────────────
    if (now > new Date(stored.expires_at).getTime()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from('otp_requests').delete().eq('email', email)
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
    }

    // ── Check attempts limit ──────────────────────────────────────────────────
    if (stored.attempts >= 5) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from('otp_requests').delete().eq('email', email)
      return NextResponse.json({ error: 'Maximum attempts exceeded. Please request a new code.' }, { status: 400 })
    }

    // ── Verify hash match ─────────────────────────────────────────────────────
    const suppliedHash = hashOtp(otp.trim())
    if (suppliedHash !== stored.otp_hash) {
      const remaining = 4 - stored.attempts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('otp_requests')
        .update({ attempts: stored.attempts + 1 })
        .eq('email', email)
      return NextResponse.json(
        { error: `Invalid verification code. ${remaining} attempts remaining.` },
        { status: 400 }
      )
    }

    // ── Success: delete OTP record ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from('otp_requests').delete().eq('email', email)

    // ── Lookup organization domain ────────────────────────────────────────────
    const domain = email.split('@')[1].toLowerCase()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgs, error: dbError } = await (supabaseAdmin as any)
      .from('organizations')
      .select('id, name, settings, domain')

    if (dbError) {
      console.error('Database organization lookup error:', dbError)
      return NextResponse.json({ error: 'Workspace validation failed. Database query error.' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchingOrg = orgs?.find((o: any) => o.settings?.domain === domain || o.domain === domain)

    // ── Audit log ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from('audit_events').insert({
      org_id: (matchingOrg as any)?.id || undefined,
      event_type: 'OTP_VERIFIED',
      actor: email,
      description: `OTP successfully verified for ${email}. Organization exists: ${!!matchingOrg}`,
    })

    if (matchingOrg) {
      return NextResponse.json({
        success: true,
        workspaceExists: true,
        orgId: (matchingOrg as any).id,
        orgName: (matchingOrg as any).name,
        domain,
      })
    } else {
      return NextResponse.json({
        success: true,
        workspaceExists: false,
        domain,
      })
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error.'
    console.error('Verify OTP Error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

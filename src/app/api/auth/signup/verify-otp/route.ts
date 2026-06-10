import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const globalAny = global as any
globalAny.otpStore = globalAny.otpStore || new Map()
const otpStore = globalAny.otpStore

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json()
    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and verification code are required.' }, { status: 400 })
    }

    const stored = otpStore.get(email)
    if (!stored || !stored.otp) {
      return NextResponse.json({ error: 'No verification code request found.' }, { status: 400 })
    }

    // Check expiry
    const now = Date.now()
    if (now > stored.expiresAt) {
      otpStore.delete(email)
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 })
    }

    // Check attempts limit
    if (stored.attempts >= 5) {
      otpStore.delete(email)
      return NextResponse.json({ error: 'Maximum attempts exceeded. Please request a new code.' }, { status: 400 })
    }

    // Check code match
    if (stored.otp !== otp.trim()) {
      stored.attempts += 1
      return NextResponse.json(
        { error: `Invalid verification code. ${5 - stored.attempts} attempts remaining.` },
        { status: 400 }
      )
    }

    // Success! Clear OTP record
    otpStore.delete(email)

    // Lookup organization domain
    const domain = email.split('@')[1].toLowerCase()
    const supabaseAdmin = createAdminClient()
    
    // Fetch all organizations to find matching domain
    const { data: orgs, error: dbError } = await supabaseAdmin
      .from('organizations' as any)
      .select('*')

    if (dbError) {
      console.error('Database organization lookup error:', dbError)
      return NextResponse.json({ error: 'Workspace validation failed. Database query error.' }, { status: 500 })
    }

    const matchingOrg = orgs?.find((o: any) => o.settings?.domain === domain || o.domain === domain)

    // Log the OTP verification event
    await supabaseAdmin.from('audit_events' as any).insert({
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

  } catch (error: any) {
    console.error('Verify OTP Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}

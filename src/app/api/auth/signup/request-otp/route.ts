import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getOtpEmailTemplate } from '@/lib/email'

// In-memory OTP store (works perfectly in Next.js local dev environment)
const globalAny = global as any
globalAny.otpStore = globalAny.otpStore || new Map()
const otpStore = globalAny.otpStore

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

    // Rate Limit Checks (max 5 requests per hour)
    const now = Date.now()
    const stored = otpStore.get(email)
    
    if (stored) {
      // Check hourly window
      const oneHourAgo = now - 60 * 60 * 1000
      const recentRequests = stored.requestHistory.filter((t: number) => t > oneHourAgo)
      
      if (recentRequests.length >= 5) {
        return NextResponse.json(
          { error: 'Maximum 5 OTP requests per hour. Please try again later.' },
          { status: 429 }
        )
      }
      
      // Enforce 60s resend delay
      const lastRequest = stored.requestHistory[stored.requestHistory.length - 1]
      if (now - lastRequest < 60000) {
        return NextResponse.json(
          { error: 'Please wait 60 seconds before requesting another code.' },
          { status: 429 }
        )
      }
      
      stored.requestHistory = [...recentRequests, now]
    } else {
      otpStore.set(email, {
        otp: '',
        expiresAt: 0,
        attempts: 0,
        requestHistory: [now],
      })
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = now + 10 * 60 * 1000 // 10 minutes expiry

    const currentRecord = otpStore.get(email)
    currentRecord.otp = otp
    currentRecord.expiresAt = expiresAt
    currentRecord.attempts = 0

    // Log the generated OTP for local testing/demonstration
    console.log(`[AUTH OTP DEBUG] OTP for ${email} is ${otp} (expires in 10m)`)

    // Dispatch real email via Resend (async, non-blocking to prevent UI delay)
    sendEmail({
      to: email,
      subject: 'AegisRAG Verification Code',
      html: getOtpEmailTemplate(otp)
    }).catch(err => {
      console.error('[EMAIL SEND FAILURE]', err)
    })

    // Write audit log entry via Admin Client
    const supabaseAdmin = createAdminClient()
    
    // Check if workspace exists
    const { data: orgs } = await supabaseAdmin
      .from('organizations' as any)
      .select('*')

    const existingOrg = orgs?.find(
      (o: any) => o.settings?.domain === domain || o.domain === domain
    )

    // Log the OTP request audit event
    await supabaseAdmin.from('audit_events' as any).insert({
      org_id: (existingOrg as any)?.id || undefined,
      event_type: 'OTP_REQUESTED',
      actor: email,
      description: `OTP generated for onboarding email ${email} (${existingOrg ? 'Existing Workspace: ' + (existingOrg as any).name : 'New Workspace'})`,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully.'
    })

  } catch (error: any) {
    console.error('Request OTP Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}

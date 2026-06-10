import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getAccessRequestEmailTemplate } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email, orgId } = await request.json()

    if (!email || !orgId) {
      return NextResponse.json({ error: 'Email and Workspace selection are required.' }, { status: 400 })
    }

    const domain = email.split('@')[1].toLowerCase()
    const supabaseAdmin = createAdminClient()

    // 1. Fetch the selected organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations' as any)
      .select('*')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Selected workspace not found.' }, { status: 404 })
    }

    const orgData = org as any
    const orgDomain = (orgData.domain || orgData.settings?.domain || '').toLowerCase()
    if (orgDomain !== domain) {
      return NextResponse.json({ error: 'Your email domain does not match this workspace.' }, { status: 400 })
    }

    // 2. Insert Access Request (with schema fallback)
    let isNewRequest = true
    try {
      const { error: insertError } = await supabaseAdmin
        .from('access_requests' as any)
        .insert({
          organization_id: orgId,
          email: email,
          status: 'pending'
        })
      
      if (insertError) {
        if (insertError.code === '23505') {
          // Unique key violation
          isNewRequest = false
        } else {
          throw insertError
        }
      }
    } catch (dbErr: any) {
      console.log('Falling back to settings JSON for access request...', dbErr.message)
      // Fallback: store inside organizations.settings.access_requests JSON array
      const settings = orgData.settings || {}
      const requests = settings.access_requests || []
      
      const exists = requests.some((r: any) => r.email.toLowerCase() === email.toLowerCase())
      if (!exists) {
        requests.push({
          id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          email: email,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        settings.access_requests = requests
        
        const { error: updateError } = await supabaseAdmin
          .from('organizations' as any)
          .update({ settings })
          .eq('id', orgId)
        
        if (updateError) {
          console.error('Settings fallback update failed:', updateError)
          return NextResponse.json({ error: 'Failed to record access request.' }, { status: 500 })
        }
      } else {
        isNewRequest = false
      }
    }

    // 3. Record Audit Trail & Notify Administrators
    if (isNewRequest) {
      try {
        const { data: adminProfiles } = (await supabaseAdmin
          .from('user_profiles' as any)
          .select('id')
          .eq('org_id', orgId)
          .in('role', ['super_admin', 'compliance_officer'])) as any

        const adminEmails: string[] = []
        if (adminProfiles && adminProfiles.length > 0) {
          for (const p of adminProfiles) {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id)
            if (u?.user?.email) {
              adminEmails.push(u.user.email)
            }
          }
        }

        // If admins are found, dispatch email notifications
        if (adminEmails.length > 0) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aegisrag.com'
          const approvalLink = `${appUrl}/command-hub`
          
          sendEmail({
            to: adminEmails,
            subject: 'Action Required: AegisRAG Workspace Access Request',
            html: getAccessRequestEmailTemplate(email, orgData.name, approvalLink)
          }).catch(err => {
            console.error('[ACCESS REQUEST EMAIL FAILED]', err)
          })
        }

        // Insert to audit_events
        await supabaseAdmin.from('audit_events' as any).insert({
          org_id: orgId,
          event_type: 'ACCESS_REQUEST',
          actor: email,
          description: `Access request submitted by ${email} to join workspace ${orgData.name}.`
        })

        // Insert to audit_logs (compliance trail)
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
        const ua = request.headers.get('user-agent') || 'Unknown Agent'
        
        await supabaseAdmin.rpc('log_audit_event', {
          p_org_id: orgId,
          p_user_id: null,
          p_action: 'user.access_request',
          p_resource_type: 'organization',
          p_resource_id: orgId,
          p_old_value: null,
          p_new_value: { email, status: 'pending', orgName: orgData.name },
          p_ip_address: ip,
          p_user_agent: ua
        })
      } catch (auditErr) {
        console.error('Audit logging for access request failed (non-blocking):', auditErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Access request submitted successfully. Please wait for an administrator to approve your request.'
    })

  } catch (error: any) {
    console.error('Request Access Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}

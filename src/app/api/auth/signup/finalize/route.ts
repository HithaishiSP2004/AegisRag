import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendEmail, getWorkspaceCreatedEmailTemplate } from '@/lib/email'

import { FEATURES } from '@/config/features'

export async function POST(request: Request) {
  try {
    const {
      email,
      fullName,
      orgName,
      password,
      jobRole,
      industry = 'Technology',
      compliance = 'SOC2',
      llm = 'gemini-2.5-pro',
      region = 'us-east-1'
    } = await request.json()

    const effectiveOrgName = orgName || `${fullName}'s Workspace`

    if (!email || !fullName || !password || (FEATURES.ENTERPRISE_MODE && !orgName)) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    const domain = email.split('@')[1].toLowerCase()
    // Generate clean slug
    let slug = effectiveOrgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    if (!slug) {
      slug = 'org-' + Math.floor(Math.random() * 10000)
    }

    const supabaseAdmin = createAdminClient()

    // 1. Verify that no workspace already exists for this domain (only in ENTERPRISE_MODE)
    const { data: orgs, error: listError } = await supabaseAdmin
      .from('organizations' as any)
      .select('*')

    if (listError) {
      console.error('List organizations error:', listError)
      return NextResponse.json({ error: 'Failed to inspect existing workspaces.' }, { status: 500 })
    }

    if (FEATURES.ENTERPRISE_MODE) {
      const domainExists = orgs?.some(
        (o: any) => o.settings?.domain === domain || o.domain === domain
      )

      if (domainExists) {
        return NextResponse.json(
          { error: `A workspace for the domain ${domain} already exists.` },
          { status: 400 }
        )
      }
    }

    // Ensure slug uniqueness
    let finalSlug = slug
    let isSlugTaken = orgs?.some((o: any) => o.slug === finalSlug)
    let counter = 1
    while (isSlugTaken) {
      finalSlug = `${slug}-${counter}`
      isSlugTaken = orgs?.some((o: any) => o.slug === finalSlug)
      counter++
    }

    // 2. Create the user in Supabase auth (pre-confirmed)
    const { data: userData, error: userCreateError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    })

    if (userCreateError || !userData.user) {
      console.error('Auth User creation error:', userCreateError)
      return NextResponse.json(
        { error: userCreateError?.message || 'Failed to create system user account.' },
        { status: 400 }
      )
    }

    const user = userData.user

    // 3. Create the Organization (with graceful DB schema column fallback)
    let orgId = ''
    const orgPlan = FEATURES.ENTERPRISE_MODE ? 'enterprise' : 'free'
    try {
      const insertPayload: any = {
        name: effectiveOrgName,
        slug: finalSlug,
        plan: orgPlan,
        settings: {
          owner_id: user.id,
          industry,
          compliance_framework: compliance,
          llm_engine: llm,
          region
        }
      }
      if (FEATURES.ENTERPRISE_MODE) {
        insertPayload.domain = domain
        insertPayload.settings.domain = domain
      }

      const { data: newOrg, error: orgError } = await supabaseAdmin
        .from('organizations' as any)
        .insert(insertPayload)
        .select('id')
        .single()

      if (orgError) throw orgError
      orgId = (newOrg as any).id
    } catch (dbErr: any) {
      console.log('Falling back to settings-only organization insert...', dbErr.message)
      const fallbackPayload: any = {
        name: effectiveOrgName,
        slug: finalSlug,
        plan: orgPlan,
        settings: {
          owner_id: user.id,
          industry,
          compliance_framework: compliance,
          llm_engine: llm,
          region
        }
      }
      if (FEATURES.ENTERPRISE_MODE) {
        fallbackPayload.settings.domain = domain
      }

      const { data: fallbackOrg, error: fallbackError } = await supabaseAdmin
        .from('organizations' as any)
        .insert(fallbackPayload)
        .select('id')
        .single()

      if (fallbackError) {
        console.error('Organization creation failed:', fallbackError)
        return NextResponse.json({ error: 'Failed to provision organization workspace.' }, { status: 500 })
      }
      orgId = (fallbackOrg as any).id
    }

    // 4. Create the User Profile
    const { error: profileError } = await supabaseAdmin.from('user_profiles' as any).insert({
      id: user.id,
      org_id: orgId,
      full_name: fullName,
      role: FEATURES.ENTERPRISE_MODE ? 'super_admin' : 'trial_user',
      department: FEATURES.ENTERPRISE_MODE ? 'Security & Operations' : (jobRole || 'Trial User'),
      is_active: true
    })

    if (profileError) {
      console.error('User profile creation error:', profileError)
      return NextResponse.json({ error: 'Failed to create user profile.' }, { status: 500 })
    }

    // 5. Seed default roles for the new organization
    // Roles: super_admin, compliance_officer, security_analyst, auditor, executive
    const defaultRoles: { name: string; desc: string }[] = [
      { name: 'super_admin', desc: 'Root administrator with full control.' },
      { name: 'compliance_officer', desc: 'Compliance officer with regulatory and policy settings control.' },
      { name: 'security_analyst', desc: 'Security analyst with read/write access to threat monitoring.' },
      { name: 'auditor', desc: 'Auditor with read-only compliance history access.' },
      { name: 'executive', desc: 'Executive dashboard read-only visibility.' }
    ]

    for (const r of defaultRoles) {
      try {
        const { data: createdRole } = await supabaseAdmin
          .from('roles' as any)
          .insert({
            org_id: orgId,
            name: r.name,
            description: r.desc
          })
          .select('id')
          .single()

        // Link user to super_admin role if in enterprise mode, else if we want to seed but not link
        if (FEATURES.ENTERPRISE_MODE && r.name === 'super_admin' && createdRole) {
          await supabaseAdmin.from('user_roles' as any).insert({
            user_id: user.id,
            role_id: (createdRole as any).id
          })
        }
      } catch (roleErr) {
        console.error(`Failed to insert role ${r.name}:`, roleErr)
      }
    }

    // 6. Record Audit Logs (audit_events & audit_logs)
    try {
      // Insert to audit_events
      await supabaseAdmin.from('audit_events' as any).insert({
        org_id: orgId,
        event_type: 'USER_SIGNUP',
        actor: email,
        description: FEATURES.ENTERPRISE_MODE
          ? `Administrator ${fullName} signed up and established organization workspace: ${effectiveOrgName} (${domain}).`
          : `Public user ${fullName} signed up and established trial workspace: ${effectiveOrgName}.`
      })

      // Insert to audit_logs (compliance trail)
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
      const ua = request.headers.get('user-agent') || 'Unknown Agent'
      
      await supabaseAdmin.rpc('log_audit_event', {
        p_org_id: orgId,
        p_user_id: user.id,
        p_action: 'user.signup',
        p_resource_type: 'user',
        p_resource_id: user.id,
        p_old_value: null,
        p_new_value: { email, fullName, role: FEATURES.ENTERPRISE_MODE ? 'super_admin' : 'trial_user' },
        p_ip_address: ip,
        p_user_agent: ua
      })

      await supabaseAdmin.rpc('log_audit_event', {
        p_org_id: orgId,
        p_user_id: user.id,
        p_action: 'workspace.create',
        p_resource_type: 'organization',
        p_resource_id: orgId,
        p_old_value: null,
        p_new_value: { orgName: effectiveOrgName, domain: FEATURES.ENTERPRISE_MODE ? domain : null, slug: finalSlug },
        p_ip_address: ip,
        p_user_agent: ua
      })

    } catch (auditErr) {
      console.error('Audit logging failed (non-blocking):', auditErr)
    }

    // Send workspace welcome email
    if (FEATURES.ENTERPRISE_MODE) {
      sendEmail({
        to: email,
        subject: 'Welcome to AegisRAG - Workspace Ready',
        html: getWorkspaceCreatedEmailTemplate(fullName, effectiveOrgName, domain)
      }).catch(err => {
        console.error('[WELCOME EMAIL SEND FAILURE]', err)
      })
    } else {
      sendEmail({
        to: email,
        subject: 'Welcome to AegisRAG - Trial Account Ready',
        html: `<p>Hi ${fullName},</p><p>Welcome to AegisRAG! Your trial workspace <strong>${effectiveOrgName}</strong> has been successfully created. You can now access your dashboard and try out the document uploads and query capabilities.</p>`
      }).catch(err => {
        console.error('[WELCOME EMAIL SEND FAILURE]', err)
      })
    }

    // 7. Establish cookie session on standard client for immediate redirection
    const supabaseClient = await createClient()
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) {
      console.error('Session establishment error:', signInError)
      return NextResponse.json({
        success: true,
        message: 'Account created. Please login manually.',
        redirectUrl: '/login'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Workspace created and authenticated successfully.',
      redirectUrl: '/dashboard'
    })

  } catch (error: any) {
    console.error('Finalize Signup Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 })
  }
}

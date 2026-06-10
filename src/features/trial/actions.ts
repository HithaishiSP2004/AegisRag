'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/features/documents/audit'
import { sendEmail, getUpgradeRequestSubmittedEmailTemplate, getUpgradeRequestAdminEmailTemplate } from '@/lib/email'

export interface UpgradeRequestInput {
  targetTier: 'academic_user' | 'approved_user';
  justification: string;
}

export async function requestTierUpgrade(input: UpgradeRequestInput): Promise<{ success: boolean; error?: string }> {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 2. Validate Profile
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('org_id, role, is_active, full_name')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return { success: false, error: 'User profile not found' }
  }

  if (!profile.is_active) {
    return { success: false, error: 'Your account is currently inactive.' }
  }

  // 3. Validate target tier
  if (!['academic_user', 'approved_user'].includes(input.targetTier)) {
    return { success: false, error: 'Invalid target tier requested.' }
  }

  // 4. Validate justification
  const justification = input.justification.trim()
  if (!justification) {
    return { success: false, error: 'Justification is required.' }
  }

  if (justification.length > 500) {
    return { success: false, error: 'Justification must be 500 characters or less.' }
  }

  const adminClient = createAdminClient()

  // 5. Check for existing pending request
  try {
    const { data: existing, error: checkErr } = await (adminClient as any)
      .from('tier_upgrade_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (checkErr) {
      console.warn('[trial/actions] Error checking existing requests:', checkErr)
    }

    if (existing) {
      return { success: false, error: 'You already have a pending upgrade request. Please wait for an administrator to review it.' }
    }
  } catch (err) {
    console.warn('[trial/actions] Graceful check failed:', err)
  }

  // 6. Insert upgrade request
  try {
    const { error: insertErr } = await (adminClient as any)
      .from('tier_upgrade_requests')
      .insert({
        user_id: user.id,
        target_tier: input.targetTier,
        justification: justification,
        status: 'pending'
      })

    if (insertErr) {
      console.error('[trial/actions] Failed to insert upgrade request:', insertErr)
      return { success: false, error: 'Failed to submit request. Please try again later.' }
    }
  } catch (err) {
    console.error('[trial/actions] Exception inserting upgrade request:', err)
    return { success: false, error: 'Failed to submit request due to database schema updates. Please try again later.' }
  }

  // 7. Log audit event
  try {
    await logAuditEvent({
      orgId: profile.org_id,
      userId: user.id,
      action: 'trial.upgrade_requested',
      resourceType: 'tier_upgrade_request',
      newValue: { target_tier: input.targetTier },
    })
  } catch (auditErr) {
    console.warn('[trial/actions] Failed to write audit event:', auditErr)
  }

  // 8. Send Email Notifications
  try {
    const targetTierLabel = input.targetTier === 'academic_user' ? 'Academic Scholar' : 'Approved Practitioner'

    // Dispatch confirmation email to requesting user
    sendEmail({
      to: user.email!,
      subject: 'AegisRAG Upgrade Request Received',
      html: getUpgradeRequestSubmittedEmailTemplate(
        profile.full_name || 'User',
        targetTierLabel,
        justification
      )
    }).catch(err => {
      console.error('[trial/actions] Failed to send user upgrade email:', err)
    })

    // Fetch the organization name
    const { data: org } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', profile.org_id)
      .single()

    // Resolve administrator emails
    const { data: adminProfiles } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('org_id', profile.org_id)
      .in('role', ['super_admin', 'compliance_officer'])

    const adminEmails: string[] = []
    if (adminProfiles && adminProfiles.length > 0) {
      for (const p of adminProfiles) {
        const { data: u } = await adminClient.auth.admin.getUserById(p.id)
        if (u?.user?.email) {
          adminEmails.push(u.user.email)
        }
      }
    }

    if (adminEmails.length === 0) {
      // Fallback: search system-wide super_admins
      const { data: globalAdmins } = await adminClient
        .from('user_profiles')
        .select('id')
        .eq('role', 'super_admin')
      
      if (globalAdmins && globalAdmins.length > 0) {
        for (const p of globalAdmins) {
          const { data: u } = await adminClient.auth.admin.getUserById(p.id)
          if (u?.user?.email) {
            adminEmails.push(u.user.email)
          }
        }
      }
    }

    if (adminEmails.length === 0) {
      adminEmails.push('admin@aegisrag.com')
    }

    // Dispatch notification email to administrators
    sendEmail({
      to: adminEmails,
      subject: 'Action Required: AegisRAG Workspace Tier Upgrade Request',
      html: getUpgradeRequestAdminEmailTemplate(
        user.email!,
        profile.full_name || 'User',
        targetTierLabel,
        justification,
        org?.name || 'Workspace'
      )
    }).catch(err => {
      console.error('[trial/actions] Failed to send admin upgrade notification email:', err)
    })
  } catch (emailErr) {
    console.warn('[trial/actions] Error in upgrade email workflow:', emailErr)
  }

  return { success: true }
}

import { getUserUsage } from './limits.server'
import { getLimitsForRole } from './limits'
import type { UserUsage, TierLimits } from './limits'

export async function fetchUserUsage(): Promise<{
  success: boolean
  usage?: UserUsage
  limits?: TierLimits
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, error: 'Profile not found' }
  }

  const usage = await getUserUsage(user.id)
  const limits = getLimitsForRole(profile.role)

  return {
    success: true,
    usage,
    limits,
  }
}

export async function fetchUpgradeRequestStatus(): Promise<{
  success: boolean
  status?: 'pending' | 'approved' | 'rejected' | null
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const adminClient = createAdminClient()
    const { data, error } = await (adminClient as any)
      .from('tier_upgrade_requests')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('[trial/actions] Error fetching upgrade request status:', error)
      return { success: false, error: 'Failed to fetch upgrade request status' }
    }

    return {
      success: true,
      status: data ? (data.status as any) : null
    }
  } catch (err) {
    console.warn('[trial/actions] Failed to fetch upgrade request status:', err)
    return { success: false, error: 'Failed to query database' }
  }
}


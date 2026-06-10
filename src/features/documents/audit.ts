// =============================================================================
// Sprint 1: Audit Logging Service
// Wraps the log_audit_event DB function.
// ALWAYS called server-side via service role — clients cannot forge log entries.
// =============================================================================
'use server'

import { createAdminClient } from '@/lib/supabase/server'

export type AuditAction =
  | 'document.upload_started'
  | 'document.upload_complete'
  | 'document.upload_failed'
  | 'document.delete'
  | 'document.soft_delete'
  | 'document.version_created'
  | 'document.status_changed'
  | 'document.parser_started'
  | 'document.parser_completed'
  | 'document.parser_failed'
  | 'trial.upgrade_requested'


/**
 * Append an immutable audit log entry.
 * Uses the log_audit_event() SECURITY DEFINER function which bypasses RLS.
 * The audit_logs table has UPDATE/DELETE rules blocking all modifications.
 */
export async function logAuditEvent(params: {
  orgId: string
  userId: string | null
  action: AuditAction
  resourceType: string
  resourceId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ logId: string | null; error: string | null }> {
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('log_audit_event', {
    p_org_id: params.orgId,
    p_user_id: params.userId,
    p_action: params.action,
    p_resource_type: params.resourceType,
    p_resource_id: params.resourceId ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_old_value: (params.oldValue ?? null) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p_new_value: (params.newValue ?? null) as any,
    p_ip_address: params.ipAddress ?? null,
    p_user_agent: params.userAgent ?? null,
  })

  if (error) {
    // Audit failures must never surface to the user or crash the pipeline.
    // Log to server console only — do not re-throw.
    console.error('[AuditLog] Failed to write audit event:', error.message, {
      action: params.action,
      orgId: params.orgId,
      userId: params.userId,
    })
    return { logId: null, error: error.message }
  }

  return { logId: data as string, error: null }
}

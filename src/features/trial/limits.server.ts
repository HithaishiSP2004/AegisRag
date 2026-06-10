import { createAdminClient } from '@/lib/supabase/server'
import { FEATURES } from '@/config/features'
import { isTierRestricted, getLimitsForRole } from './limits'
import type { UserUsage } from './limits'

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  let aiRequests = 0
  let documentUploads = 0

  try {
    const { data, error } = await (adminClient as any)
      .from('trial_usage_metrics')
      .select('ai_requests, document_uploads')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (!error && data) {
      aiRequests = (data as any).ai_requests || 0
      documentUploads = (data as any).document_uploads || 0
    }
  } catch (err) {
    console.warn('[trial/limits] Failed to query trial_usage_metrics:', err)
  }

  let storageBytes = 0
  let totalDocuments = 0
  try {
    const { data, error } = await adminClient
      .from('documents')
      .select('file_size_bytes')
      .eq('uploaded_by', userId)
      .not('status', 'eq', 'deleted')

    if (!error && data) {
      storageBytes = data.reduce((acc, doc) => acc + (doc.file_size_bytes || 0), 0)
      totalDocuments = data.length
    }
  } catch (err) {
    console.warn('[trial/limits] Failed to query documents for storage size:', err)
  }

  return {
    aiRequests,
    documentUploads,
    storageBytes,
    totalDocuments,
  }
}

export async function checkLimit(
  userId: string,
  role: string,
  action: 'ai_request' | 'document_upload' | 'storage_upload' | 'pdf_export',
  additionalBytes = 0
): Promise<{ allowed: boolean; reason?: string }> {
  if (!isTierRestricted(role)) {
    return { allowed: true }
  }

  const limits = getLimitsForRole(role)
  const usage = await getUserUsage(userId)

  if (action === 'ai_request') {
    if (usage.aiRequests >= limits.aiRequests) {
      return {
        allowed: false,
        reason: `Daily AI request limit of ${limits.aiRequests} reached. Please request a tier upgrade.`,
      }
    }
  }

  if (action === 'document_upload') {
    if (usage.totalDocuments !== undefined && usage.totalDocuments >= limits.documentUploads) {
      return {
        allowed: false,
        reason: `Maximum limit of ${limits.documentUploads} active documents reached. Please request a tier upgrade.`,
      }
    }
    if (usage.documentUploads >= limits.documentUploads) {
      return {
        allowed: false,
        reason: `Daily document upload limit of ${limits.documentUploads} reached. Please request a tier upgrade.`,
      }
    }
  }

  if (action === 'storage_upload') {
    const limitBytes = limits.storageMb * 1024 * 1024
    if (usage.storageBytes + additionalBytes > limitBytes) {
      return {
        allowed: false,
        reason: `Storage limit of ${limits.storageMb} MB exceeded. Please request a tier upgrade.`,
      }
    }
  }

  if (action === 'pdf_export') {
    if (!limits.pdfExportEnabled) {
      return {
        allowed: false,
        reason: 'PDF export is not available on your current tier. Please request a tier upgrade.',
      }
    }
  }

  return { allowed: true }
}

export async function incrementUsage(
  userId: string,
  metric: 'ai_requests' | 'document_uploads' | 'exports'
): Promise<void> {
  if (FEATURES.ENTERPRISE_MODE) {
    return
  }
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    const { data, error } = await (adminClient as any)
      .from('trial_usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (error) {
      console.warn('[trial/limits] Error checking metrics for increment:', error)
      return
    }

    if (data) {
      const updates: Record<string, number> = {}
      updates[metric] = ((data as any)[metric] || 0) + 1

      await (adminClient as any)
        .from('trial_usage_metrics')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (data as any).id)
    } else {
      const insertData: Record<string, any> = {
        user_id: userId,
        date: today,
        ai_requests: 0,
        document_uploads: 0,
        exports: 0,
      }
      insertData[metric] = 1

      await (adminClient as any)
        .from('trial_usage_metrics')
        .insert(insertData)
    }
  } catch (err) {
    console.warn('[trial/limits] Failed to increment usage metric:', err)
  }
}

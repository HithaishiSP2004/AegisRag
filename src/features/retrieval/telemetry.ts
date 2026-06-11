// =============================================================================
// Sprint 4C: AI Request Telemetry
//
// Writes to the ai_requests table (migration 0014, constraint fixed in 0023).
// Uses the admin client (service role) — bypasses RLS so the insert always
// succeeds regardless of the calling user's role.
//
// ALL calls are fire-and-forget: failures are logged but never re-thrown.
// Telemetry MUST NOT block or crash the primary request pipeline.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/server'

export interface AIRequestLog {
  org_id:            string
  user_id?:          string | null
  model_used:        string
  prompt_tokens?:    number
  completion_tokens?: number
  total_tokens?:     number
  latency_ms:        number
  fallback_level?:   number
  success:           boolean
  error_code?:       string | null
  error_message?:    string | null
  call_type:         'embedding' | 'completion' | 'rerank'
  // Phase 5
  prompt_template_used?: string | null
  prompt_version?:       string | null
  estimated_tokens?:     number
  tokens_saved?:         number
  reasoning_mode?:       string | null
  workflow_type?:        string | null
  confidence_score?:     number
}

/**
 * Write one AI API call record to ai_requests.
 * Never throws — safe to call without await if desired.
 */
export async function logAIRequest(log: AIRequestLog): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await (admin as any).from('ai_requests').insert({
      org_id:            log.org_id,
      user_id:           log.user_id ?? null,
      model_used:        log.model_used,
      prompt_tokens:     log.prompt_tokens     ?? 0,
      completion_tokens: log.completion_tokens ?? 0,
      total_tokens:      log.total_tokens      ?? 0,
      latency_ms:        log.latency_ms,
      fallback_level:    log.fallback_level    ?? 0,
      success:           log.success,
      error_code:        log.error_code        ?? null,
      error_message:     log.error_message     ?? null,
      call_type:         log.call_type,
      // Phase 5 columns
      prompt_template_used: log.prompt_template_used ?? null,
      prompt_version:    log.prompt_version    ?? null,
      estimated_tokens:  log.estimated_tokens  ?? 0,
      tokens_saved:      log.tokens_saved      ?? 0,
      reasoning_mode:    log.reasoning_mode    ?? null,
      workflow_type:     log.workflow_type     ?? null,
      confidence_score:  log.confidence_score  ?? 0.0
    })
    if (error) {
      console.error('[telemetry] ai_requests insert error:', error.message)
    } else {
      console.log(`[telemetry] logged ${log.call_type} call — model=${log.model_used} latency=${log.latency_ms}ms success=${log.success}`)
    }
  } catch (err) {
    console.error('[telemetry] logAIRequest threw (non-blocking):', err)
  }
}

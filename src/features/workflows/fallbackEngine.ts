import { GoogleGenAI } from '@google/genai'
import { createAdminClient } from '@/lib/supabase/server'

// Retry ceiling constraints
const MAX_RETRIES = 3

export interface FallbackOptions {
  orgId: string
  userId?: string
  promptText: string
  evidenceContext?: string
  evidenceCitations?: any[]
  workflowStage?: string
  workflowId?: string
}

export interface FallbackResult {
  text: string
  modelUsed: string
  fallbackLevel: number
  success: boolean
  errorCode?: string
  errorMessage?: string
  evidenceOnlyUsed: boolean
  cacheHit?: boolean
  cacheMiss?: boolean
}

/**
 * Executes a Gemini content generation call with multi-model failover and retry logic.
 */
export async function executeWithFallback(options: FallbackOptions): Promise<FallbackResult> {
  const { orgId, userId, promptText, evidenceContext = '', evidenceCitations = [], workflowStage = 'analyzing' } = options
  const start = Date.now()

  const primaryModel = process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.5-flash'
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash'

  if (!process.env.GEMINI_API_KEY) {
    return {
      text: getEvidenceOnlyResponse(evidenceContext, evidenceCitations),
      modelUsed: 'none',
      fallbackLevel: 2,
      success: false,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'GEMINI_API_KEY is not configured.',
      evidenceOnlyUsed: true,
      cacheHit: false,
      cacheMiss: true
    }
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  // callModelWithTimeout wraps generateContent in a Promise.race to handle Timeout failure
  async function callModelWithTimeout(model: string): Promise<string> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), 15000) // 15s timeout
    )

    const callPromise = (async () => {
      const res = await ai.models.generateContent({
        model,
        contents: promptText
      })
      return res.text ?? ''
    })()

    return Promise.race([callPromise, timeoutPromise])
  }

  // 1. Primary Model Execution
  let textResponse = ''
  let primarySuccess = false
  let primaryError = ''
  let primaryRetries = 0

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = Date.now()
    try {
      textResponse = await callModelWithTimeout(primaryModel)
      primarySuccess = true
      break
    } catch (err: any) {
      primaryRetries = attempt
      const errMsg = err?.message || String(err)
      primaryError = errMsg

      // Log retriable primary failure
      await logResilienceEvent({
        orgId,
        userId: userId || '00000000-0000-0000-0000-000000000000',
        fallbackType: 'primary_retry',
        failureReason: `Primary model ${primaryModel} failed on attempt ${attempt}: ${errMsg}`,
        recoveryAction: attempt < MAX_RETRIES ? 'retry' : 'fallback_to_secondary',
        retryCount: attempt,
        recoverySuccess: false,
        workflowStage,
        durationMs: Date.now() - attemptStart,
        cacheHit: false,
        cacheMiss: true
      })

      if (attempt < MAX_RETRIES) {
        const backoffDelay = 500 * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }
  }

  // If primary succeeded, log success telemetry and return
  if (primarySuccess) {
    const durationMs = Date.now() - start
    await logResilienceEvent({
      orgId,
      userId: userId || '00000000-0000-0000-0000-000000000000',
      fallbackType: 'none',
      failureReason: null,
      recoveryAction: 'none',
      retryCount: primaryRetries,
      recoverySuccess: true,
      workflowStage,
      durationMs,
      cacheHit: true,
      cacheMiss: false
    })

    return {
      text: textResponse,
      modelUsed: primaryModel,
      fallbackLevel: 0,
      success: true,
      evidenceOnlyUsed: false,
      cacheHit: true,
      cacheMiss: false
    }
  }

  // 2. Secondary/Fallback Model Execution
  let secondarySuccess = false
  let secondaryError = ''
  let secondaryRetries = 0

  // Log transition from primary to secondary model
  await logResilienceEvent({
    orgId,
    userId: userId || '00000000-0000-0000-0000-000000000000',
    fallbackType: 'primary_to_secondary',
    failureReason: primaryError,
    recoveryAction: 'model_switch',
    retryCount: 0,
    recoverySuccess: false,
    workflowStage,
    durationMs: Date.now() - start,
    cacheHit: false,
    cacheMiss: true
  })

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = Date.now()
    try {
      textResponse = await callModelWithTimeout(fallbackModel)
      secondarySuccess = true
      break
    } catch (err: any) {
      secondaryRetries = attempt
      const errMsg = err?.message || String(err)
      secondaryError = errMsg

      // Log retriable secondary failure
      await logResilienceEvent({
        orgId,
        userId: userId || '00000000-0000-0000-0000-000000000000',
        fallbackType: 'secondary_retry',
        failureReason: `Secondary model ${fallbackModel} failed on attempt ${attempt}: ${errMsg}`,
        recoveryAction: attempt < MAX_RETRIES ? 'retry' : 'fallback_to_evidence_only',
        retryCount: attempt,
        recoverySuccess: false,
        workflowStage,
        durationMs: Date.now() - attemptStart,
        cacheHit: false,
        cacheMiss: true
      })

      if (attempt < MAX_RETRIES) {
        const backoffDelay = 500 * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }
  }

  if (secondarySuccess) {
    const durationMs = Date.now() - start
    await logResilienceEvent({
      orgId,
      userId: userId || '00000000-0000-0000-0000-000000000000',
      fallbackType: 'primary_to_secondary',
      failureReason: primaryError,
      recoveryAction: 'model_switch_success',
      retryCount: secondaryRetries,
      recoverySuccess: true,
      workflowStage,
      durationMs,
      cacheHit: false,
      cacheMiss: true
    })

    return {
      text: textResponse,
      modelUsed: fallbackModel,
      fallbackLevel: 1,
      success: true,
      evidenceOnlyUsed: false,
      cacheHit: false,
      cacheMiss: true
    }
  }

  // 3. Final Fallback: Evidence-Only Response Mode
  const finalError = `Both primary (${primaryModel}) and fallback (${fallbackModel}) failed. Primary error: ${primaryError}. Fallback error: ${secondaryError}`
  const durationMs = Date.now() - start

  await logResilienceEvent({
    orgId,
    userId: userId || '00000000-0000-0000-0000-000000000000',
    fallbackType: 'secondary_to_evidence_only',
    failureReason: finalError,
    recoveryAction: 'evidence_only',
    retryCount: primaryRetries + secondaryRetries,
    recoverySuccess: true,
    workflowStage,
    durationMs,
    cacheHit: false,
    cacheMiss: true
  })

  return {
    text: getEvidenceOnlyResponse(evidenceContext, evidenceCitations),
    modelUsed: 'none',
    fallbackLevel: 2,
    success: false,
    errorCode: 'BOTH_MODELS_FAILED',
    errorMessage: finalError,
    evidenceOnlyUsed: true,
    cacheHit: false,
    cacheMiss: true
  }
}

/**
 * Returns a static JSON-parsed compatible string with the retrieved citations and summaries.
 */
function getEvidenceOnlyResponse(evidenceContext: string, evidenceCitations: any[]): string {
  const citations = evidenceCitations.map((c, i) => ({
    clause: c.content ? c.content.slice(0, 120) + '...' : 'evidence',
    policy_reference: c.framework || 'Compliance Policy',
    severity: 'medium',
    description: `Retrieved grounding evidence from ${c.source_doc} (page ${c.page_number}).`,
    recommendation: 'Verify the document clauses manually against retrieved evidence sources.',
    confidence_score: 0.5,
    evidence_chunk_ids: [c.chunk_id || '']
  }))

  const payload = {
    compliance_score: 50,
    risk_score: 25,
    confidence_score: 0,
    executive_summary: "AI generation is temporarily unavailable. Relevant evidence was retrieved successfully.",
    methodology: "Evidence-Only Response Mode fallback. No AI model generation was used.",
    violations: citations,
    recommendations: [
      {
        priority: 'high',
        action: 'Manual Verification Required',
        rationale: 'AI model generation is currently offline. Review the grounded evidence citations listed below.'
      }
    ],
    evidence_only: true
  }

  return JSON.stringify(payload)
}

/**
 * Helper to log resilience events to Supabase database.
 */
export async function logResilienceEvent(params: {
  orgId: string
  userId: string
  fallbackType: string
  failureReason: string | null
  recoveryAction: string
  retryCount: number
  recoverySuccess: boolean
  workflowStage: string | undefined
  durationMs: number
  cacheHit?: boolean
  cacheMiss?: boolean
}) {
  try {
    const admin = createAdminClient()
    const { error } = await (admin as any).from('resilience_telemetry').insert({
      org_id: params.orgId,
      user_id: params.userId,
      fallback_type: params.fallbackType,
      failure_reason: params.failureReason,
      recovery_action: params.recoveryAction,
      retry_count: params.retryCount,
      recovery_success: params.recoverySuccess,
      workflow_stage: params.workflowStage || null,
      duration_ms: params.durationMs,
      cache_hit: params.cacheHit ?? false,
      cache_miss: params.cacheMiss ?? false
    })
    if (error) {
      console.error('[ResilienceTelemetry] Database log error:', error.message)
    }
  } catch (err) {
    console.error('[ResilienceTelemetry] Telemetry logging threw:', err)
  }
}

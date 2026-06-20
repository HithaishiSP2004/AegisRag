import { GoogleGenAI } from '@google/genai'
import { createAdminClient } from '@/lib/supabase/server'
import { AI_MODELS_FALLBACK_CHAIN } from '@/config/ai'

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

const rateLimitedModels = new Map<string, number>()
const RATE_LIMIT_COOLDOWN_MS = 60000 // 1 minute cooldown

/**
 * Executes a Gemini content generation call with multi-model failover and retry logic.
 */
export async function executeWithFallback(options: FallbackOptions): Promise<FallbackResult> {
  const { orgId, userId, promptText, evidenceContext = '', evidenceCitations = [], workflowStage = 'analyzing' } = options
  const start = Date.now()

  if (!process.env.GEMINI_API_KEY) {
    return {
      text: getEvidenceOnlyResponse(evidenceContext, evidenceCitations),
      modelUsed: 'none',
      fallbackLevel: 4,
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

  const models = AI_MODELS_FALLBACK_CHAIN
  let textResponse = ''
  let success = false
  let lastError = ''
  let modelUsed = 'none'
  let fallbackLevel = 0
  let totalRetries = 0

  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i]

    // Skip model if it has recently hit a rate limit (429)
    const rateLimitTime = rateLimitedModels.get(currentModel)
    if (rateLimitTime && Date.now() - rateLimitTime < RATE_LIMIT_COOLDOWN_MS) {
      console.info(`[FallbackEngine] Skipping rate-limited model ${currentModel} during failover.`)
      continue
    }

    fallbackLevel = i
    modelUsed = currentModel
    let modelSuccess = false
    let modelError = ''
    let modelRetries = 0

    // If we've switched model (i.e. i > 0), log transition
    if (i > 0) {
      const transitionType = i === 1 ? 'primary_to_secondary' : `fallback_${i - 1}_to_fallback_${i}`
      await logResilienceEvent({
        orgId,
        userId: userId || '00000000-0000-0000-0000-000000000000',
        fallbackType: transitionType,
        failureReason: lastError,
        recoveryAction: 'model_switch',
        retryCount: 0,
        recoverySuccess: false,
        workflowStage,
        durationMs: Date.now() - start,
        cacheHit: false,
        cacheMiss: true
      })
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const attemptStart = Date.now()
      try {
        textResponse = await callModelWithTimeout(currentModel)
        modelSuccess = true
        modelRetries = attempt - 1
        break
      } catch (err: any) {
        modelRetries = attempt
        const errMsg = err?.message || String(err)
        modelError = errMsg

        const status = err?.status || err?.statusCode
        if (status === 429 || errMsg.includes('429') || errMsg.toUpperCase().includes('RESOURCE_EXHAUSTED')) {
          console.warn(`[FallbackEngine] Model ${currentModel} hit rate limit (429). Activating cooldown.`)
          rateLimitedModels.set(currentModel, Date.now())
        }

        const isLastAttemptOfThisModel = attempt === MAX_RETRIES
        const isLastModel = i === models.length - 1
        const actionType = !isLastAttemptOfThisModel ? 'retry' : (!isLastModel ? 'model_switch' : 'fallback_to_evidence_only')
        const logType = i === 0 ? 'primary_retry' : `fallback_${i}_retry`

        await logResilienceEvent({
          orgId,
          userId: userId || '00000000-0000-0000-0000-000000000000',
          fallbackType: logType,
          failureReason: `${currentModel} failed on attempt ${attempt}: ${errMsg}`,
          recoveryAction: actionType,
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

    totalRetries += modelRetries
    lastError = modelError

    if (modelSuccess) {
      success = true
      break
    }
  }

  // If succeeded, log success telemetry and return
  if (success) {
    const durationMs = Date.now() - start
    const isFallbackUsed = fallbackLevel > 0
    await logResilienceEvent({
      orgId,
      userId: userId || '00000000-0000-0000-0000-000000000000',
      fallbackType: isFallbackUsed ? 'primary_to_secondary' : 'none',
      failureReason: isFallbackUsed ? lastError : null,
      recoveryAction: isFallbackUsed ? 'model_switch_success' : 'none',
      retryCount: totalRetries,
      recoverySuccess: true,
      workflowStage,
      durationMs,
      cacheHit: !isFallbackUsed,
      cacheMiss: isFallbackUsed
    })

    return {
      text: textResponse,
      modelUsed,
      fallbackLevel,
      success: true,
      evidenceOnlyUsed: false,
      cacheHit: !isFallbackUsed,
      cacheMiss: isFallbackUsed
    }
  }

  // Final Fallback: Evidence-Only Response Mode
  const finalError = `All models in fallback chain failed. Last error: ${lastError}`
  const durationMs = Date.now() - start

  await logResilienceEvent({
    orgId,
    userId: userId || '00000000-0000-0000-0000-000000000000',
    fallbackType: 'secondary_to_evidence_only',
    failureReason: finalError,
    recoveryAction: 'evidence_only',
    retryCount: totalRetries,
    recoverySuccess: true,
    workflowStage,
    durationMs,
    cacheHit: false,
    cacheMiss: true
  })

  return {
    text: getEvidenceOnlyResponse(evidenceContext, evidenceCitations),
    modelUsed: 'none',
    fallbackLevel: models.length,
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

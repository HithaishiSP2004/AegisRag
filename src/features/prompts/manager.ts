// =============================================================================
// AegisRAG Prompt Manager & Token Optimizer (Phase 5)
// =============================================================================

import { GoogleGenAI } from '@google/genai'
import { AI_MODELS } from '@/config/ai'
import { logAIRequest } from '@/features/retrieval/telemetry'
import { getPromptTemplate, renderPrompt } from './registry'
import { createAdminClient } from '@/lib/supabase/server'

export type BudgetProfile = 'economy' | 'balanced' | 'accuracy'

export const BUDGET_LIMITS: Record<BudgetProfile, number> = {
  economy: 4000,     // 4k tokens (~16k characters)
  balanced: 8000,    // 8k tokens (~32k characters)
  accuracy: 16000    // 16k tokens (~64k characters)
}

export interface ContextChunk {
  chunkId: string
  content: string
  source_doc: string
  page_number: number
  framework?: string | null
}

export interface PromptManagerOptions {
  orgId: string
  userId?: string
  templateId: string
  version?: string
  variables: Record<string, any>
  chunks?: ContextChunk[]
  reasoningMode?: 'direct' | 'cot' | 'react'
  workflowType?: string
}

export interface ExecResult {
  text: string
  modelUsed: string
  fallbackLevel: number
  latencyMs: number
  tokensBefore: number
  tokensAfter: number
  tokensSaved: number
  estimatedTokens: number
  confidenceScore: number
}

/**
 * Strips consecutive whitespaces, duplicate newlines, and common header noise.
 */
export function compressText(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}

/**
 * Resolves the active budget profile for the organization from the DB.
 */
export async function getOrgBudgetProfile(orgId: string): Promise<BudgetProfile> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single()

    if (error || !data) return 'balanced'
    const settings = data.settings as any
    if (settings && typeof settings === 'object') {
      const p = settings.prompt_budget_profile
      if (p === 'economy' || p === 'balanced' || p === 'accuracy') {
        return p
      }
    }
  } catch (err) {
    console.error('[PromptManager] Error loading budget profile:', err)
  }
  return 'balanced'
}

/**
 * Optimizes the context: deduplicates, compresses text, and truncates to fit token budget.
 */
export function optimizeContext(
  chunks: ContextChunk[],
  tokenLimit: number
): { optimizedChunks: ContextChunk[]; tokensBefore: number; tokensAfter: number; tokensSaved: number } {
  // 1. Deduplicate by chunkId
  const uniqueChunksMap = new Map<string, ContextChunk>()
  chunks.forEach(c => {
    if (!uniqueChunksMap.has(c.chunkId)) {
      uniqueChunksMap.set(c.chunkId, c)
    }
  })
  const uniqueChunks = Array.from(uniqueChunksMap.values())

  // Calculate pre-optimization characters/tokens estimation
  const rawTextLength = uniqueChunks.reduce((sum, c) => sum + c.content.length, 0)
  const tokensBefore = Math.ceil(rawTextLength / 4)

  // 2. Compress each chunk content
  const compressedChunks = uniqueChunks.map(c => ({
    ...c,
    content: compressText(c.content)
  }))

  // 3. Truncate chunks from bottom until under token limit
  const optimizedChunks: ContextChunk[] = []
  let currentEstimatedTokens = 0
  const charLimit = tokenLimit * 4

  for (const chunk of compressedChunks) {
    const chunkLength = chunk.content.length
    if (currentEstimatedTokens + chunkLength <= charLimit) {
      optimizedChunks.push(chunk)
      currentEstimatedTokens += chunkLength
    } else {
      // Fit partial chunk if possible or break
      const remainingChars = charLimit - currentEstimatedTokens
      if (remainingChars > 100) {
        optimizedChunks.push({
          ...chunk,
          content: chunk.content.slice(0, remainingChars) + '... [TRUNCATED]'
        })
        currentEstimatedTokens = charLimit
      }
      break
    }
  }

  const tokensAfter = Math.ceil(currentEstimatedTokens / 4)
  const tokensSaved = Math.max(0, tokensBefore - tokensAfter)

  return {
    optimizedChunks,
    tokensBefore,
    tokensAfter,
    tokensSaved
  }
}

/**
 * Orchestrates rendering, token optimization, Gemini invocation with fallback, and logs telemetry.
 */
export async function executePromptWorkflow(options: PromptManagerOptions): Promise<ExecResult> {
  const start = Date.now()
  const { orgId, userId, templateId, version, variables, chunks = [], reasoningMode = 'direct', workflowType } = options

  // 1. Load active Prompt Template
  const promptTemplate = getPromptTemplate(templateId, version)
  const budgetProfile = await getOrgBudgetProfile(orgId)
  const budgetTokens = BUDGET_LIMITS[budgetProfile]

  // 2. Optimize Context chunks
  const { optimizedChunks, tokensBefore, tokensAfter, tokensSaved } = optimizeContext(chunks, budgetTokens)

  // Render context variables
  const renderedContext = optimizedChunks
    .map((c, i) => `[${i + 1}] (${c.source_doc}, page ${c.page_number})\n${c.content}`)
    .join('\n\n---\n\n')

  // 3. Construct final prompt string
  const finalVars = {
    ...variables,
    context: renderedContext
  }
  const promptText = renderPrompt(promptTemplate.template, finalVars)
  const estimatedTokens = Math.ceil(promptText.length / 4)

  let textResponse = ''
  let modelUsed: string = AI_MODELS.GENERATION_PRIMARY
  let fallbackLevel = 0
  let success = true
  let errorCode: string | null = null
  let errorMessage: string | null = null

  // 4. Invoke Gemini with failover
  if (!process.env.GEMINI_API_KEY) {
    textResponse = 'GEMINI_API_KEY is not set.'
    success = false
    errorCode = 'MISSING_API_KEY'
    errorMessage = 'API Key is missing in workspace environment.'
  } else {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    try {
      const res = await ai.models.generateContent({
        model: AI_MODELS.GENERATION_PRIMARY,
        contents: promptText
      })
      textResponse = res.text ?? ''
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      const status = err?.status || err?.statusCode
      const isFallbackTrigger =
        status === 429 ||
        status === 503 ||
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
        errMsg.toUpperCase().includes('UNAVAILABLE')

      if (isFallbackTrigger) {
        fallbackLevel = 1
        modelUsed = AI_MODELS.GENERATION_FALLBACK
        try {
          const res = await ai.models.generateContent({
            model: AI_MODELS.GENERATION_FALLBACK,
            contents: promptText
          })
          textResponse = res.text ?? ''
        } catch (fbErr: any) {
          success = false
          errorCode = fbErr?.status ? `HTTP_${fbErr.status}` : 'GENERATION_ERROR'
          errorMessage = fbErr?.message || String(fbErr)
          textResponse = 'AI models are currently unavailable.'
        }
      } else {
        success = false
        errorCode = err?.status ? `HTTP_${err.status}` : 'GENERATION_ERROR'
        errorMessage = errMsg
        textResponse = 'An error occurred during response generation.'
      }
    }
  }

  const latencyMs = Date.now() - start

  // Try to parse confidence score from JSON if structured
  let confidenceScore = 0.8
  try {
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.confidence_score) {
        confidenceScore = parsed.confidence_score
      } else if (parsed.reasoning_summary?.confidence) {
        confidenceScore = parsed.reasoning_summary.confidence / 100
      }
    }
  } catch {
    // Non-JSON or parsing failed, ignore
  }

  // 5. Asynchronously log telemetry
  void logAIRequest({
    org_id: orgId,
    user_id: userId,
    model_used: modelUsed,
    prompt_tokens: estimatedTokens,
    completion_tokens: Math.ceil(textResponse.length / 4),
    total_tokens: estimatedTokens + Math.ceil(textResponse.length / 4),
    latency_ms: latencyMs,
    fallback_level: fallbackLevel,
    success,
    error_code: errorCode,
    error_message: errorMessage,
    call_type: 'completion',
    // Phase 5 specific metadata (logged via telemetry)
    prompt_template_used: promptTemplate.id,
    prompt_version: promptTemplate.version,
    estimated_tokens: tokensBefore,
    tokens_saved: tokensSaved,
    reasoning_mode: reasoningMode,
    workflow_type: workflowType,
    confidence_score: confidenceScore
  } as any)

  return {
    text: textResponse,
    modelUsed,
    fallbackLevel,
    latencyMs,
    tokensBefore,
    tokensAfter,
    tokensSaved,
    estimatedTokens,
    confidenceScore
  }
}

// =============================================================================
// AegisRAG — Dual-Key Gemini Client Utility
// =============================================================================
// Strategy:
//   Round 1 — Try every model in the chain using GEMINI_API_KEY (primary key)
//   Round 2 — If ALL models on key 1 failed, retry the full model chain
//             with GEMINI_API_KEY_2 (secondary key) if it is configured
//
// This file is the single source of truth for all Gemini invocations.
// Import `runWithGemini` in manager.ts (chat) and narrativeService.ts (reports).
// =============================================================================

import { GoogleGenAI } from '@google/genai'

export interface GeminiRunOptions {
  /** Ordered list of model IDs to try (primary → fallback) */
  modelChain: readonly string[]
  /** Prompt content to send */
  prompt: string
  /** Label for log messages e.g. 'chat' or 'narrative' */
  label?: string
}

export interface GeminiRunResult {
  text: string
  modelUsed: string
  /** 0 = primary key / primary model, increments per fallback step */
  fallbackLevel: number
  /** true if the secondary key was needed */
  usedSecondaryKey: boolean
}

/** Tracks per-model rate-limit cooldowns (shared across all calls in this process) */
const rateLimitCooldowns = new Map<string, number>()
const RATE_LIMIT_COOLDOWN_MS = 60_000 // 1 minute

function isOnCooldown(model: string): boolean {
  const t = rateLimitCooldowns.get(model)
  return !!t && Date.now() - t < RATE_LIMIT_COOLDOWN_MS
}

function markCooldown(model: string): void {
  rateLimitCooldowns.set(model, Date.now())
}

function isRateLimitError(err: any): boolean {
  const status = err?.status || err?.statusCode
  const msg: string = err?.message || String(err)
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.toUpperCase().includes('RESOURCE_EXHAUSTED')
  )
}

/**
 * Attempts to generate content using the provided model chain.
 * Returns null if all models fail so the caller can try the next key.
 */
async function tryChainWithKey(
  ai: GoogleGenAI,
  modelChain: readonly string[],
  prompt: string,
  label: string,
  baseFallbackLevel: number
): Promise<{ text: string; modelUsed: string; fallbackLevel: number } | null> {
  for (let i = 0; i < modelChain.length; i++) {
    const model = modelChain[i]

    if (isOnCooldown(model)) {
      console.info(`[Gemini:${label}] Skipping ${model} — rate-limit cooldown active`)
      continue
    }

    try {
      console.log(`[Gemini:${label}] Trying model: ${model} (fallback level ${baseFallbackLevel + i})`)
      const res = await ai.models.generateContent({ model, contents: prompt })
      const text = res.text ?? ''
      return { text, modelUsed: model, fallbackLevel: baseFallbackLevel + i }
    } catch (err: any) {
      const status = err?.status || err?.statusCode
      if (isRateLimitError(err)) {
        console.warn(`[Gemini:${label}] ${model} rate-limited (429). Activating cooldown.`)
        markCooldown(model)
      } else {
        console.warn(`[Gemini:${label}] ${model} failed (status ${status}): ${err?.message}`)
      }
    }
  }
  return null
}

/**
 * Primary entry point for all Gemini calls in AegisRAG.
 *
 * Execution order:
 *   1. Try each model in modelChain with GEMINI_API_KEY
 *   2. If all fail, try each model in modelChain with GEMINI_API_KEY_2 (if set)
 *   3. If still all fail, throws so callers can use their baseline/static fallback
 */
export async function runWithGemini(options: GeminiRunOptions): Promise<GeminiRunResult> {
  const { modelChain, prompt, label = 'ai' } = options

  const primaryKey = process.env.GEMINI_API_KEY
  const secondaryKey = process.env.GEMINI_API_KEY_2

  if (!primaryKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  // ── Round 1: Primary key ─────────────────────────────────────────────────
  const aiPrimary = new GoogleGenAI({ apiKey: primaryKey })
  const primaryResult = await tryChainWithKey(aiPrimary, modelChain, prompt, label, 0)

  if (primaryResult) {
    return { ...primaryResult, usedSecondaryKey: false }
  }

  // ── Round 2: Secondary key ───────────────────────────────────────────────
  if (secondaryKey && secondaryKey !== 'your_second_gemini_api_key_here') {
    console.warn(`[Gemini:${label}] All models exhausted on primary key. Switching to GEMINI_API_KEY_2...`)
    const aiSecondary = new GoogleGenAI({ apiKey: secondaryKey })
    // Use the full model chain from the start (secondary key has fresh quota)
    const secondaryResult = await tryChainWithKey(
      aiSecondary,
      modelChain,
      prompt,
      `${label}:key2`,
      modelChain.length // fallback level continues counting
    )

    if (secondaryResult) {
      console.log(`[Gemini:${label}] Secondary key succeeded with ${secondaryResult.modelUsed}`)
      return { ...secondaryResult, usedSecondaryKey: true }
    }

    console.error(`[Gemini:${label}] Secondary key also exhausted all models.`)
  } else {
    console.error(`[Gemini:${label}] Primary key exhausted and GEMINI_API_KEY_2 is not configured.`)
  }

  throw new Error(`All Gemini models and API keys exhausted for ${label}`)
}

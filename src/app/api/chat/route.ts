// =============================================================================
// Sprint 3A: POST /api/chat  (updated)
//
// Pipeline:
//   1. Auth + org resolution
//   2. Ensure conversation exists in DB (create if new)
//   3. Persist user message
//   4. Retrieve relevant chunks via searchDocuments()
//   5. Generate answer via Gemini (gemini-2.0-flash)
//   6. Parse [N] citation markers from answer
//   7. Persist assistant message
//   8. Return { answer, citations, conversationId, mode, sources }
//
// Works without a valid GEMINI_API_KEY — retrieval still runs via keyword
// search, and answer generation returns a "no AI key" notice instead of
// failing the whole request.
// =============================================================================

import { randomUUID }        from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { searchDocuments }   from '@/features/retrieval'
import { GoogleGenAI }       from '@google/genai'
import type { SearchResult, CitationRef } from '@/features/retrieval'
import { AI_MODELS }         from '@/config/ai'
import { logAIRequest }      from '@/features/retrieval/telemetry'
import { evaluateRetrieval } from '@/features/retrieval/evaluate'
import { checkLimit, incrementUsage } from '@/features/trial/limits.server'


export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ── Build a grounded prompt ───────────────────────────────────────────────────
function buildPrompt(question: string, chunks: SearchResult[]): string {
  const context = chunks
    .map((c, i) =>
      `[${i + 1}] (${c.document.originalName}, page ${c.metadata.page_number})\n${c.content}`
    )
    .join('\n\n---\n\n')

  return `You are AegisRAG, a compliance and policy analysis assistant. Answer the user's question using ONLY the context below. Cite sources as [1], [2], etc. If the context doesn't contain the answer, say so clearly. Do not hallucinate information not in the context.

CONTEXT:
${context}

QUESTION: ${question}

ANSWER (cite sources inline as [N]):`
}

// ── Parse citation indices from answer text ───────────────────────────────────
function parseCitations(answer: string, sources: SearchResult[]): CitationRef[] {
  const indices = new Set<number>()
  const pattern = /\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(answer)) !== null) {
    const idx = parseInt(match[1], 10)
    if (idx >= 1 && idx <= sources.length) indices.add(idx)
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((idx) => ({
      index:   idx,
      chunkId: sources[idx - 1].chunkId,
      result:  sources[idx - 1],
    }))
}

// ── Auto-generate conversation title from first message ───────────────────────
function makeTitle(question: string): string {
  return question.length > 60 ? question.slice(0, 57) + '…' : question
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }

  // Check trial limits
  const aiCheck = await checkLimit(user.id, profile.role, 'ai_request')
  if (!aiCheck.allowed) {
    return NextResponse.json({ error: aiCheck.reason }, { status: 429 })
  }


  // ── 2. Parse request ──────────────────────────────────────────────────────
  let body: {
    message?: string
    conversationId?: string
    filters?: Record<string, string>
    dateFrom?: string
    dateTo?: string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const question = (body.message ?? '').trim()
  if (!question) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  // ── 3. Ensure conversation exists ─────────────────────────────────────────
  let conversationId = body.conversationId
  let isNew = false

  if (!conversationId) {
    // Create a fresh conversation with an auto-generated title
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        org_id:  profile.org_id,
        user_id: user.id,
        title:   makeTitle(question),
      })
      .select('id')
      .single()

    if (convErr || !newConv) {
      console.error('[api/chat] conversation create error:', convErr)
      // Fallback: proceed without DB persistence
      conversationId = randomUUID()
    } else {
      conversationId = newConv.id
      isNew = true
    }
  }

  // ── 4. Persist user message ───────────────────────────────────────────────
  if (!isNew) {
    // Verify the conversation belongs to this user/org before inserting
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
  }

  // Insert user message (fire-and-forget; if it fails we still answer)
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    org_id:          profile.org_id,
    role:            'user',
    content:         question,
    citations:       [],
  })

  // ── 5. Retrieve context ───────────────────────────────────────────────────
  console.log('[api/chat] user id   :', user.id)
  console.log('[api/chat] org_id    :', profile.org_id)
  console.log('[api/chat] question  :', question)
  const retrievalStart = Date.now()
  const sources = await searchDocuments(question, profile.org_id, {
    department:  body.filters?.department,
    docType:     body.filters?.docType,
    sensitivity: body.filters?.sensitivity,
    dateFrom:    body.dateFrom,
    dateTo:      body.dateTo,
    limit:       6,
  })
  const retrievalMs = Date.now() - retrievalStart

  const mode = sources[0]?.mode ?? 'keyword'

  // ── 6. Generate answer ────────────────────────────────────────────────────
  let answer: string

  if (!process.env.GEMINI_API_KEY) {
    answer = sources.length > 0
      ? `I found ${sources.length} relevant source${sources.length > 1 ? 's' : ''} [${sources.map((_, i) => i + 1).join('][')}], but answer generation is unavailable (GEMINI_API_KEY not set). Please review the cited sources directly.`
      : 'No relevant documents were found for your query. Please upload and process documents in the Knowledge Vault first.'
  } else if (sources.length === 0) {
    answer = 'No relevant documents found for your query. Try different keywords or upload more documents in the Knowledge Vault.'
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      let res
      let genLatencyMs = 0
      let fallbackLevel = 0
      let modelUsed: string = AI_MODELS.GENERATION_PRIMARY
      const genStart = Date.now()
      try {
        res = await ai.models.generateContent({
          model:    AI_MODELS.GENERATION_PRIMARY,
          contents: buildPrompt(question, sources),
        })
        genLatencyMs = Date.now() - genStart
      } catch (err: any) {
        const errorMsg = err?.message || String(err)
        const status = err?.status || err?.statusCode
        const isFallbackTrigger =
          status === 429 ||
          status === 503 ||
          errorMsg.includes('429') ||
          errorMsg.includes('503') ||
          errorMsg.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
          errorMsg.toUpperCase().includes('UNAVAILABLE')

        if (isFallbackTrigger) {
          console.log('[chat] primary model failed, attempting fallback')
          fallbackLevel = 1
          modelUsed = AI_MODELS.GENERATION_FALLBACK
          res = await ai.models.generateContent({
            model:    AI_MODELS.GENERATION_FALLBACK,
            contents: buildPrompt(question, sources),
          })
          genLatencyMs = Date.now() - genStart
        } else {
          throw err
        }
      }
      answer = res.text ?? 'No response generated.'

      // ── 4C: Log AI request telemetry (fire-and-forget) ─────────────────
      void logAIRequest({
        org_id:         profile.org_id,
        user_id:        user.id,
        model_used:     modelUsed,
        latency_ms:     genLatencyMs,
        fallback_level: fallbackLevel,
        success:        true,
        call_type:      'completion',
      })
    } catch (err) {
      console.error('[api/chat] generation error:', err)
      answer = `Retrieved ${sources.length} source${sources.length > 1 ? 's' : ''}, but generation failed. ${sources.map((_, i) => `[${i + 1}]`).join(' ')}`
    }
  }

  // ── 7. Parse citations ────────────────────────────────────────────────────
  const citations = parseCitations(answer, sources)

  // ── 8. Persist assistant message ──────────────────────────────────────────
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    org_id:          profile.org_id,
    role:            'assistant',
    content:         answer,
    citations:       citations as never,
    retrieval_mode:  mode,
  })

  const responsePayload = { answer, citations, conversationId, mode, sources }

  // Increment daily AI requests usage if metered tier
  if (['trial_user', 'academic_user', 'approved_user'].includes(profile.role)) {
    await incrementUsage(user.id, 'ai_requests')
  }

  // ── 9. 4C: Evaluation (fire-and-forget — runs after response is built) ────

  void evaluateRetrieval(
    profile.org_id,
    question,
    answer,
    sources,
    {
      retrieval_mode:   mode,
      total_latency_ms: retrievalMs,
      conversation_id:  conversationId,
    }
  )

  return NextResponse.json(responsePayload, { status: 200 })
}

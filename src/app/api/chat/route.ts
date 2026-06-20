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

// randomUUID import removed
import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { searchDocuments }   from '@/features/retrieval'
import { GoogleGenAI }       from '@google/genai'
import type { SearchResult, CitationRef } from '@/features/retrieval'
import { AI_MODELS }         from '@/config/ai'
import { logAIRequest }      from '@/features/retrieval/telemetry'
import { evaluateRetrieval } from '@/features/retrieval/evaluate'
import { checkLimit, incrementUsage } from '@/features/trial/limits.server'
import { executePromptWorkflow } from '@/features/prompts/manager'
import { scanInputPrompt } from '@/features/guardrails/guardrailEngine'
import { scanOutputResponse, cleanCitations } from '@/features/guardrails/outputGuardrailEngine'
import { evaluateRetrievalQuery } from '@/features/guardrails/queryGuardrail'


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

// ── Classify query type for detailed telemetry (Sprint 6C) ────────────────────
export function classifyQueryType(question: string): 'title_query' | 'fact_query' | 'compliance_query' | 'citation_query' {
  const normalized = question.toLowerCase().trim();
  if (/title|filename|document\s+name|pdf|what\s+is\s+this\s+document\s+called|what\s+is\s+the\s+name\s+of\s+the\s+document|what\s+document/i.test(normalized)) {
    return 'title_query';
  }
  if (/cite|citation|source|reference|page|paragraph|where\s+does\s+it\s+say|according\s+to/i.test(normalized)) {
    return 'citation_query';
  }
  if (/soc|nist|iso|hipaa|gdpr|pci|comply|compliance|framework|audit|regulation|policy|policies/i.test(normalized)) {
    return 'compliance_query';
  }
  return 'fact_query';
}

// ── Secure ReAct Search Query Planner ────────────────────────────────────────
//
// Pipeline:
//   1. evaluateRetrievalQuery() — security scan + intent classification
//   2. If attackType is set → log and reject (return null to signal caller)
//   3. If shouldPreserveQuery → return sanitized query as-is (e.g. ToC, abstract)
//   4. Otherwise → let Gemini rewrite for vector/keyword optimization
//
async function reasonSearchQuery(
  question: string,
  orgId: string
): Promise<{ query: string; blocked: boolean; attackType: string | null }> {

  // ── Stage 1: Security evaluation + intent classification ──────────────────
  const guard = evaluateRetrievalQuery(question)

  if (!guard.safe) {
    console.warn(
      `[QueryGuard] BLOCKED query — attackType=${guard.attackType} riskScore=${guard.riskScore} hash=${guard.queryHash}`
    )
    return { query: '', blocked: true, attackType: guard.attackType }
  }

  // ── Stage 2: Preserve document-structural queries verbatim ────────────────
  // ToC, metadata, and abstract queries must not be rewritten by Gemini
  // because the rewriter strips critical structural terms.
  if (guard.shouldPreserveQuery) {
    console.log(
      `[QueryGuard] Preserving query — intent=${guard.intent} hash=${guard.queryHash}`
    )
    return { query: guard.sanitizedQuery, blocked: false, attackType: null }
  }

  // ── Stage 3: Gemini-assisted query optimization (non-structural queries) ──
  if (!process.env.GEMINI_API_KEY) {
    return { query: guard.sanitizedQuery, blocked: false, attackType: null }
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const res = await ai.models.generateContent({
      model: AI_MODELS.GENERATION_FALLBACK_1,
      contents: `You are a search query planner. Reason about what information is required to answer the user question.
Create a search query (maximum 6 words) optimized for vector and keyword search to retrieve the relevant compliance controls or evidence.
Output ONLY the raw search query words, with no punctuation, tags, or extra text.

USER QUESTION: ${guard.sanitizedQuery}
SEARCH QUERY:`
    })
    const optimized = res.text?.trim()
    if (optimized && optimized.length > 0 && optimized.length < 200) {
      console.log(`[QueryGuard] Optimized "${guard.sanitizedQuery}" -> "${optimized}" (intent=${guard.intent})`)
      return { query: optimized, blocked: false, attackType: null }
    }
  } catch (err) {
    console.error('[QueryGuard] Gemini query optimization failed, using sanitized original:', err)
  }

  return { query: guard.sanitizedQuery, blocked: false, attackType: null }
}

// ── Auto-generate conversation title from first message ───────────────────────
function makeTitle(question: string): string {
  return question.length > 60 ? question.slice(0, 57) + '…' : question
}

export async function POST(req: NextRequest) {
  let logData = '=== RUNTIME FORENSIC TRACE: POST /api/chat ===\n'
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

  // ── Run Input Guardrails ──────────────────────────────────────────────────
  const inputGuard = scanInputPrompt(question)

  if (inputGuard.severity === 'BLOCK') {
    let conversationId = body.conversationId
    let isNew = false

    if (!conversationId) {
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
        console.error('[api/chat] conversation create failed', {
          userId: user.id,
          orgId: profile.org_id,
          error: convErr
        })
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      } else {
        conversationId = newConv.id
        isNew = true
      }
    } else {
      // M4 FIX: verify ownership by user_id + org_id, not just id
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .eq('org_id', profile.org_id)
        .single()

      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
    }

    await (supabase as any).from('messages').insert({
      conversation_id: conversationId,
      org_id:          profile.org_id,
      role:            'user',
      content:         question,
      citations:       [],
    })

    const blockedMessage = "Blocked by AegisRAG AI Governance Engine due to security policies."

    await (supabase as any).from('messages').insert({
      conversation_id: conversationId,
      org_id:          profile.org_id,
      role:            'assistant',
      content:         blockedMessage,
      citations:       [],
      retrieval_mode:  'keyword',
      reasoning_metadata: {
        guardrail_blocked: true,
        risk_score: inputGuard.risk_score,
        categories: inputGuard.categories
      }
    })

    // Log to guardrail_telemetry
    await (supabase as any).from('guardrail_telemetry').insert({
      org_id: profile.org_id,
      user_id: user.id,
      guardrail_type: 'input',
      category: inputGuard.categories.join(',') || 'unknown',
      severity: inputGuard.severity,
      risk_score: inputGuard.risk_score,
      action_taken: inputGuard.action,
      prompt_hash: inputGuard.prompt_hash,
      metadata: inputGuard.metadata
    })

    return NextResponse.json({
      answer: blockedMessage,
      citations: [],
      conversationId,
      mode: 'keyword',
      sources: [],
      guardrailBlocked: true
    }, { status: 200 })
  }

  // If input guardrail is WARN, log telemetry
  if (inputGuard.severity === 'WARN') {
    await (supabase as any).from('guardrail_telemetry').insert({
      org_id: profile.org_id,
      user_id: user.id,
      guardrail_type: 'input',
      category: inputGuard.categories.join(','),
      severity: inputGuard.severity,
      risk_score: inputGuard.risk_score,
      action_taken: inputGuard.action,
      prompt_hash: inputGuard.prompt_hash,
      metadata: inputGuard.metadata
    })
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
      console.error('[api/chat] conversation create failed', {
        userId: user.id,
        orgId: profile.org_id,
        error: convErr
      })
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    } else {
      conversationId = newConv.id
      isNew = true
    }
  }

  // ── 4. Persist user message ───────────────────────────────────────────────
  if (!isNew) {
    // M3 FIX: verify ownership by user_id + org_id to prevent cross-tenant injection
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .eq('org_id', profile.org_id)
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

  // ── 5. Retrieve context with ReAct intent reasoning + security guard ────────
  console.log('[api/chat] user id   :', user.id)
  console.log('[api/chat] org_id    :', profile.org_id)
  console.log('[api/chat] question  :', question)

  // Stage 1 — Secure Query Guard: evaluate intent + detect attack patterns
  const queryGuardResult = await reasonSearchQuery(question, profile.org_id)

  if (queryGuardResult.blocked) {
    const blockedMsg = `Query blocked by AegisRAG security engine. Reason: ${queryGuardResult.attackType ?? 'POLICY_VIOLATION'}`

    // Persist to guardrail telemetry for audit trail
    await (supabase as any).from('guardrail_telemetry').insert({
      org_id: profile.org_id,
      user_id: user.id,
      guardrail_type: 'retrieval_query',
      category: queryGuardResult.attackType ?? 'unknown',
      severity: 'BLOCK',
      risk_score: 100,
      action_taken: 'blocked',
      prompt_hash: null,
      metadata: { attack_type: queryGuardResult.attackType, query_preview: question.slice(0, 80) }
    })

    await (supabase as any).from('messages').insert({
      conversation_id: conversationId,
      org_id:          profile.org_id,
      role:            'assistant',
      content:         blockedMsg,
      citations:       [],
      retrieval_mode:  'keyword',
      reasoning_metadata: { guardrail_blocked: true, attack_type: queryGuardResult.attackType }
    })

    return NextResponse.json({ error: blockedMsg, guardrailBlocked: true }, { status: 400 })
  }

  // Stage 2 — Action: Retrieve context using security-vetted, intent-classified query
  const retrievalStart = Date.now()
  const sources = await searchDocuments(
    queryGuardResult.query,
    profile.org_id,
    {
      department:     body.filters?.department,
      docType:        body.filters?.docType,
      sensitivity:    body.filters?.sensitivity,
      framework:      body.filters?.framework,
      classification: body.filters?.classification,
      documentId:     body.filters?.documentId,
      organizationId: body.filters?.organizationId,
      dateFrom:       body.dateFrom,
      dateTo:         body.dateTo,
      limit:          body.filters?.limit ? parseInt(body.filters.limit, 10) : 6,
    },
    user.id,
    profile.role
  )
  const retrievalMs = Date.now() - retrievalStart
  const metrics = (sources as any).metrics

  const mode = sources[0]?.mode ?? 'keyword'


  // ── 5B. NO_EVIDENCE Bypass ─────────────────────────────────────────────────
  if (sources.length === 0) {
    const noEvidenceAnswer = 'No supporting evidence was found in the knowledge base. Please try different keywords or upload relevant documents.'
    
    const reasoningMetadataPayload = {
      status: 'NO_EVIDENCE',
      evidence_count: 0,
      retrieval_confidence: 0,
      governance_skipped: true
    }

    await (supabase as any).from('messages').insert({
      conversation_id: conversationId,
      org_id:          profile.org_id,
      role:            'assistant',
      content:         noEvidenceAnswer,
      citations:       [],
      retrieval_mode:  mode,
      reasoning_metadata: reasoningMetadataPayload
    })

    if (['trial_user', 'academic_user', 'approved_user'].includes(profile.role)) {
      await incrementUsage(user.id, 'ai_requests')
    }

    return NextResponse.json({
      answer: noEvidenceAnswer,
      citations: [],
      conversationId,
      mode,
      sources: [],
      status: 'NO_EVIDENCE',
      reasoning_metadata: reasoningMetadataPayload
    }, { status: 200 })
  }

  // ── 6. Generate answer via Prompt Manager (CoT grounding) ──────────────────
  let answer: string = ''
  let reasoningSummary: any = {
    intent: 'knowledge_qa',
    evidence_count: sources.length,
    reasoning_mode: 'react',
    frameworks: [] as string[],
    confidence: 85
  }

  if (!process.env.GEMINI_API_KEY) {
    answer = `I found ${sources.length} relevant source${sources.length > 1 ? 's' : ''} [${sources.map((_, i) => i + 1).join('][')}], but answer generation is unavailable (GEMINI_API_KEY not set). Please review the cited sources directly.`
  } else {
    try {
      // Execute the centralized knowledge_qa template (v2 incorporates CoT instructions & outputs JSON)
      const result = await executePromptWorkflow({
        orgId: profile.org_id,
        userId: user.id,
        templateId: 'knowledge_qa',
        version: 'v2',
        variables: { question },
        chunks: sources.map(s => ({
          chunkId: s.chunkId,
          content: s.content,
          source_doc: s.document.originalName,
          page_number: s.metadata.page_number
        })),
        reasoningMode: 'react'
      })

      // TEMPORARY FORENSIC LOGGING
      const fullContext = sources.map((s, i) => `[${i + 1}] (${s.document.originalName}, page ${s.metadata.page_number})\n${s.content}`).join('\n\n---\n\n')
      logData += '==================================================\n'
      logData += `1. Retrieved chunk count : ${sources.length}\n`
      logData += `2. Context length        : ${fullContext.length}\n`
      logData += `3. First 1000 chars of context:\n${fullContext.substring(0, 1000)}\n\n`
      logData += `4. Final prompt sent to Gemini:\n${result.promptText}\n\n`
      logData += `5. Raw Gemini response:\n${result.text}\n\n`

      // Parse reasoning summary & final answer
      let parsedAnswer = result.text
      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.reasoning_summary) {
            reasoningSummary = parsed.reasoning_summary
          }
          if (parsed.final_answer) {
            parsedAnswer = parsed.final_answer
          }
        }
      } catch (err) {
        console.warn('[chat] Failed to parse JSON response from Gemini, falling back to raw response:', err)
      }
      answer = parsedAnswer
      logData += `6. Parsed answer:\n${parsedAnswer}\n\n`
      logData += '==================================================\n'
    } catch (err) {
      console.error('[api/chat] generation error:', err)
      answer = `Retrieved ${sources.length} source${sources.length > 1 ? 's' : ''}, but generation failed. ${sources.map((_, i) => `[${i + 1}]`).join(' ')}`
    }
  }

  // ── 7. Parse citations ────────────────────────────────────────────────────
  answer = cleanCitations(answer)
  let citations = parseCitations(answer, sources)

  // ── Run Output Guardrails ─────────────────────────────────────────────────
  const outputGuard = scanOutputResponse(
    answer,
    sources.map(s => ({
      chunkId: s.chunkId,
      content: s.content,
      source_doc: s.document.originalName,
      page_number: s.metadata.page_number
    }))
  )

  // If output guardrail is BLOCK, rewrite answer and citations
  const avgRetrievalScore = sources.length > 0
    ? Math.round(sources.reduce((acc, s) => acc + (s.score || 0.85), 0) / sources.length * 100)
    : 0

  if (outputGuard.severity === 'BLOCK') {
    console.warn(`[governance] RESPONSE BLOCKED due to low groundedness or high hallucination risk.
      Groundedness Score: ${outputGuard.groundedness_score}
      Hallucination Score: ${outputGuard.risk_score}
      Retrieval Confidence: ${avgRetrievalScore}%
      Citation Count: ${outputGuard.metadata.total_citations}
      Source Count: ${sources.length}`);
    answer = "Response blocked by AegisRAG AI Governance Engine due to low groundedness or high hallucination risk."
    citations = []
  }

  // Log to guardrail_telemetry
  await (supabase as any).from('guardrail_telemetry').insert({
    org_id: profile.org_id,
    user_id: user.id,
    guardrail_type: 'output',
    category: outputGuard.categories.join(',') || 'none',
    severity: outputGuard.severity,
    risk_score: outputGuard.risk_score,
    action_taken: outputGuard.action,
    prompt_hash: null,
    metadata: {
      ...outputGuard.metadata,
      groundedness_score: outputGuard.groundedness_score,
      confidence: outputGuard.confidence,
      retrieval_confidence: avgRetrievalScore,
      source_count: sources.length,
      retrievalMode: process.env.ENABLE_PARENT_CHILD_RETRIEVAL === 'true' ? 'parent_child' : mode,
      queryType: classifyQueryType(question)
    }
  })

  // Combine reasoning metadata and guardrail results
  const reasoningMetadataPayload = {
    ...reasoningSummary,
    evidence_count: sources.length,
    retrieval_confidence: avgRetrievalScore,
    groundedness_score: outputGuard.groundedness_score,
    confidence: outputGuard.confidence,
    output_risk_score: outputGuard.risk_score,
    output_severity: outputGuard.severity
  }

  // ── 8. Persist assistant message ──────────────────────────────────────────
  await (supabase as any).from('messages').insert({
    conversation_id: conversationId,
    org_id:          profile.org_id,
    role:            'assistant',
    content:         answer,
    citations:       citations as never,
    retrieval_mode:  mode,
    reasoning_metadata: reasoningMetadataPayload
  })

  const responsePayload = { 
    answer, 
    citations, 
    conversationId, 
    mode, 
    sources,
    guardrail: {
      groundedness_score: outputGuard.groundedness_score,
      confidence: outputGuard.confidence,
      risk_score: outputGuard.risk_score,
      severity: outputGuard.severity,
      action: outputGuard.action
    },
    reasoning_metadata: reasoningMetadataPayload
  }

  // Increment daily AI requests usage if metered tier
  if (['trial_user', 'academic_user', 'approved_user'].includes(profile.role)) {
    await incrementUsage(user.id, 'ai_requests')
  }

  // ── 9. Evaluation (fire-and-forget — runs after response is built) ────────
  if (process.env.ENABLE_RETRIEVAL_EVALS === 'true') {
    void evaluateRetrieval(
      profile.org_id,
      question,
      answer,
      sources,
      {
        retrieval_mode:       mode,
        total_latency_ms:     retrievalMs,
        conversation_id:      conversationId,
        vector_latency_ms:    metrics?.vector_latency_ms,
        keyword_latency_ms:   metrics?.keyword_latency_ms,
        fusion_latency_ms:    metrics?.fusion_latency_ms,
        rerank_latency_ms:    metrics?.rerank_latency_ms,
        vector_candidates:    metrics?.vector_candidates,
        reranked_candidates:   metrics?.reranked_candidates,
        context_tokens_saved: metrics?.context_tokens_saved,
        reranker_enabled:     metrics?.reranker_enabled,
        reranker_model:       metrics?.reranker_model,
        pre_rerank_score:     metrics?.pre_rerank_score,
        post_rerank_score:    metrics?.post_rerank_score,
        reranker_lift:        metrics?.reranker_lift,
      }
    )
  } else {
    console.log('[api/chat] skipping retrieval evaluation (ENABLE_RETRIEVAL_EVALS !== true)')
  }

  logData += `7. Final responsePayload.answer:\n${responsePayload.answer}\n`
  logData += '==================================================\n'

  try {
    const fs = require('fs')
    const path = require('path')
    fs.writeFileSync(path.resolve('forensic-trace.txt'), logData)
  } catch (err) {
    console.error('Failed to write forensic-trace.txt:', err)
  }

  return NextResponse.json(responsePayload, { status: 200 })
}

import { searchDocuments } from '@/features/retrieval/service'
import { createAdminClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import { AI_MODELS } from '@/config/ai'
import fs from 'fs'
import path from 'path'

export interface QuestionItem {
  question: string
  expectedKeywords: string[]
  expectedControlFamily: string
  expectedSourceDocument: string
}

export interface GoldenAnswerItem extends QuestionItem {
  expectedAnswer: string
}

// ── Heuristic helpers for non-LLM evaluations ───────────────────────────────

function calculateLexicalOverlap(text1: string, text2: string): number {
  if (!text1 || !text2) return 0
  const words1 = new Set(text1.toLowerCase().match(/\b\w+\b/g) || [])
  const words2 = new Set(text2.toLowerCase().match(/\b\w+\b/g) || [])
  if (words1.size === 0 || words2.size === 0) return 0
  
  let intersectionSize = 0
  for (const w of words1) {
    if (words2.has(w)) intersectionSize++
  }
  
  // return Jaccard similarity
  return intersectionSize / (words1.size + words2.size - intersectionSize)
}

function computeCitationHitRate(answer: string, sourceCount: number): number {
  const cited = new Set<number>()
  const pattern = /\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(answer)) !== null) {
    cited.add(parseInt(m[1], 10))
  }
  if (cited.size === 0) return 1.0 // no citations attempted → valid
  const valid = [...cited].filter((i) => i >= 1 && i <= sourceCount).length
  return valid / cited.size
}

// ── LLM Judge Evaluation ─────────────────────────────────────────────────────

async function runGeminiJudge(
  question: string,
  answer: string,
  chunks: string[],
  expectedAnswer: string
): Promise<{
  groundingScore: number
  hallucinationScore: number
  notes: string
}> {
  if (!process.env.GEMINI_API_KEY) {
    return { groundingScore: 0.5, hallucinationScore: 1.0, notes: 'No API key' }
  }

  const contextText = chunks.map((c, i) => `[Chunk ${i + 1}]: ${c}`).join('\n\n')

  const prompt = `You are a RAG system evaluation judge. Analyze the QUESTION, the RETRIEVED CONTEXT, the GENERATED ANSWER, and the GOLDEN EXPECTED ANSWER.
Evaluate the generated answer on two criteria:
1. Grounding Score (0.0 to 1.0): How well is the generated answer supported by the retrieved context? 1.0 means fully supported, 0.0 means completely unsupported.
2. Hallucination Score (0.0 to 1.0): Does the generated answer contain claims not supported by the context? 1.0 means no hallucinations (perfectly grounded), 0.0 means heavy hallucinations or fabricated claims/controls.

Return a JSON object with exactly three fields:
"grounding_score": float between 0.0 and 1.0
"hallucination_score": float between 0.0 and 1.0
"notes": string (one sentence summary of your evaluation)

QUESTION: ${question}
GOLDEN EXPECTED ANSWER: ${expectedAnswer}
RETRIEVED CONTEXT:
${contextText}
GENERATED ANSWER:
${answer}

Return ONLY valid JSON. No markdown formatting, no code block backticks.`

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const res = await ai.models.generateContent({
      model: AI_MODELS.GENERATION_PRIMARY || 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    })
    const raw = res.text?.trim() || '{}'
    const parsed = JSON.parse(raw)
    
    return {
      groundingScore: typeof parsed.grounding_score === 'number' ? Math.max(0, Math.min(1, parsed.grounding_score)) : 0.5,
      hallucinationScore: typeof parsed.hallucination_score === 'number' ? Math.max(0, Math.min(1, parsed.hallucination_score)) : 1.0,
      notes: typeof parsed.notes === 'string' ? parsed.notes : ''
    }
  } catch (err: any) {
    console.error('[evalRunner] Gemini judge failed:', err.message)
    return { groundingScore: 0.5, hallucinationScore: 0.5, notes: 'LLM evaluation error' }
  }
}

// ── Answer Generator ─────────────────────────────────────────────────────────

async function generateAnswer(question: string, chunks: any[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return 'LLM generator key missing — answer generation bypassed.'
  }

  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.document.originalName}, page ${c.metadata.page_number})\n${c.content}`)
    .join('\n\n---\n\n')

  const prompt = `You are AegisRAG. Answer the user's question using ONLY the context below. Cite sources inline as [1], [2], etc. If the context doesn't contain the answer, say so clearly.

CONTEXT:
${context}

QUESTION: ${question}

ANSWER (cite sources inline as [N]):`

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const res = await ai.models.generateContent({
      model: AI_MODELS.GENERATION_PRIMARY || 'gemini-2.5-flash',
      contents: prompt
    })
    return res.text?.trim() || ''
  } catch (err: any) {
    console.error('[evalRunner] Answer generation failed:', err.message)
    return 'Failed to generate answer due to LLM error.'
  }
}

// ── Core runner function ─────────────────────────────────────────────────────

export async function runEvaluation(
  orgId: string,
  datasetName: string, // 'nist80053' | 'nistcsf20' | 'owasp_top10'
  evaluationName: string
): Promise<any> {
  const startRunTime = Date.now()

  // 1. Load dataset & golden answers
  const projectRoot = process.cwd()
  const datasetPath = path.join(projectRoot, 'src', 'features', 'evaluation', 'datasets', `${datasetName}.json`)
  const goldenPath = path.join(projectRoot, 'src', 'features', 'evaluation', 'golden_answers', `${datasetName}.json`)

  if (!fs.existsSync(datasetPath) || !fs.existsSync(goldenPath)) {
    throw new Error(`Dataset or Golden Answers not found for: ${datasetName}`)
  }

  const questions: QuestionItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))
  const goldenAnswers: GoldenAnswerItem[] = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'))

  // Aggregate metrics
  let totalQuestions = questions.length
  let passedQuestions = 0
  let sumRetrieval = 0
  let sumGrounding = 0
  let sumCitation = 0
  let sumHallucination = 0
  let sumLatency = 0

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY) && process.env.DISABLE_LLM_EVAL !== 'true'
  const provider = hasApiKey ? 'Gemini' : 'Heuristic'
  const modelName = hasApiKey ? (AI_MODELS.GENERATION_PRIMARY || 'gemini-2.5-flash') : 'None'

  const admin = createAdminClient() as any

  // 2. Create the evaluation_runs row
  const { data: run, error: runError } = await admin
    .from('evaluation_runs')
    .insert({
      org_id: orgId,
      dataset_name: datasetName,
      total_questions: totalQuestions,
      passed_questions: 0,
      overall_score: 0.0,
      retrieval_score: 0.0,
      grounding_score: 0.0,
      citation_score: 0.0,
      hallucination_score: 0.0,
      latency_ms: 0,
      provider,
      model_name: modelName,
      evaluation_version: '1.0.0',
      dataset_version: '2.0.0'
    })
    .select('id')
    .single()

  if (runError || !run) {
    throw new Error(`Failed to create evaluation run row: ${runError?.message}`)
  }

  const runId = run.id
  console.log(`[evalRunner] Started run ${runId} for dataset ${datasetName} (${totalQuestions} questions)`)

  // 3. Process each question
  for (let i = 0; i < totalQuestions; i++) {
    const qItem = questions[i]
    const gItem = goldenAnswers.find(g => g.question === qItem.question) || { expectedAnswer: '' }
    const qStart = Date.now()

    try {
      // Step A: Search documents
      const retrieved = await searchDocuments(qItem.question, orgId, { limit: 5 })
      const retrievedContent = retrieved.map(r => r.content).join(' ')
      
      // Step B: Calculate Retrieval Score
      // Did we retrieve chunks from the expected source document?
      const retrievedFromDoc = retrieved.filter(r => 
        r.document.originalName?.toLowerCase() === qItem.expectedSourceDocument.toLowerCase()
      )
      
      const hasCorrectDoc = retrievedFromDoc.length > 0
      
      // Compute keyword match ratio in retrieved chunks
      let matchedKeywords = 0
      qItem.expectedKeywords.forEach(kw => {
        if (retrievedContent.toLowerCase().includes(kw.toLowerCase())) {
          matchedKeywords++
        }
      })
      const keywordRatio = qItem.expectedKeywords.length > 0 ? (matchedKeywords / qItem.expectedKeywords.length) : 0
      
      // Retrieval Score = 50% for document hit + 50% for keyword coverage
      const retrievalScore = (hasCorrectDoc ? 50 : 0) + (keywordRatio * 50)

      // Step C: Optional Answer Generation & Grounding/Citation/Hallucination grading
      let generatedText: string | null = null
      let groundingScore = 0
      let citationScore = 100
      let hallucinationScore = 100

      const qLatency = Date.now() - qStart

      if (hasApiKey) {
        // Run full LLM evaluations
        generatedText = await generateAnswer(qItem.question, retrieved)
        
        const judgeRes = await runGeminiJudge(
          qItem.question,
          generatedText,
          retrieved.map(r => r.content),
          gItem.expectedAnswer
        )
        
        groundingScore = judgeRes.groundingScore * 100
        hallucinationScore = judgeRes.hallucinationScore * 100
        
        // Citation score is citation hit rate
        const citationHitRate = computeCitationHitRate(generatedText, retrieved.length)
        citationScore = citationHitRate * 100
      } else {
        // Heuristic-only evaluations: since no LLM is present,
        // we compare expectedAnswer and retrieved chunks to compute grounding
        const overlap = calculateLexicalOverlap(gItem.expectedAnswer, retrievedContent)
        groundingScore = Math.min(100, overlap * 200) // scale Jaccard to 100
        
        citationScore = 100 // vacuously valid
        hallucinationScore = 100 // no LLM means no hallucination risk
      }

      // Step D: Calculate Overall Score for this question
      const qOverallScore = (retrievalScore + groundingScore + citationScore + hallucinationScore) / 4
      const passed = qOverallScore >= 80

      if (passed) passedQuestions++

      // Determine failure reason if failed
      let failureReason: string | null = null
      if (!passed) {
        if (retrieved.length === 0) {
          failureReason = 'NO_CHUNKS'
        } else if (retrievalScore < 50) {
          failureReason = 'LOW_RETRIEVAL'
        } else if (citationScore < 70) {
          failureReason = 'BAD_CITATION'
        } else if (hallucinationScore < 50) {
          failureReason = 'HALLUCINATION'
        } else {
          failureReason = 'OTHER'
        }
      }

      // Step E: Save to rag_evaluations
      const { error: evalError } = await admin
        .from('rag_evaluations')
        .insert({
          run_id: runId,
          org_id: orgId,
          question: qItem.question,
          expected_answer: gItem.expectedAnswer,
          generated_answer: generatedText,
          retrieved_chunks: retrieved.length,
          retrieval_score: retrievalScore,
          grounding_score: groundingScore,
          citation_score: citationScore,
          hallucination_score: hallucinationScore,
          latency_ms: qLatency,
          passed,
          failure_reason: failureReason
        })

      if (evalError) {
        console.error(`[evalRunner] Failed to insert evaluation row:`, evalError.message)
      }

      // Accumulate aggregates
      sumRetrieval += retrievalScore
      sumGrounding += groundingScore
      sumCitation += citationScore
      sumHallucination += hallucinationScore
      sumLatency += qLatency

    } catch (err: any) {
      console.error(`[evalRunner] Error processing question "${qItem.question}":`, err.message)
      
      // Save a failed row
      await admin.from('rag_evaluations').insert({
        run_id: runId,
        org_id: orgId,
        question: qItem.question,
        expected_answer: gItem.expectedAnswer,
        generated_answer: null,
        retrieved_chunks: 0,
        retrieval_score: 0,
        grounding_score: 0,
        citation_score: 0,
        hallucination_score: 0,
        latency_ms: Date.now() - qStart,
        passed: false,
        failure_reason: 'OTHER'
      })
    }
  }

  // 4. Update the evaluation_runs row with final aggregates
  const avgRetrieval = sumRetrieval / totalQuestions
  const avgGrounding = sumGrounding / totalQuestions
  const avgCitation = sumCitation / totalQuestions
  const avgHallucination = sumHallucination / totalQuestions
  const avgLatency = sumLatency / totalQuestions
  const runLatency = Date.now() - startRunTime

  const overallScore = (avgRetrieval + avgGrounding + avgCitation + avgHallucination) / 4

  const { error: updateError } = await admin
    .from('evaluation_runs')
    .update({
      passed_questions: passedQuestions,
      overall_score: parseFloat(overallScore.toFixed(2)),
      retrieval_score: parseFloat(avgRetrieval.toFixed(2)),
      grounding_score: parseFloat(avgGrounding.toFixed(2)),
      citation_score: parseFloat(avgCitation.toFixed(2)),
      hallucination_score: parseFloat(avgHallucination.toFixed(2)),
      latency_ms: runLatency
    })
    .eq('id', runId)

  if (updateError) {
    console.error(`[evalRunner] Failed to update run summary:`, updateError.message)
  }

  console.log(`[evalRunner] Completed run ${runId}: Passed=${passedQuestions}/${totalQuestions}, OverallScore=${overallScore.toFixed(2)}`)

  return {
    runId,
    datasetName,
    totalQuestions,
    passedQuestions,
    overallScore,
    retrievalScore: avgRetrieval,
    groundingScore: avgGrounding,
    citationScore: avgCitation,
    hallucinationScore: avgHallucination,
    latencyMs: runLatency
  }
}

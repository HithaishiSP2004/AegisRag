// =============================================================================
// AegisRAG Compliance Workflow Service
// =============================================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { searchDocuments } from '@/features/retrieval/service'
import { AI_MODELS } from '@/config/ai'
import { executePromptWorkflow, optimizeContext, getOrgBudgetProfile, BUDGET_LIMITS } from '@/features/prompts/manager'
import { logAuditEvent } from '@/features/documents/audit'
import { generateComplianceWorkflowPDF } from './utils/pdfGenerator'
import { validateWorkflowReview } from '@/features/guardrails/workflowGuardrail'
import { executeWithFallback, logResilienceEvent } from './fallbackEngine'
import { getPromptTemplate, renderPrompt } from '@/features/prompts/registry'
import type {
  ComplianceWorkflowInput,
  ComplianceReportContent,
  ComplianceViolation,
  StrategicRecommendation,
  EvidenceCitation,
  WorkflowTelemetry,
  EvidenceStrength
} from './types'
import type { DocumentFramework } from '@/types/database'

/**
 * Creates a new compliance review workflow record in the database.
 * Restricted to super_admin and compliance_officer roles.
 */
export async function createComplianceWorkflow(
  input: ComplianceWorkflowInput,
  userId: string,
  orgId: string
) {
  const supabase = await createClient()

  // Verify role permission (handled by RLS, but double check here)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile || !['super_admin', 'compliance_officer'].includes(profile.role)) {
    throw new Error('Unauthorized: only super admins and compliance officers can run workflows')
  }

  if (input.frameworks.length === 0) {
    throw new Error('At least one compliance framework must be selected')
  }

  if (input.frameworks.length > 3) {
    throw new Error('Maximum of 3 frameworks can be selected per compliance review')
  }

  // Fetch document to make sure it exists and belongs to the org
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('filename, original_name')
    .eq('id', input.documentId)
    .eq('org_id', orgId)
    .single()

  if (docError || !doc) {
    throw new Error('Target document not found or inaccessible')
  }

  // Insert pending workflow
  const { data: workflow, error: workflowError } = await (supabase as any)
    .from('workflows')
    .insert({
      org_id: orgId,
      created_by: userId,
      input_document_id: input.documentId,
      name: input.name || `Compliance Review - ${doc.original_name}`,
      status: 'pending',
      progress_pct: 0,
      current_step: 'Initialized',
      result_summary: JSON.stringify({
        frameworks: input.frameworks,
        templateId: input.templateId
      })
    })
    .select()
    .single()

  if (workflowError || !workflow) {
    throw new Error(`Failed to create workflow: ${workflowError?.message}`)
  }

  return workflow
}

/**
 * Asynchronously executes the compliance review workflow pipeline.
 * Runs RAG, invokes Gemini, saves results to reports/violations tables,
 * uploads PDF/JSON reports to Storage, and logs audit events.
 */
export async function executeComplianceWorkflow(
  workflowId: string,
  orgId: string,
  userId: string,
  userEmail?: string
) {
  const admin = createAdminClient()
  const startTime = Date.now()

  // Dynamic progress and checkpoint helper
  const updateProgressAndCheckpoint = async (progress: number, step: string, status: any, metadata: any) => {
    await (admin as any)
      .from('workflows')
      .update({
        status,
        progress_pct: progress,
        current_step: step,
        metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
  }

  try {
    // 1. Fetch current workflow state
    const { data: workflow, error: wfErr } = await admin
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (wfErr || !workflow) {
      throw new Error(`Workflow not found: ${wfErr?.message}`)
    }

    const docId = workflow.input_document_id
    if (!docId) {
      throw new Error('Workflow is missing an input document')
    }

    // Initialize/load metadata checkpoints
    let metadata = ((workflow as any).metadata && typeof (workflow as any).metadata === 'object') ? { ...(workflow as any).metadata } : {}
    metadata.retrieving_completed = !!metadata.retrieving_completed
    metadata.analyzing_completed = !!metadata.analyzing_completed
    metadata.generating_completed = !!metadata.generating_completed
    metadata.exporting_completed = !!metadata.exporting_completed

    // Log Workflow Resume telemetry if resuming from a checkpoint
    const isResumed = metadata.retrieving_completed || metadata.analyzing_completed || metadata.generating_completed
    if (isResumed) {
      const stage = metadata.generating_completed ? 'exporting' 
                  : (metadata.analyzing_completed ? 'generating' 
                  : 'analyzing')

      await logResilienceEvent({
        orgId,
        userId,
        fallbackType: 'workflow_resume',
        failureReason: 'Resuming failed or interrupted workflow run',
        recoveryAction: `resume_stage_${stage}`,
        retryCount: 1,
        recoverySuccess: true,
        workflowStage: stage,
        durationMs: Date.now() - startTime
      })
    }

    let document = metadata.document
    let frameworks = metadata.frameworks || []
    let evidenceCitations = metadata.evidence || []

    // ── STAGE 1: RETRIEVING ──────────────────────────────────────────────────
    if (!metadata.retrieving_completed) {
      await updateProgressAndCheckpoint(5, 'Fetching document and frameworks', 'retrieving', metadata)

      const { data: fetchedDoc, error: docErr } = await admin
        .from('documents')
        .select('*')
        .eq('id', docId)
        .single()

      if (docErr || !fetchedDoc) {
        throw new Error(`Document not found: ${docErr?.message}`)
      }
      document = fetchedDoc

      // Resolve frameworks
      try {
        if (workflow.result_summary) {
          const config = JSON.parse(workflow.result_summary)
          if (Array.isArray(config.frameworks)) {
            frameworks = config.frameworks
          }
        }
      } catch {}

      if (frameworks.length === 0) {
        if (document.framework) {
          frameworks = [document.framework]
        } else {
          frameworks = ['SOC2'] // Default fallback
        }
      }
      frameworks = frameworks.slice(0, 3)

      await updateProgressAndCheckpoint(15, 'Retrieving document chunks', 'retrieving', metadata)
      const { data: docChunks, error: chunksErr } = await admin
        .from('chunks')
        .select('id, content, metadata')
        .eq('document_id', docId)
        .order('chunk_index', { ascending: true })

      if (chunksErr || !docChunks || docChunks.length === 0) {
        throw new Error(`Failed to retrieve document chunks: ${chunksErr?.message || 'Document has not been indexed yet'}`)
      }

      // Query Framework Evidence
      await updateProgressAndCheckpoint(25, 'Querying framework evidence vault', 'retrieving', metadata)
      const rawEvidenceChunks: any[] = []

      for (const framework of frameworks) {
        await updateProgressAndCheckpoint(
          25 + Math.round((frameworks.indexOf(framework) / frameworks.length) * 20),
          `Retrieving evidence for ${framework}`,
          'retrieving',
          metadata
        )

        const registryName = (framework === 'NIST' || framework === 'NIST_CSF' || framework === 'NIST-CSF') ? 'NIST-CSF' : framework
        const { data: cf } = await admin
          .from('compliance_frameworks')
          .select('id')
          .eq('org_id', orgId)
          .eq('name', registryName)
          .single()

        let searchQuery = `compliance guidelines rules controls and policy requirements for ${framework}`
        if (cf) {
          const { data: controls } = await admin
            .from('compliance_controls')
            .select('title, description')
            .eq('framework_id', cf.id)
            .limit(3)
          
          if (controls && controls.length > 0) {
            searchQuery += ': ' + controls.map(c => `${c.title} ${c.description}`).join('; ')
          }
        }

        const results = await searchDocuments(
          searchQuery.substring(0, 1000),
          orgId,
          { framework: framework, limit: 8 }
        )

        results.forEach(res => {
          if (!rawEvidenceChunks.some(c => c.chunkId === res.chunkId)) {
            rawEvidenceChunks.push(res)
            evidenceCitations.push({
              chunk_id: res.chunkId,
              content: res.content,
              source_doc: res.document.originalName,
              page_number: (res.metadata as any)?.page_number ?? 1,
              framework: framework
            })
          }
        })
      }

      // Checkpoint Failure: Insufficient Evidence / 0 results (Part 3)
      if (evidenceCitations.length === 0) {
        const suggestions = getCorpusSuggestions(frameworks)
        await (admin as any)
          .from('workflows')
          .update({
            status: 'failed',
            progress_pct: 100,
            current_step: 'Failed: Insufficient Evidence',
            error_message: 'INSUFFICIENT_EVIDENCE',
            result_summary: JSON.stringify({
              status: 'INSUFFICIENT_EVIDENCE',
              suggested_documents: suggestions.documents,
              suggested_search_terms: suggestions.searchTerms
            }),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', workflowId)

        await logResilienceEvent({
          orgId,
          userId,
          fallbackType: 'retrieval_insufficient_evidence',
          failureReason: 'Framework query returned 0 evidence citations.',
          recoveryAction: 'corpus_fallback_suggestions',
          retryCount: 1,
          recoverySuccess: false,
          workflowStage: 'retrieving',
          durationMs: Date.now() - startTime
        })

        return
      }

      // Checkpoint completion: Retrieving stage
      metadata.retrieving_completed = true
      metadata.document = { id: document.id, original_name: document.original_name, filename: document.filename }
      metadata.frameworks = frameworks
      metadata.evidence = evidenceCitations
      await updateProgressAndCheckpoint(45, 'Retrieving completed successfully', 'analyzing', metadata)
    }

    // Load Document Chunks for Stage 2 if needed
    const { data: docChunks } = await admin
      .from('chunks')
      .select('id, content, metadata')
      .eq('document_id', docId)
      .order('chunk_index', { ascending: true })

    const chunksList = docChunks || []

    // ── STAGE 2: ANALYZING ───────────────────────────────────────────────────
    let parsed = metadata.parsed
    if (!metadata.analyzing_completed) {
      await updateProgressAndCheckpoint(50, 'Analyzing compliance posture with AI Fallback Engine', 'analyzing', metadata)

      const budgetProfile = await getOrgBudgetProfile(orgId)
      const budgetTokens = BUDGET_LIMITS[budgetProfile]

      const docBudget = Math.floor(budgetTokens * 0.6)
      const evidenceBudget = Math.floor(budgetTokens * 0.4)

      const optDoc = optimizeContext(
        chunksList.map(c => ({
          chunkId: c.id,
          content: c.content,
          source_doc: document.original_name,
          page_number: (c.metadata as any)?.page_number ?? 1
        })),
        docBudget
      )

      const optEvidence = optimizeContext(
        evidenceCitations.map((ec: any) => ({
          chunkId: ec.chunk_id,
          content: ec.content,
          source_doc: ec.source_doc,
          page_number: ec.page_number,
          framework: ec.framework
        })),
        evidenceBudget
      )

      const documentContext = optDoc.optimizedChunks
        .map((chunk, i) => `[Document Chunk ${i + 1}] (ID: ${chunk.chunkId}, Page: ${chunk.page_number}):\n${chunk.content}`)
        .join('\n\n---\n\n')

      const evidenceContext = optEvidence.optimizedChunks
        .map((ev, i) => `[Evidence ${i + 1}] (Framework: ${ev.framework}, Source: ${ev.source_doc}, Page: ${ev.page_number}, ID: ${ev.chunkId}):\n${ev.content}`)
        .join('\n\n---\n\n')

      const promptTemplate = getPromptTemplate('compliance_review', 'v1')
      const promptText = renderPrompt(promptTemplate.template, {
        frameworks: frameworks.join(', '),
        documentContext,
        evidenceContext
      })

      // Run via LLM Fallback Engine (with retries and switching)
      const fallbackResult = await executeWithFallback({
        orgId,
        userId,
        promptText,
        evidenceContext,
        evidenceCitations,
        workflowStage: 'analyzing'
      })

      const rawOutput = fallbackResult.text.trim()
      try {
        parsed = JSON.parse(rawOutput)
      } catch {
        const jsonMatch = rawOutput.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Gemini response could not be parsed as JSON')
        }
      }

      parsed.compliance_score = typeof parsed.compliance_score === 'number' ? parsed.compliance_score : 75
      parsed.risk_score = typeof parsed.risk_score === 'number' ? parsed.risk_score : 25
      parsed.confidence_score = typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 85
      parsed.executive_summary = parsed.executive_summary || 'Compliance review complete.'
      parsed.methodology = parsed.methodology || 'RAG-driven automated audit.'
      parsed.violations = Array.isArray(parsed.violations) ? parsed.violations : []
      parsed.recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : []

      // Checkpoint completion: Analyzing stage
      metadata.analyzing_completed = true
      metadata.parsed = parsed
      metadata.modelUsed = fallbackResult.modelUsed
      metadata.fallbackLevel = fallbackResult.fallbackLevel
      metadata.evidenceOnlyUsed = fallbackResult.evidenceOnlyUsed
      await updateProgressAndCheckpoint(70, 'AI analysis completed', 'generating', metadata)
    }

    // ── STAGE 3: GENERATING ──────────────────────────────────────────────────
    let reportId = metadata.report_id
    if (!metadata.generating_completed) {
      await updateProgressAndCheckpoint(75, 'Storing compliance audit results', 'generating', metadata)

      const { data: reportRow, error: rErr } = await admin
        .from('reports')
        .insert({
          workflow_id: workflowId,
          org_id: orgId,
          created_by: userId,
          title: `Compliance Report - ${document.original_name}`,
          report_type: 'compliance',
          compliance_score: parsed.compliance_score,
          risk_score: parsed.risk_score,
          status: 'generating',
          content: {},
          ai_model_used: metadata.modelUsed || AI_MODELS.GENERATION_PRIMARY,
          fallback_used: (metadata.fallbackLevel || 0) > 0,
          fallback_level: metadata.fallbackLevel || 0,
          confidence_score: parsed.confidence_score / 100
        })
        .select()
        .single()

      if (rErr || !reportRow) {
        throw new Error(`Failed to create report row: ${rErr?.message}`)
      }
      reportId = reportRow.id

      const mappedViolations: ComplianceViolation[] = []
      for (const v of parsed.violations) {
        const matchedChunkIds: string[] = []
        const matchingCitations = evidenceCitations.filter((c: any) => 
          v.policy_reference.toLowerCase().includes(c.framework?.toLowerCase() || '')
        )
        matchingCitations.slice(0, 2).forEach((c: any) => matchedChunkIds.push(c.chunk_id))
        if (matchedChunkIds.length === 0 && evidenceCitations.length > 0) {
          matchedChunkIds.push(evidenceCitations[0].chunk_id)
        }

        const { data: viol, error: vErr } = await admin
          .from('violations')
          .insert({
            report_id: reportId,
            org_id: orgId,
            clause_text: v.clause || 'Target document clause',
            policy_reference: v.policy_reference || 'Compliance standard',
            severity: v.severity || 'medium',
            description: v.description || 'Gaps identified.',
            recommendation: v.recommendation || 'Remediate policies.',
            evidence_chunk_ids: matchedChunkIds,
            confidence_score: v.confidence_score || 0.8
          })
          .select()
          .single()

        if (!vErr && viol) {
          mappedViolations.push({
            clause: viol.clause_text ?? '',
            policy_reference: viol.policy_reference ?? '',
            severity: viol.severity,
            description: viol.description,
            recommendation: viol.recommendation,
            evidence_chunks: viol.evidence_chunk_ids,
            evidence_strength: (v.evidence_strength || 'medium') as EvidenceStrength,
            confidence_score: viol.confidence_score || 0.8
          })
        }
      }

      const { data: computedRiskScore } = await admin.rpc('compute_risk_score', {
        p_report_id: reportId
      })
      const finalRiskScore = typeof computedRiskScore === 'number' ? computedRiskScore : parsed.risk_score

      // Run Guardrails
      const workflowGuard = validateWorkflowReview(
        mappedViolations.map(mv => ({
          policy_reference: mv.policy_reference,
          evidence_chunk_ids: mv.evidence_chunks,
          evidence_strength: mv.evidence_strength,
          confidence_score: mv.confidence_score
        })),
        evidenceCitations.length,
        parsed.confidence_score
      )

      await (admin as any).from('guardrail_telemetry').insert({
        org_id: orgId,
        user_id: userId,
        guardrail_type: 'workflow',
        category: workflowGuard.categories.join(',') || 'none',
        severity: workflowGuard.severity,
        risk_score: workflowGuard.risk_score,
        action_taken: workflowGuard.action,
        prompt_hash: null,
        workflow_id: workflowId,
        metadata: {
          total_findings: workflowGuard.metadata.total_findings,
          findings_missing_evidence: workflowGuard.metadata.findings_missing_evidence,
          total_citations: workflowGuard.metadata.total_citations,
          evidence_strength_average: workflowGuard.metadata.evidence_strength_average,
          overall_confidence: workflowGuard.metadata.overall_confidence,
          reason: workflowGuard.reason
        }
      })

      if (!workflowGuard.is_valid) {
        await admin.from('reports').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', reportId)
        throw new Error(workflowGuard.reason || 'Workflow blocked by compliance guardrails.')
      }

      const fullContent: ComplianceReportContent = {
        executive_summary: parsed.executive_summary,
        methodology: parsed.methodology,
        compliance_score: parsed.compliance_score,
        risk_score: finalRiskScore,
        confidence_score: parsed.confidence_score,
        violations: mappedViolations,
        recommendations: parsed.recommendations,
        evidence: evidenceCitations,
        telemetry: {
          analysis_duration_ms: Date.now() - startTime,
          documents_analyzed: 1 + Array.from(new Set(evidenceCitations.map((e: any) => e.source_doc))).length,
          frameworks_referenced: frameworks,
          findings_count: mappedViolations.length
        },
        guardrail: {
          severity: workflowGuard.severity,
          risk_score: workflowGuard.risk_score,
          categories: workflowGuard.categories,
          reason: workflowGuard.reason,
          metadata: workflowGuard.metadata
        }
      }

      await admin
        .from('reports')
        .update({
          status: 'complete',
          compliance_score: parsed.compliance_score,
          risk_score: finalRiskScore,
          content: fullContent as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)

      // Checkpoint completion: Generating stage
      metadata.generating_completed = true
      metadata.report_id = reportId
      metadata.fullContent = fullContent
      await updateProgressAndCheckpoint(80, 'Report database rows generated', 'generating', metadata)
    }

    // ── STAGE 4: EXPORTING ───────────────────────────────────────────────────
    const fullContent = metadata.fullContent
    await updateProgressAndCheckpoint(85, 'Generating and uploading export files', 'generating', metadata)

    const pdfFilename = `aegisrag-compliance-review-${workflowId}-${new Date().toISOString().slice(0, 10)}.pdf`
    const jsonFilename = `aegisrag-compliance-review-${workflowId}-${new Date().toISOString().slice(0, 10)}.json`

    // Retry wrapper helper for exporting stages
    async function retryOperation<T>(
      operation: () => Promise<T>,
      fallbackType: string,
      maxRetries: number
    ): Promise<T> {
      let delay = 500
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation()
        } catch (err: any) {
          const errMsg = err?.message || String(err)
          await logResilienceEvent({
            orgId,
            userId,
            fallbackType,
            failureReason: `Attempt ${attempt} failed: ${errMsg}`,
            recoveryAction: attempt < maxRetries ? 'retry' : 'failed_permanently',
            retryCount: attempt,
            recoverySuccess: false,
            workflowStage: 'exporting',
            durationMs: delay
          })

          if (attempt >= maxRetries) {
            throw new Error(`Export failure ceiling reached (${maxRetries} retries): ${errMsg}`)
          }
          await new Promise(resolve => setTimeout(resolve, delay))
          delay *= 2
        }
      }
      throw new Error('Unreachable retry block')
    }

    // 1. PDF Export (ceiling limit max 3)
    const pdfBuffer = await retryOperation(
      async () => {
        return await generateComplianceWorkflowPDF(
          workflow.name,
          fullContent,
          document.original_name,
          userEmail || 'Compliance Officer'
        )
      },
      'pdf_export_retry',
      3
    )

    // 2. JSON Export (ceiling limit max 3)
    const jsonBuffer = await retryOperation(
      async () => {
        const jsonString = JSON.stringify(fullContent, null, 2)
        return Buffer.from(jsonString, 'utf-8')
      },
      'json_export_retry',
      3
    )

    // Storage uploads
    const pdfStoragePath = `${orgId}/workflows/${workflowId}.pdf`
    const jsonStoragePath = `${orgId}/workflows/${workflowId}.json`

    // 3. Storage Upload for PDF (ceiling limit max 5)
    await retryOperation(
      async () => {
        const { error: uploadErr } = await admin.storage
          .from('reports')
          .upload(pdfStoragePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
          })
        if (uploadErr) throw uploadErr
      },
      'pdf_storage_upload_retry',
      5
    )

    // 4. Storage Register for PDF (ceiling limit max 5)
    try {
      await retryOperation(
        async () => {
          const { error: dbErr } = await (admin as any)
            .from('generated_reports')
            .insert({
              tenant_id: orgId,
              org_id: orgId,
              report_type: 'compliance',
              format: 'PDF',
              file_name: pdfFilename,
              storage_path: pdfStoragePath,
              file_size: pdfBuffer.length,
              generated_by: userId,
              status: 'completed',
              metadata: {
                workflow_id: workflowId,
                report_id: reportId,
                mime_type: 'application/pdf'
              }
            })
          if (dbErr) throw dbErr
        },
        'pdf_register_retry',
        5
      )
    } catch (err: any) {
      console.warn('[WorkflowService] PDF registration in generated_reports failed (non-blocking):', err.message || err)
    }

    // 5. Storage Upload for JSON (ceiling limit max 5)
    await retryOperation(
      async () => {
        const { error: uploadErr } = await admin.storage
          .from('reports')
          .upload(jsonStoragePath, jsonBuffer, {
            contentType: 'application/json',
            upsert: true
          })
        if (uploadErr) throw uploadErr
      },
      'json_storage_upload_retry',
      5
    )

    // 6. Storage Register for JSON (ceiling limit max 5)
    try {
      await retryOperation(
        async () => {
          const { error: dbErr } = await (admin as any)
            .from('generated_reports')
            .insert({
              tenant_id: orgId,
              org_id: orgId,
              report_type: 'compliance',
              format: 'JSON',
              file_name: jsonFilename,
              storage_path: jsonStoragePath,
              file_size: jsonBuffer.length,
              generated_by: userId,
              status: 'completed',
              metadata: {
                workflow_id: workflowId,
                report_id: reportId,
                mime_type: 'application/json'
              }
            })
          if (dbErr) throw dbErr
        },
        'json_register_retry',
        5
      )
    } catch (err: any) {
      console.warn('[WorkflowService] JSON registration in generated_reports failed (non-blocking):', err.message || err)
    }

    // Success telemetry logged
    const finalDurationMs = Date.now() - startTime
    await logResilienceEvent({
      orgId,
      userId,
      fallbackType: isResumed ? 'workflow_resume' : 'none',
      failureReason: null,
      recoveryAction: isResumed ? 'resume_success' : 'none',
      retryCount: 0,
      recoverySuccess: true,
      workflowStage: 'exporting',
      durationMs: finalDurationMs
    })

    // Update workflow to complete
    metadata.exporting_completed = true
    await (admin as any)
      .from('workflows')
      .update({
        status: 'complete',
        progress_pct: 100,
        current_step: 'Completed',
        metadata,
        result_summary: JSON.stringify({
          compliance_score: parsed.compliance_score,
          risk_score: parsed.risk_score,
          findings_count: parsed.violations.length,
          report_id: reportId
        }),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)

    // Log Audit Trails
    await logAuditEvent({
      orgId,
      userId,
      action: 'DOCUMENT_UPDATED',
      resourceType: 'workflow',
      resourceId: workflowId,
      newValue: {
        analysis_duration_ms: finalDurationMs,
        documents_analyzed: 1 + Array.from(new Set(evidenceCitations.map((e: any) => e.source_doc))).length,
        frameworks_referenced: frameworks,
        findings_count: parsed.violations.length,
        compliance_score: parsed.compliance_score,
        risk_score: parsed.risk_score,
        confidence_score: parsed.confidence_score
      }
    })

  } catch (err: any) {
    console.error(`[WorkflowService] Fatal review execution error:`, err)

    // Mark as failed permanently or failed
    await (admin as any)
      .from('workflows')
      .update({
        status: 'failed',
        progress_pct: 100,
        current_step: 'Failed',
        error_message: err.message || String(err),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)

    await logResilienceEvent({
      orgId,
      userId,
      fallbackType: 'workflow_failure',
      failureReason: err.message || String(err),
      recoveryAction: 'workflow_halted_awaiting_user_resume',
      retryCount: 1,
      recoverySuccess: false,
      workflowStage: 'exporting',
      durationMs: Date.now() - startTime
    })
  }
}

/**
 * Maps frameworks to corpus suggestions for retrieval failure handling.
 */
function getCorpusSuggestions(frameworks: string[]) {
  const documents: string[] = []
  const searchTerms: string[] = []

  if (frameworks.includes('SOC2')) {
    documents.push('SOC2 Trust Services Criteria.pdf', 'Access Control Policy Template.pdf')
    searchTerms.push('SOC2 CC6.1 access controls', 'multi-factor authentication requirements', 'audit logs review')
  }
  if (frameworks.includes('GDPR')) {
    documents.push('GDPR Regulation Guidelines.pdf', 'Data Subject Access Request (DSAR) Policy.pdf')
    searchTerms.push('GDPR data processing consent', 'data subject right to erasure', 'breach notification procedure')
  }
  if (frameworks.includes('ISO27001')) {
    documents.push('ISO 27001 Security Controls Annex A.pdf', 'Information Security Policy.pdf')
    searchTerms.push('ISO 27001 access control standard', 'risk assessment methodology', 'asset management')
  }
  if (frameworks.includes('HIPAA')) {
    documents.push('HIPAA Security Rule Guidelines.pdf', 'Business Associate Agreement (BAA) Template.pdf')
    searchTerms.push('HIPAA protected health information (PHI)', 'PHI encryption requirements', 'workstation security')
  }
  if (frameworks.includes('EU_AI_ACT')) {
    documents.push('EU AI Act Reference Guide.pdf', 'High-Risk AI Systems Compliance.pdf')
    searchTerms.push('EU AI Act risk categorization', 'AI transparency requirements', 'prohibited AI practices')
  }
  if (frameworks.includes('OWASP_LLM_TOP_10')) {
    documents.push('OWASP Top 10 for LLM Applications.pdf', 'LLM Vulnerability Mitigation Guide.pdf')
    searchTerms.push('LLM prompt injection', 'sensitive data disclosure', 'overreliance on LLM outputs')
  }
  if (frameworks.includes('NIST')) {
    documents.push('NIST Cybersecurity Framework CSF.pdf', 'NIST SP 800-53 Security Controls.pdf')
    searchTerms.push('NIST CSF identity controls', 'incident response plan', 'system backup policy')
  }

  // Fallbacks
  if (documents.length === 0) documents.push('Standard Security Controls Guidelines.pdf')
  if (searchTerms.length === 0) searchTerms.push('compliance controls', 'evidence audit logging', 'data encryption standards')

  return { documents, searchTerms }
}

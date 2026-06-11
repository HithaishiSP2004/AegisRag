export interface WorkflowGuardViolation {
  policy_reference: string
  evidence_chunk_ids: string[]
  evidence_strength?: 'high' | 'medium' | 'low'
  confidence_score?: number
}

export interface WorkflowGuardResult {
  is_valid: boolean // true if ALLOW or WARN, false if BLOCK
  severity: 'ALLOW' | 'WARN' | 'BLOCK'
  action: 'allowed' | 'warned' | 'blocked'
  risk_score: number // 0-100
  categories: string[]
  reason?: string
  metadata: {
    total_findings: number
    findings_missing_evidence: number
    total_citations: number
    evidence_strength_average: 'Low' | 'Medium' | 'High'
    overall_confidence: number
  }
}

/**
 * Asserts workflow safety and compliance constraints on a generated compliance review before saving.
 * Enforces evidence mapping: blocks report generation if findings exist without mapped evidence.
 */
export function validateWorkflowReview(
  violations: WorkflowGuardViolation[],
  citationsCount: number,
  confidenceScore: number // Expected 0-100 or 0.0-1.0
): WorkflowGuardResult {
  const categories: string[] = []
  let severity: 'ALLOW' | 'WARN' | 'BLOCK' = 'ALLOW'
  let reason: string | undefined = undefined

  // Normalize confidence score to 0-100 range
  const normalizedConfidence = confidenceScore <= 1.0 
    ? Math.round(confidenceScore * 100) 
    : Math.round(confidenceScore)

  const totalFindings = violations.length
  let findingsMissingEvidence = 0
  let evidenceStrengthSum = 0

  for (const v of violations) {
    if (!v.evidence_chunk_ids || v.evidence_chunk_ids.length === 0) {
      findingsMissingEvidence++
    }

    const strength = v.evidence_strength || 'medium'
    if (strength === 'high') evidenceStrengthSum += 3
    else if (strength === 'medium') evidenceStrengthSum += 2
    else evidenceStrengthSum += 1
  }

  // Calculate average evidence strength
  const avgStrengthNum = totalFindings > 0 
    ? evidenceStrengthSum / totalFindings 
    : 3.0
  
  let averageStrength: 'Low' | 'Medium' | 'High' = 'High'
  if (avgStrengthNum < 1.5) averageStrength = 'Low'
  else if (avgStrengthNum < 2.5) averageStrength = 'Medium'

  // Rules:
  // 1. If findings exist without evidence -> BLOCK report generation
  if (findingsMissingEvidence > 0) {
    severity = 'BLOCK'
    categories.push('unsupported_findings')
    reason = `Blocked report generation: ${findingsMissingEvidence} finding(s) lack mapped evidence in the RAG source set.`
  }

  // 2. If citations are missing -> WARN
  if (citationsCount === 0 && totalFindings > 0 && severity !== 'BLOCK') {
    severity = 'WARN'
    categories.push('missing_citations')
    reason = 'Warning: Report contains findings but citation counts are zero.'
  }

  // 3. If confidence score is too low (< 70%) -> WARN
  if (normalizedConfidence < 70 && severity !== 'BLOCK') {
    severity = 'WARN'
    categories.push('low_confidence')
    reason = reason 
      ? `${reason} Also, report confidence is low (${normalizedConfidence}%).` 
      : `Warning: Compliance review confidence score is low (${normalizedConfidence}%).`
  }

  // Calculate risk score (0-100)
  let riskScore = 0
  if (severity === 'BLOCK') {
    riskScore = Math.max(85, 40 + (findingsMissingEvidence * 15))
    riskScore = Math.min(100, riskScore)
  } else if (severity === 'WARN') {
    riskScore = Math.max(45, 100 - normalizedConfidence)
  } else {
    riskScore = Math.round(Math.max(0, 100 - normalizedConfidence))
  }

  const action = severity === 'BLOCK' ? 'blocked' : (severity === 'WARN' ? 'warned' : 'allowed')
  const isValid = severity !== 'BLOCK'

  return {
    is_valid: isValid,
    severity,
    action,
    risk_score: riskScore,
    categories,
    reason,
    metadata: {
      total_findings: totalFindings,
      findings_missing_evidence: findingsMissingEvidence,
      total_citations: citationsCount,
      evidence_strength_average: averageStrength,
      overall_confidence: normalizedConfidence
    }
  }
}

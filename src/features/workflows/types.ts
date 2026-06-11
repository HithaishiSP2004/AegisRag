// =============================================================================
// AegisRAG Compliance Workflow Types
// =============================================================================

import type { DocumentFramework, ViolationSeverity } from '@/types/database'

export type EvidenceStrength = 'high' | 'medium' | 'low'

export interface ComplianceWorkflowInput {
  documentId: string
  frameworks: DocumentFramework[]
  name: string
  templateId?: string
}

export interface ComplianceViolation {
  clause: string
  policy_reference: string
  severity: ViolationSeverity
  description: string
  recommendation: string | null
  evidence_chunks: string[] // Array of chunk UUIDs
  evidence_strength: EvidenceStrength // High | Medium | Low
  confidence_score: number
}

export interface StrategicRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low'
  action: string
  rationale: string
}

export interface EvidenceCitation {
  chunk_id: string
  content: string
  source_doc: string
  page_number: number
  framework: string | null
}

export interface WorkflowTelemetry {
  analysis_duration_ms: number
  documents_analyzed: number
  frameworks_referenced: string[]
  findings_count: number
}

export interface ComplianceReportContent {
  executive_summary: string
  methodology: string
  compliance_score: number
  risk_score: number
  confidence_score: number // Overall Confidence: e.g. 89%
  violations: ComplianceViolation[]
  recommendations: StrategicRecommendation[]
  evidence: EvidenceCitation[]
  telemetry: WorkflowTelemetry
  guardrail?: {
    severity: 'ALLOW' | 'WARN' | 'BLOCK'
    risk_score: number
    categories: string[]
    reason?: string
    metadata: any
  }
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  frameworks: DocumentFramework[]
  focusPrompt: string
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'soc2_readiness',
    name: 'SOC2 Readiness Review',
    description: 'Evaluates systems access controls, audit logs, and operational security procedures against SOC 2 Trust Services Criteria.',
    frameworks: ['SOC2'],
    focusPrompt: 'Evaluate systems access controls, multi-factor authentication, audit logs, and security procedures.'
  },
  {
    id: 'gdpr_compliance',
    name: 'GDPR Compliance Review',
    description: 'Evaluates data processing principles, privacy rights, and breach notification procedures under GDPR rules.',
    frameworks: ['GDPR'],
    focusPrompt: 'Evaluate data processing lawfulness, data subject consent, right to erasure, privacy by design, and breach notifications.'
  },
  {
    id: 'vendor_risk',
    name: 'Vendor Risk Assessment',
    description: 'Reviews data confidentiality, security certifications, and SLA controls against SOC2 and ISO27001.',
    frameworks: ['SOC2', 'ISO27001'],
    focusPrompt: 'Evaluate vendor data confidentiality, liability limits, security certifications (ISO 27001/SOC 2), and service level agreements.'
  },
  {
    id: 'ai_governance',
    name: 'AI Governance Assessment',
    description: 'Audits LLM safety gates, training data, and alignment policies against EU AI Act and OWASP Top 10 guidelines.',
    frameworks: ['EU_AI_ACT', 'OWASP_LLM_TOP_10'],
    focusPrompt: 'Evaluate model safety bounds, training data privacy, vulnerability gating (prompt injection/jailbreaking), and compliance with the EU AI Act.'
  },
  {
    id: 'policy_gap',
    name: 'Policy Gap Analysis',
    description: 'Cross-checks documents against SOC2, ISO27001, and NIST frameworks to locate outstanding security posture gaps.',
    frameworks: ['SOC2', 'ISO27001', 'NIST'],
    focusPrompt: 'Compare internal documents against ISO 27001 Annex A policies, NIST CSF identity controls, and SOC 2 security requirements.'
  }
]

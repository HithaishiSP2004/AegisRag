// =============================================================================
// Sprint 5B: Compliance Engine
// src/features/security/engine/complianceEngine.ts
//
// Governance automation: identifies controls lacking evidence, detects overdue
// reviews, generates compliance findings and remediation recommendations.
// Can escalate CRITICAL findings to security alerts (via API call).
// =============================================================================

import type { FindingSeverity } from '@/types/database'

export interface ComplianceFinding {
  id:              string
  control_id:      string
  control_ref:     string   // human-readable e.g. "CC6.1"
  framework:       string
  title:           string
  finding_type:    'missing_evidence' | 'overdue_review' | 'rejected_review' | 'no_review'
  severity:        FindingSeverity
  description:     string
  recommendation:  string
  days_overdue?:   number
}

export interface ControlSnapshot {
  id:              string
  control_id:      string   // e.g. "CC6.1"
  title:           string
  framework:       string
  category:        string
  severity:        FindingSeverity
  evidence_count:  number
  last_review?:    { status: string; review_date: string | null; next_review_date: string | null }
}

// ── Finding generators ────────────────────────────────────────

export function findMissingEvidence(controls: ControlSnapshot[]): ComplianceFinding[] {
  return controls
    .filter((c) => c.evidence_count === 0)
    .map((c) => ({
      id:           `missing-${c.id}`,
      control_id:   c.id,
      control_ref:  c.control_id,
      framework:    c.framework,
      title:        `No evidence linked to ${c.control_id}: ${c.title}`,
      finding_type: 'missing_evidence' as const,
      severity:     c.severity,
      description:  `Control "${c.control_id}" in the ${c.framework} framework has no linked evidence records. This leaves the control unverifiable for audit purposes.`,
      recommendation: `Attach at least one evidence record from audit_logs, security_alerts, or retrieval_evals to control ${c.control_id}.`,
    }))
}

export function findOverdueReviews(controls: ControlSnapshot[]): ComplianceFinding[] {
  const today = new Date()
  return controls
    .filter((c) => {
      if (!c.last_review?.next_review_date) return false
      if (!['pending', 'needs_followup'].includes(c.last_review.status)) return false
      return new Date(c.last_review.next_review_date) < today
    })
    .map((c) => {
      const due     = new Date(c.last_review!.next_review_date!)
      const days    = Math.ceil((today.getTime() - due.getTime()) / 86_400_000)
      const sev: FindingSeverity = days > 60 ? 'critical' : days > 30 ? 'high' : days > 14 ? 'medium' : 'low'
      return {
        id:           `overdue-${c.id}`,
        control_id:   c.id,
        control_ref:  c.control_id,
        framework:    c.framework,
        title:        `Review overdue by ${days}d — ${c.control_id}: ${c.title}`,
        finding_type: 'overdue_review' as const,
        severity:     sev,
        description:  `The review for control "${c.control_id}" was due on ${c.last_review!.next_review_date}. It is now ${days} day(s) overdue.`,
        recommendation: `Schedule and complete a review for ${c.control_id} immediately. Update next_review_date after completion.`,
        days_overdue: days,
      }
    })
}

export function findRejectedReviews(controls: ControlSnapshot[]): ComplianceFinding[] {
  return controls
    .filter((c) => c.last_review?.status === 'rejected')
    .map((c) => ({
      id:           `rejected-${c.id}`,
      control_id:   c.id,
      control_ref:  c.control_id,
      framework:    c.framework,
      title:        `Rejected review for ${c.control_id}: ${c.title}`,
      finding_type: 'rejected_review' as const,
      severity:     'high' as FindingSeverity,
      description:  `The most recent review for control "${c.control_id}" was rejected. Remediation is required before the next audit cycle.`,
      recommendation: `Address the reviewer's concerns for ${c.control_id} and submit a new review with supporting evidence.`,
    }))
}

export function findNoReview(controls: ControlSnapshot[]): ComplianceFinding[] {
  return controls
    .filter((c) => !c.last_review)
    .map((c) => ({
      id:           `no-review-${c.id}`,
      control_id:   c.id,
      control_ref:  c.control_id,
      framework:    c.framework,
      title:        `No review ever conducted for ${c.control_id}: ${c.title}`,
      finding_type: 'no_review' as const,
      severity:     c.severity,
      description:  `Control "${c.control_id}" has never been formally reviewed. This is a gap in the compliance posture.`,
      recommendation: `Create and complete an initial review for ${c.control_id} to establish a baseline compliance record.`,
    }))
}

// ── Main engine entry point ───────────────────────────────────

export function runComplianceEngine(controls: ControlSnapshot[]): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [
    ...findMissingEvidence(controls),
    ...findOverdueReviews(controls),
    ...findRejectedReviews(controls),
    ...findNoReview(controls),
  ]

  // Sort: critical first, then high, medium, low
  const order: Record<FindingSeverity, number> = { critical:0, high:1, medium:2, low:3 }
  return findings.sort((a, b) => order[a.severity] - order[b.severity])
}

export function getCriticalFindings(findings: ComplianceFinding[]): ComplianceFinding[] {
  return findings.filter((f) => f.severity === 'critical')
}

// ── Framework score ───────────────────────────────────────────

export function computeFrameworkScore(controls: ControlSnapshot[]): number {
  if (controls.length === 0) return 0
  const withEvidence = controls.filter((c) => c.evidence_count > 0).length
  const withApproved = controls.filter((c) => c.last_review?.status === 'approved').length
  const evidenceScore = (withEvidence / controls.length) * 60
  const reviewScore   = (withApproved  / controls.length) * 40
  return Math.round(evidenceScore + reviewScore)
}

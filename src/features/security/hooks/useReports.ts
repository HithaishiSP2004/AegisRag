'use client'
// useReports — Hook to load executive, compliance, security, retrieval, and governance reports.
import { useState, useCallback, useEffect } from 'react'

export interface TrendRow {
  trend_date:       string
  query_count:      number
  avg_groundedness: number
  hallucinations:   number
  alert_count:      number
  token_count:      number
}

export interface ExecutiveReportData {
  days: number
  riskScore: {
    risk_score:          number
    risk_level:          string
    open_alerts:         number
    critical_alerts:     number
    hallucinations:      number
    retrieval_failures:  number
    failed_reviews:      number
    unauthorized_events: number
  } | null
  compliance: {
    total_frameworks:          number
    total_controls:            number
    controls_with_evidence:    number
    controls_missing_evidence: number
    reviews_pending:           number
    reviews_overdue:           number
    reviews_approved:          number
  } | null
  retrieval: {
    total_queries:          number
    hybrid_pct:             number
    vector_pct:             number
    keyword_pct:            number
    avg_groundedness:       number
    avg_citation_hit_rate:  number
    hallucination_rate_pct: number
    avg_total_latency_ms:   number
    avg_vector_latency_ms:  number
    avg_keyword_latency_ms: number
    avg_chunk_count:        number
  } | null
  security: {
    open_alerts:          number
    critical_open:        number
    high_open:            number
    alerts_last_n_days:   number
    resolved_last_n_days: number
    risk_flags_open:      number
    avg_resolve_hours:    number | null
  } | null
  trends: TrendRow[]
}

export interface ComplianceReportData {
  days: number
  stats: {
    total_frameworks:          number
    total_controls:            number
    controls_with_evidence:    number
    controls_missing_evidence: number
    reviews_pending:           number
    reviews_overdue:           number
    reviews_approved:          number
  } | null
  frameworks: Array<{
    framework_id:       string
    framework_name:     string
    total_controls:     number
    controls_with_evidence: number
    reviews_pending:    number
    reviews_approved:   number
    coverage_pct:       number
  }>
  recentReviews: Array<{
    id:               string
    status:           string
    notes:            string | null
    review_date:      string | null
    next_review_date: string | null
    created_at:       string
    compliance_controls: {
      control_id: string
      title:      string
      severity:   string
      compliance_frameworks: { name: string }
    }
  }>
  remediationQueue: Array<{
    id:          string
    control_id:  string
    title:       string
    category:    string
    severity:    string
    compliance_frameworks: { name: string }
  }>
}

export interface SecurityReportData {
  days: number
  kpi: {
    open_alerts:          number
    critical_open:        number
    high_open:            number
    alerts_last_n_days:   number
    resolved_last_n_days: number
    risk_flags_open:      number
    avg_resolve_hours:    number | null
  } | null
  eventsSummary: {
    total: number
    blocked: number
    severities: Record<string, number>
    types: Record<string, number>
  }
  alerts: Array<{
    id:          string
    title:       string
    severity:    string
    status:      string
    category:    string
    created_at:  string
    resolved_at: string | null
  }>
  mismatches: Array<{
    id:                   string
    declared_sensitivity:  string
    detected_sensitivity:  string
    risk_score:            number
    mismatch_detected:     boolean
    created_at:            string
    documents: { filename: string }
  }>
  recentEvents: Array<{
    id:          string
    event_type:  string
    severity:    string
    description: string | null
    blocked:     boolean
    created_at:  string
  }>
}

export interface RetrievalReportData {
  days: number
  stats: {
    total_queries:          number
    hybrid_pct:             number
    vector_pct:             number
    keyword_pct:            number
    avg_groundedness:       number
    avg_citation_hit_rate:  number
    hallucination_rate_pct: number
    avg_total_latency_ms:   number
    avg_vector_latency_ms:  number
    avg_keyword_latency_ms: number
    avg_chunk_count:        number
  } | null
  recentEvals: Array<{
    id:                 string
    query_text:         string
    retrieval_mode:     string
    chunk_count:        number
    total_latency_ms:   number
    groundedness_score: number | null
    citation_hit_rate:  number | null
    hallucination_flag: boolean
    eval_notes:         string | null
    created_at:         string
  }>
}

export interface GovernanceReportData {
  days: number
  tokenStats: {
    total_prompt_tokens:     number
    total_completion_tokens: number
    total_tokens_all:        number
    avg_latency_ms:          number
    fallback_rate_pct:       number
    total_calls:             number
    failed_calls:            number
  } | null
  modelBreakdown: Array<{
    model:             string
    calls:             number
    total_tokens:      number
    prompt_tokens:     number
    completion_tokens: number
    avg_latency_ms:    number
    failure_count:     number
    fallback_count:    number
  }>
  auditSummary: Record<string, number>
  auditCount: number
  violations?: Array<{
    id: string
    category: string
    severity: string
    action_taken: string
    risk_score: number
    created_at: string
  }>
}

export function useReports(reportType: 'executive' | 'compliance' | 'security' | 'retrieval' | 'governance', days = 30) {
  const [data,    setData]    = useState<ExecutiveReportData | ComplianceReportData | SecurityReportData | RetrievalReportData | GovernanceReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (d = days) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/${reportType}?days=${d}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load report data')
        return
      }
      setData(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [reportType, days])

  useEffect(() => {
    setData(null)
    Promise.resolve().then(() => load())
  }, [load])

  return { data, loading, error, refetch: load }
}

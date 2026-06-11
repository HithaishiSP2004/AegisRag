'use client'
// Sprint 5B: useComplianceDashboard — aggregates stats + risk score
import { useState, useEffect, useCallback } from 'react'

export interface ComplianceStats {
  total_frameworks:          number
  total_controls:            number
  controls_with_evidence:    number
  controls_missing_evidence: number
  reviews_pending:           number
  reviews_overdue:           number
  reviews_approved:          number
}

export interface RiskScoreSummary {
  risk_score:          number
  risk_level:          string
  open_alerts:         number
  critical_alerts:     number
  hallucinations:      number
  retrieval_failures:  number
  failed_reviews:      number
  unauthorized_events: number
}

export interface TableCounts {
  documents: number
  reports: number
  workflows: number
  violations: number
  audit_logs: number
}

interface DashboardState {
  stats:    ComplianceStats | null
  riskScore: RiskScoreSummary | null
  counts:   TableCounts | null
  loading:  boolean
  error:    string | null
}

export function useComplianceDashboard() {
  const [state, setState] = useState<DashboardState>({
    stats: null, riskScore: null, counts: null, loading: true, error: null,
  })

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/compliance/stats')
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
      const json = await res.json()
      setState({ stats: json.stats, riskScore: json.riskScore, counts: json.counts, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { ...state, refresh: load }
}

'use client'
// Sprint 5B: useRiskScore
import { useState, useEffect, useCallback } from 'react'
import type { RiskLevel } from '@/types/database'

export interface RiskScoreData {
  db: {
    risk_score:          number
    risk_level:          RiskLevel
    open_alerts:         number
    critical_alerts:     number
    hallucinations:      number
    retrieval_failures:  number
    failed_reviews:      number
    unauthorized_events: number
  } | null
  engine: {
    score:      number
    level:      RiskLevel
    breakdown:  Record<string, number>
    max_signal: string
  } | null
}

interface State extends RiskScoreData {
  loading: boolean
  error:   string | null
}

export function useRiskScore() {
  const [state, setState] = useState<State>({ db: null, engine: null, loading: true, error: null })

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/security/risk-score')
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
      const json: RiskScoreData = await res.json()
      setState({ ...json, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { ...state, refresh: load }
}

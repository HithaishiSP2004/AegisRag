'use client'
// useGovernance — AI governance metrics (models, tokens, latency, fallbacks)
import { useState, useCallback, useEffect } from 'react'

export interface ModelStat {
  model:             string
  calls:             number
  total_tokens:      number
  prompt_tokens:     number
  completion_tokens: number
  avg_latency_ms:    number
  failure_count:     number
  fallback_count:    number
}

export interface TokenStats {
  total_prompt_tokens:     number
  total_completion_tokens: number
  total_tokens_all:        number
  avg_latency_ms:          number
  fallback_rate_pct:       number
  total_calls:             number
  failed_calls:            number
}

export interface FallbackTimelineRow {
  created_at:    string
  fallback_level: number
  success:        boolean
}

export interface FailedCallRow {
  id:            string
  model_used:    string
  call_type:     string
  error_code:    string | null
  error_message: string | null
  fallback_level: number
  latency_ms:    number
  created_at:    string
}

export function useGovernance(days = 7) {
  const [tokenStats,        setTokenStats]        = useState<TokenStats | null>(null)
  const [modelBreakdown,    setModelBreakdown]    = useState<ModelStat[]>([])
  const [fallbackTimeline,  setFallbackTimeline]  = useState<FallbackTimelineRow[]>([])
  const [recentFailures,    setRecentFailures]    = useState<FailedCallRow[]>([])
  const [loading,           setLoading]           = useState(false)
  const [error,             setError]             = useState<string | null>(null)

  const load = useCallback(async (d = days) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/security/governance?days=${d}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load governance data'); return }
      setTokenStats(data.tokenStats       ?? null)
      setModelBreakdown(data.modelBreakdown ?? [])
      setFallbackTimeline(data.fallbackTimeline ?? [])
      setRecentFailures(data.recentFailures ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])

  return { tokenStats, modelBreakdown, fallbackTimeline, recentFailures, loading, error, refetch: load }
}

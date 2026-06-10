'use client'

import { useState, useCallback, useEffect } from 'react'

export interface DocumentRiskFlag {
  id:                   string
  org_id:               string
  document_id:          string
  declared_sensitivity: string
  detected_sensitivity: string
  mismatch_detected:    boolean
  risk_score:           number
  reasoning:            string | null
  reviewed:             boolean
  reviewed_by:          string | null
  reviewed_at:          string | null
  created_at:           string
  // joined
  documents?: {
    original_name: string
    doc_type:      string
    status:        string
    created_at:    string
  }
}

export interface DocumentRiskSummary {
  total_indexed_docs:    number
  unreviewed_mismatches: number
  sensitivity_distribution?: {
    public:       number
    internal:     number
    confidential: number
    restricted:   number
  }
}

interface DocRiskParams {
  page?:            number
  limit?:           number
  mismatches_only?: boolean
}

export function useDocumentRisk(params: DocRiskParams = {}) {
  const [flags,   setFlags]   = useState<DocumentRiskFlag[]>([])
  const [total,   setTotal]   = useState(0)
  const [summary, setSummary] = useState<DocumentRiskSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (overrides: DocRiskParams = {}) => {
    setLoading(true)
    setError(null)
    const merged = { ...params, ...overrides }
    const sp = new URLSearchParams()
    if (merged.page)            sp.set('page',           String(merged.page))
    if (merged.limit)           sp.set('limit',          String(merged.limit))
    if (merged.mismatches_only) sp.set('mismatches_only', 'true')

    try {
      const res  = await fetch(`/api/security/document-risk?${sp}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load risk flags'); return }
      setFlags(data.flags   ?? [])
      setTotal(data.total   ?? 0)
      setSummary(data.summary ?? null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])

  const mutate = useCallback(async (
    id: string,
    action: 'review' | 'dismiss'
  ) => {
    const res  = await fetch('/api/security/document-risk', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, action }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Action failed')

    // Optimistic update in local state
    setFlags((prev) =>
      prev.map((f) => f.id === id ? { ...f, ...data.flag } : f)
    )
    return data.flag as DocumentRiskFlag
  }, [])

  return { flags, total, summary, loading, error, refetch: load, mutate }
}

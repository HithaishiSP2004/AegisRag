'use client'
// useSecurityTimeline — unified timeline (audit + security + retrieval events)
import { useState, useCallback, useEffect } from 'react'

export interface TimelineEvent {
  id:          string
  org_id:      string
  user_id:     string | null
  source_type: 'audit' | 'security' | 'retrieval'
  event_label: string
  category:    string
  severity:    string | null
  blocked:     boolean | null
  created_at:  string
}

interface TimelineParams {
  page?:        number
  limit?:       number
  source_type?: string
  severity?:    string
  days?:        number
}

export function useSecurityTimeline(params: TimelineParams = {}) {
  const [events,  setEvents]  = useState<TimelineEvent[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (overrides: TimelineParams = {}) => {
    setLoading(true)
    setError(null)
    const merged = { ...params, ...overrides }
    const sp = new URLSearchParams()
    if (merged.page)        sp.set('page',        String(merged.page))
    if (merged.limit)       sp.set('limit',       String(merged.limit))
    if (merged.source_type) sp.set('source_type', merged.source_type)
    if (merged.severity)    sp.set('severity',    merged.severity)
    if (merged.days)        sp.set('days',        String(merged.days))

    try {
      const res  = await fetch(`/api/security/timeline?${sp}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load timeline'); return }
      setEvents(data.events ?? [])
      setTotal(data.total   ?? 0)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])

  return { events, total, loading, error, refetch: load }
}

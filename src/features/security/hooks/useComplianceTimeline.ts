'use client'
// useComplianceTimeline — Sprint 5B: hook for fetching unified compliance timeline
import { useState, useCallback, useEffect } from 'react'

export interface ComplianceTimelineEvent {
  id:             string
  org_id:         string
  user_id:        string | null
  source_type:    'audit' | 'security' | 'alert' | 'review'
  event_label:    string
  category:       string
  severity:       string | null
  framework_name: string | null
  control_id:     string | null
  created_at:     string
}

interface TimelineParams {
  page?:        number
  limit?:       number
  source_type?: string
  severity?:    string
  framework?:   string
  control_id?:  string
  actor_id?:    string
  days?:        number
  since?:       string
  until?:       string
}

export function useComplianceTimeline(params: TimelineParams = {}) {
  const [events, setEvents] = useState<ComplianceTimelineEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Destructure primitive values to prevent infinite re-rendering when params is passed as an object literal
  const {
    page,
    limit,
    source_type,
    severity,
    framework,
    control_id,
    actor_id,
    days,
    since,
    until
  } = params

  const load = useCallback(async (overrides: TimelineParams = {}) => {
    setLoading(true)
    setError(null)
    const merged = {
      page,
      limit,
      source_type,
      severity,
      framework,
      control_id,
      actor_id,
      days,
      since,
      until,
      ...overrides
    }
    const sp = new URLSearchParams()
    if (merged.page)        sp.set('page',        String(merged.page))
    if (merged.limit)       sp.set('limit',       String(merged.limit))
    if (merged.source_type) sp.set('source_type', merged.source_type)
    if (merged.severity)    sp.set('severity',    merged.severity)
    if (merged.framework)   sp.set('framework',   merged.framework)
    if (merged.control_id)  sp.set('control_id',  merged.control_id)
    if (merged.actor_id)    sp.set('actor_id',    merged.actor_id)
    if (merged.days)        sp.set('days',        String(merged.days))
    if (merged.since)       sp.set('since',       merged.since)
    if (merged.until)       sp.set('until',       merged.until)

    try {
      const res = await fetch(`/api/compliance/timeline?${sp}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load compliance timeline'); return }
      setEvents(data.events ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [
    page,
    limit,
    source_type,
    severity,
    framework,
    control_id,
    actor_id,
    days,
    since,
    until
  ])

  useEffect(() => { load() }, [load])

  return { events, total, loading, error, refetch: load }
}

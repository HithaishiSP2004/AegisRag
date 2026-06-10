'use client'
// useSecurityAlerts — paginated alert list with acknowledge/resolve actions
import { useState, useCallback, useEffect } from 'react'
import type { AlertSeverity, AlertStatus, AlertCategory } from '@/types/database'

export interface AlertRow {
  id:              string
  org_id:          string
  source_event_id: string | null
  title:           string
  description:     string
  severity:        AlertSeverity
  status:          AlertStatus
  category:        AlertCategory
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_at:     string | null
  resolution_note: string | null
  metadata:        Record<string, unknown>
  created_at:      string
  updated_at:      string
}

interface AlertsParams {
  page?:     number
  limit?:    number
  severity?: string
  status?:   string
  category?: string
}

export function useSecurityAlerts(params: AlertsParams = {}) {
  const [alerts,  setAlerts]  = useState<AlertRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (overrides: AlertsParams = {}) => {
    setLoading(true)
    setError(null)
    const merged = { ...params, ...overrides }
    const sp = new URLSearchParams()
    if (merged.page)     sp.set('page',     String(merged.page))
    if (merged.limit)    sp.set('limit',    String(merged.limit))
    if (merged.severity) sp.set('severity', merged.severity)
    if (merged.status)   sp.set('status',   merged.status)
    if (merged.category) sp.set('category', merged.category)

    try {
      const res  = await fetch(`/api/security/alerts?${sp}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load alerts'); return }
      setAlerts(data.alerts ?? [])
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

  const mutate = useCallback(async (
    id: string,
    action: 'acknowledge' | 'resolve' | 'suppress',
    resolution_note?: string,
  ) => {
    const res  = await fetch('/api/security/alerts', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, action, resolution_note }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Action failed')

    // Optimistic update in local state
    setAlerts((prev) =>
      prev.map((a) => a.id === id ? { ...a, ...data.alert } : a)
    )
    return data.alert as AlertRow
  }, [])

  return { alerts, total, loading, error, refetch: load, mutate }
}

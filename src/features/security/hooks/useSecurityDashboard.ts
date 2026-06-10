'use client'
// useSecurityDashboard — fetch KPI + alerts + event stats for /dashboard/security
import { useState, useCallback, useEffect } from 'react'
import type { AlertSeverity, AlertStatus, AlertCategory } from '@/types/database'

export interface SecurityKPI {
  open_alerts:          number
  critical_open:        number
  high_open:            number
  alerts_last_n_days:   number
  resolved_last_n_days: number
  risk_flags_open:      number
  avg_resolve_hours:    number | null
}

export interface SecurityAlert {
  id:               string
  title:            string
  description:      string
  severity:         AlertSeverity
  status:           AlertStatus
  category:         AlertCategory
  created_at:       string
  updated_at:       string
  resolved_at:      string | null
  source_event_id:  string | null
}

export interface SecurityEventRow {
  id:          string
  event_type:  string
  severity:    string
  description: string
  blocked:     boolean
  resolution:  string | null
  created_at:  string
}

export interface SecurityEventStats {
  total_events:          number
  blocked_events:        number
  injection_attempts:    number
  unauthorized_attempts: number
  critical_events:       number
  events_last_n_hours:   number
}

interface DashboardState {
  kpi:      SecurityKPI | null
  alerts:   SecurityAlert[]
  secStats: SecurityEventStats | null
  events:   SecurityEventRow[]
  loading:  boolean
  error:    string | null
}

export function useSecurityDashboard(days = 7) {
  const [state, setState] = useState<DashboardState>({
    kpi: null, alerts: [], secStats: null, events: [], loading: false, error: null,
  })

  const load = useCallback(async (d = days) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res  = await fetch(`/api/security/dashboard?days=${d}`)
      const data = await res.json()
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: data.error ?? 'Failed to load dashboard' }))
        return
      }
      setState({
        kpi:      data.kpi      ?? null,
        alerts:   data.alerts   ?? [],
        secStats: data.secStats ?? null,
        events:   data.events   ?? [],
        loading:  false,
        error:    null,
      })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: String(err) }))
    }
  }, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [load])

  return { ...state, refetch: load }
}

'use client'
// Sprint 5B: useComplianceControls
import { useState, useEffect, useCallback } from 'react'
import type { FindingSeverity, ReviewStatus } from '@/types/database'

export interface ControlRow {
  id:             string
  framework_id:   string
  framework_name: string
  control_id:     string
  title:          string
  description:    string
  category:       string
  severity:       FindingSeverity
  evidence_count: number
  last_review:    { status: ReviewStatus; review_date: string | null; next_review_date: string | null } | null
  created_at:     string
}

interface State {
  controls: ControlRow[]
  loading:  boolean
  error:    string | null
}

export function useComplianceControls(framework_id?: string, category?: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true
  const [state, setState] = useState<State>({ controls: [], loading: enabled, error: null })
  const [prevFwId, setPrevFwId] = useState(framework_id)
  const [prevEnabled, setPrevEnabled] = useState(enabled)

  if (framework_id !== prevFwId || enabled !== prevEnabled) {
    setPrevFwId(framework_id)
    setPrevEnabled(enabled)
    setState({ controls: [], loading: enabled, error: null })
  }

  const load = useCallback(async () => {
    if (!enabled) {
      setState({ controls: [], loading: false, error: null })
      return
    }
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const params = new URLSearchParams()
      if (framework_id) params.set('framework_id', framework_id)
      if (category)     params.set('category',     category)
      const res = await fetch('/api/compliance/controls?' + params.toString())
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
      const json = await res.json()
      setState({ controls: json.controls ?? [], loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [framework_id, category, enabled])

  useEffect(() => { load() }, [load])

  return {
    controls: enabled ? state.controls : [],
    loading: enabled ? state.loading : false,
    error: enabled ? state.error : null,
    refresh: load
  }
}

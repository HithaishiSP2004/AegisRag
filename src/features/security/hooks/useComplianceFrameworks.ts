'use client'
// Sprint 5B: useComplianceFrameworks
import { useState, useEffect, useCallback } from 'react'

export interface FrameworkRow {
  id:             string
  name:           string
  description:    string
  control_count:  number
  evidence_count: number
  created_at:     string
}

interface State {
  frameworks: FrameworkRow[]
  loading:    boolean
  error:      string | null
}

export function useComplianceFrameworks() {
  const [state, setState] = useState<State>({ frameworks: [], loading: true, error: null })

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/compliance/frameworks')
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
      const json = await res.json()
      setState({ frameworks: json.frameworks ?? [], loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [])

  useEffect(() => { load() }, [load])
  return { ...state, refresh: load }
}

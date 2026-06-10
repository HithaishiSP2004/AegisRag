'use client'
// Sprint 5B: useComplianceEvidence
import { useState, useEffect, useCallback } from 'react'
import type { EvidenceType } from '@/types/database'

export interface EvidenceRow {
  id:                 string
  control_id:         string
  evidence_type:      EvidenceType
  evidence_reference: string
  source_table:       string
  source_id:          string
  created_at:         string
}

interface State {
  evidence: EvidenceRow[]
  loading:  boolean
  error:    string | null
}

export function useComplianceEvidence(control_id?: string) {
  const [state, setState] = useState<State>({ evidence: [], loading: !!control_id, error: null })
  const [prevControlId, setPrevControlId] = useState(control_id)

  if (control_id !== prevControlId) {
    setPrevControlId(control_id)
    setState({ evidence: [], loading: !!control_id, error: null })
  }

  const load = useCallback(async () => {
    if (!control_id) {
      setState({ evidence: [], loading: false, error: null })
      return
    }
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/compliance/evidence?control_id=${control_id}`)
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
      const json = await res.json()
      setState({ evidence: json.evidence ?? [], loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [control_id])

  useEffect(() => { load() }, [load])

  const link = useCallback(async (payload: {
    control_id:          string
    evidence_type:       EvidenceType
    source_table:        string
    source_id:           string
    evidence_reference?: string
  }) => {
    const res = await fetch('/api/compliance/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? res.statusText)
    await load()
    return json.evidence
  }, [load])

  const unlink = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/evidence?id=${id}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? res.statusText)
    await load()
    return true
  }, [load])

  return { ...state, refresh: load, link, unlink }
}



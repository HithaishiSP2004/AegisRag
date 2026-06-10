'use client'
// Sprint 5B: useComplianceReviews
import { useState, useEffect, useCallback } from 'react'
import type { ReviewStatus } from '@/types/database'

export interface ReviewRow {
  id:               string
  control_id:       string
  reviewer_id:      string
  status:           ReviewStatus
  notes:            string | null
  review_date:      string | null
  next_review_date: string | null
  created_at:       string
  updated_at:       string
  reviewer_email?:  string | null
  // joined
  compliance_controls?: {
    control_id: string
    title:      string
    severity:   string
    compliance_frameworks?: { name: string }
  }
}

interface State {
  reviews: ReviewRow[]
  total:   number
  page:    number
  loading: boolean
  error:   string | null
  stats?: {
    openReviews: number
    overdueReviews: number
    completedThisMonth: number
    avgReviewTimeHours: number
  }
}

export function useComplianceReviews(statusFilter?: ReviewStatus, controlId?: string) {
  const [page, setPage] = useState(1)
  const limit = 25
  const [state, setState] = useState<State>({ reviews: [], total: 0, page: 1, loading: true, error: null })

  const load = useCallback(async (p = 1) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (statusFilter) params.set('status', statusFilter)
      if (controlId) params.set('control_id', controlId)
      const res = await fetch('/api/compliance/reviews?' + params.toString())
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText)
      const json = await res.json()
      setState({ 
        reviews: json.reviews ?? [], 
        total: json.total ?? 0, 
        page: p, 
        loading: false, 
        error: null,
        stats: json.stats
      })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [statusFilter, controlId])

  useEffect(() => { setPage(1); load(1) }, [load])


  const mutate = useCallback(async (
    id: string,
    action: ReviewStatus,
    notes?: string,
    next_review_date?: string,
  ) => {
    const res = await fetch('/api/compliance/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: action, notes, next_review_date }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? res.statusText)
    await load(page)
    return json.review
  }, [load, page])

  const create = useCallback(async (payload: {
    control_id: string
    status?: ReviewStatus
    notes?: string
    review_date?: string
    next_review_date?: string
  }) => {
    const res = await fetch('/api/compliance/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? res.statusText)
    await load(1)
    return json.review
  }, [load])

  return {
    ...state,
    refresh: () => load(page),
    nextPage: () => { const p = page + 1; setPage(p); load(p) },
    prevPage: () => { const p = Math.max(1, page - 1); setPage(p); load(p) },
    mutate,
    create,
    limit,
  }
}

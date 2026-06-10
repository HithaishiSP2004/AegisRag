'use client'
// useAudit — fetches paginated audit timeline + KPI stats from /api/audit
import { useState, useCallback, useEffect } from 'react'

export interface AuditEntry {
  id:            string
  org_id:        string
  user_id:       string | null
  actor_name:    string | null
  actor_email:   string | null
  actor_role:    string | null
  action:        string
  resource_type: string
  resource_id:   string | null
  new_value:     Record<string, unknown> | null
  old_value:     Record<string, unknown> | null
  ip_address:    string | null
  created_at:    string
}

export interface AuditStats {
  total_documents:     number
  total_audit_events:  number
  total_conversations: number
  active_users:        number
}

export interface AuditFilters {
  page?:          number
  limit?:         number
  action?:        string
  resource_type?: string
  actor?:         string
  from?:          string
  to?:            string
}

export function useAudit(initial: AuditFilters = {}) {
  const [logs,    setLogs]    = useState<AuditEntry[]>([])
  const [total,   setTotal]   = useState(0)
  const [stats,   setStats]   = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetchLogs = useCallback(async (overrides: AuditFilters = {}) => {
    setLoading(true)
    setError(null)
    const merged = { page: 1, limit: 25, ...initial, ...overrides }
    const sp = new URLSearchParams()
    if (merged.page)          sp.set('page',          String(merged.page))
    if (merged.limit)         sp.set('limit',         String(merged.limit))
    if (merged.action)        sp.set('action',        merged.action)
    if (merged.resource_type) sp.set('resource_type', merged.resource_type)
    if (merged.actor)         sp.set('actor',         merged.actor)
    if (merged.from)          sp.set('from',          merged.from)
    if (merged.to)            sp.set('to',            merged.to)

    try {
      const res  = await fetch(`/api/audit?${sp.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 403 ? 'insufficient_permissions' : (data.error ?? 'Failed'))
        return
      }
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      if (data.stats) setStats(data.stats)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLogs()
    })
  }, [fetchLogs])

  /** Trigger download or PDF creation using current filters */
  async function exportData(filters: AuditFilters, format: 'csv' | 'json' | 'pdf' | 'report') {
    const sp = new URLSearchParams()
    
    // Set appropriate export target for the API
    if (format === 'csv') sp.set('export', 'csv')
    else if (format === 'json') sp.set('export', 'json')
    else sp.set('export', 'raw') // for pdf or report we fetch raw logs

    if (filters.action)        sp.set('action',        filters.action)
    if (filters.resource_type) sp.set('resource_type', filters.resource_type)
    if (filters.actor)         sp.set('actor',         filters.actor)
    if (filters.from)          sp.set('from',          filters.from)
    if (filters.to)            sp.set('to',            filters.to)

    try {
      const res = await fetch(`/api/audit?${sp.toString()}`)
      if (!res.ok) throw new Error(`Failed to export audit logs as ${format}`)

      if (format === 'csv' || format === 'json') {
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const data = await res.json()
        const rawLogs = data.logs || []
        const { generateAuditPdf } = await import('../utils/auditPdfExporter')
        generateAuditPdf({
          logs: rawLogs,
          filters: {
            actor: filters.actor,
            action: filters.action,
            resource_type: filters.resource_type,
            from: filters.from,
            to: filters.to,
          },
          isAuditReport: format === 'report'
        })
      }
    } catch (err) {
      console.error('[exportData] Error:', err)
      throw err
    }
  }

  return { logs, total, stats, loading, error, refetch: fetchLogs, exportData }
}

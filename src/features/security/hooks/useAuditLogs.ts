'use client'
// useAuditLogs — fetch paginated audit timeline
import { useState, useCallback, useEffect } from 'react'

export interface AuditLogEntry {
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

interface AuditLogsParams {
  page?:          number
  limit?:         number
  action?:        string
  resource_type?: string
  from?:          string
  to?:            string
}

export function useAuditLogs(params: AuditLogsParams = {}) {
  const [logs,    setLogs]    = useState<AuditLogEntry[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetch_ = useCallback(async (overrides: AuditLogsParams = {}) => {
    setLoading(true)
    setError(null)
    const merged = { ...params, ...overrides }
    const sp = new URLSearchParams()
    if (merged.page)          sp.set('page',          String(merged.page))
    if (merged.limit)         sp.set('limit',         String(merged.limit))
    if (merged.action)        sp.set('action',        merged.action)
    if (merged.resource_type) sp.set('resource_type', merged.resource_type)
    if (merged.from)          sp.set('from',          merged.from)
    if (merged.to)            sp.set('to',            merged.to)

    try {
      const res  = await fetch(`/api/audit-logs?${sp.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          setError('insufficient_permissions')
        } else {
          throw new Error(data.error ?? 'Failed to load audit logs')
        }
        return
      }
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.resolve().then(() => {
      fetch_()
    })
  }, [fetch_])

  return { logs, total, loading, error, refetch: fetch_ }
}

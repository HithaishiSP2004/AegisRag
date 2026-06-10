'use client'
// AuditFilters — filter bar: actor, action, resource_type, date range, export dropdown
import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import type { AuditFilters } from '../hooks/useAudit'

interface Props {
  onApply:    (filters: AuditFilters) => void
  onExport:   (filters: AuditFilters, format: 'csv' | 'json' | 'pdf' | 'report') => Promise<void>
  loading:    boolean
}

const RESOURCE_TYPES = ['document','workflow','report','user','organization','api','security','conversation']

export function AuditFilters({ onApply, onExport, loading }: Props) {
  const [actor,   setActor]   = useState('')
  const [action,  setAction]  = useState('')
  const [resType, setResType] = useState('')
  const [from,    setFrom]    = useState('')
  const [to,      setTo]      = useState('')

  // Export dropdown & feedback states
  const [showDropdown, setShowDropdown] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Count active filters
  const activeCount = [
    actor.trim(),
    action.trim(),
    resType,
    from,
    to
  ].filter(Boolean).length

  function current(): AuditFilters {
    return {
      actor:         actor.trim()   || undefined,
      action:        action.trim()  || undefined,
      resource_type: resType        || undefined,
      from:          from           || undefined,
      to:            to             || undefined,
    }
  }

  function handleApply() { 
    onApply({ ...current(), page: 1 }) 
  }

  function handleReset() {
    setActor('')
    setAction('')
    setResType('')
    setFrom('')
    setTo('')
    onApply({ page: 1 })
  }

  function handlePreset(days: number) {
    const today = new Date()
    const toStr = today.toISOString().slice(0, 10)
    let fromStr = ''
    if (days === 0) {
      fromStr = toStr
    } else {
      const past = new Date()
      past.setDate(today.getDate() - days)
      fromStr = past.toISOString().slice(0, 10)
    }
    setFrom(fromStr)
    setTo(toStr)
    onApply({
      actor: actor.trim() || undefined,
      action: action.trim() || undefined,
      resource_type: resType || undefined,
      from: fromStr,
      to: toStr,
      page: 1
    })
  }

  async function triggerExport(format: 'csv' | 'json' | 'pdf' | 'report') {
    setShowDropdown(false)
    setExporting(true)
    setFeedback(null)
    try {
      await onExport(current(), format)
      setFeedback({ type: 'success', message: `${format.toUpperCase()} Exported successfully!` })
    } catch (err) {
      setFeedback({ type: 'error', message: `Export failed: ${String(err)}` })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        background:   'rgba(15, 23, 42, 0.4)',
        border:       '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        padding:      '12px 16px',
        display:      'flex',
        alignItems:   'center',
        gap:          '8px',
        flexWrap:     'wrap',
      }}>
        {/* Icon label & badge */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0, marginRight: '4px' }}>
          <Icon icon="solar:filter-bold" width={15} style={{ color: '#64748B' }} />
          <span style={{ color:'#94A3B8', fontSize:'0.75rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            Filters
          </span>
          {activeCount > 0 && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              background: 'rgba(139, 92, 246, 0.15)',
              color: '#A78BFA',
              padding: '1px 6px',
              borderRadius: '99px',
              border: '1px solid rgba(139, 92, 246, 0.25)'
            }}>
              {activeCount} Active
            </span>
          )}
        </div>

        {/* Actor */}
        <input
          id="audit-filter-actor"
          placeholder="Actor name…"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          style={inputStyle}
        />

        {/* Action */}
        <input
          id="audit-filter-action"
          placeholder="Action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          style={inputStyle}
        />

        {/* Resource type */}
        <select
          id="audit-filter-resource"
          value={resType}
          onChange={(e) => setResType(e.target.value)}
          style={{ ...inputStyle, cursor:'pointer' }}
        >
          <option value="">All resources</option>
          {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Date range inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            id="audit-filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ ...inputStyle, colorScheme:'dark', width:'125px', minWidth: '125px' }}
          />
          <span style={{ color:'#475569', fontSize:'0.72rem' }}>—</span>
          <input
            id="audit-filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ ...inputStyle, colorScheme:'dark', width:'125px', minWidth: '125px' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:'6px', marginLeft:'auto', flexShrink:0 }}>
          <button
            id="audit-filter-reset"
            onClick={handleReset}
            style={{
              height: '36px',
              padding:'0 14px',
              borderRadius:'6px',
              background:'transparent',
              border:'1px solid rgba(255,255,255,0.08)',
              color:'#94A3B8',
              fontSize:'0.75rem',
              fontWeight: 500,
              cursor:'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            Reset
          </button>
          
          <button
            id="audit-filter-apply"
            onClick={handleApply}
            disabled={loading}
            style={{
              height: '36px',
              padding:'0 16px',
              borderRadius:'6px',
              background:'rgba(139,92,246,0.14)',
              border:'1px solid rgba(139,92,246,0.28)',
              color:'#A78BFA',
              fontSize:'0.75rem',
              fontWeight: 600,
              cursor:'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(139,92,246,0.22)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.40)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(139,92,246,0.14)'
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.28)'
              }
            }}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>

          {/* Export Dropdown Group */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              id="audit-export-dropdown"
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={exporting}
              style={{
                height: '36px',
                padding:'0 14px',
                borderRadius:'6px',
                background:'rgba(16,185,129,0.10)',
                border:'1px solid rgba(16,185,129,0.22)',
                color:'#10B981',
                fontSize:'0.75rem',
                fontWeight: 600,
                cursor:'pointer',
                display:'flex',
                alignItems:'center',
                gap:'6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!exporting) {
                  e.currentTarget.style.background = 'rgba(16,185,129,0.18)'
                  e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'
                }
              }}
              onMouseLeave={(e) => {
                if (!exporting) {
                  e.currentTarget.style.background = 'rgba(16,185,129,0.10)'
                  e.currentTarget.style.borderColor = 'rgba(16,185,129,0.22)'
                }
              }}
            >
              <Icon icon={exporting ? 'eos-icons:loading' : 'solar:download-bold'} width={14} />
              {exporting ? 'Exporting…' : 'Export'}
              <Icon icon="solar:alt-arrow-down-bold" width={10} style={{ opacity: 0.7 }} />
            </button>

            {showDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '180px',
                background: '#0D1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                zIndex: 50,
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}>
                <button
                  onClick={() => triggerExport('csv')}
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:file-text-bold" width={14} style={{ color: '#10B981' }} />
                  Export as CSV
                </button>
                <button
                  onClick={() => triggerExport('json')}
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:code-bold" width={14} style={{ color: '#38BDF8' }} />
                  Export as JSON
                </button>
                <button
                  onClick={() => triggerExport('pdf')}
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:document-bold" width={14} style={{ color: '#A78BFA' }} />
                  Export PDF Ledger
                </button>
                <button
                  onClick={() => triggerExport('report')}
                  style={dropdownItemStyle}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon icon="solar:medal-star-bold" width={14} style={{ color: '#F59E0B' }} />
                  Generate Audit Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date Range Presets and Feedbacks Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', minHeight: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Presets:</span>
          {([
            { label: 'Today', days: 0 },
            { label: '7 Days', days: 7 },
            { label: '30 Days', days: 30 },
            { label: '90 Days', days: 90 },
          ] as const).map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset.days)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '4px',
                padding: '2px 8px',
                color: '#64748B',
                fontSize: '0.68rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F8FAFC'
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748B'
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Feedback Messages */}
        {feedback && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontWeight: 500,
            color: feedback.type === 'success' ? '#10B981' : '#F43F5E',
            background: feedback.type === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`,
            padding: '2px 10px',
            borderRadius: '4px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <Icon icon={feedback.type === 'success' ? 'solar:check-circle-bold' : 'solar:danger-bold'} width={13} />
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background:   '#0D1117',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  color:        '#94A3B8',
  fontSize:     '0.75rem',
  padding:      '0 12px',
  height:       '36px',
  outline:      'none',
  minWidth:     '135px',
  boxSizing:    'border-box',
}

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  border: 0,
  background: 'transparent',
  color: '#94A3B8',
  fontSize: '0.72rem',
  fontWeight: 500,
  padding: '8px 10px',
  borderRadius: '4px',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}


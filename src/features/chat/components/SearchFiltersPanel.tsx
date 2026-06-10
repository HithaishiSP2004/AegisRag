'use client'
// SearchFiltersPanel — floating filter drawer for chat workspace
import { useState } from 'react'
import { Icon } from '@iconify/react'
import type { SearchFiltersUI } from '../types'

interface Props {
  filters:   SearchFiltersUI
  onChange:  (f: SearchFiltersUI) => void
}

const DEPARTMENTS = [
  '', 'Legal', 'HR', 'Finance', 'IT', 'Operations', 'Compliance',
  'Engineering', 'Marketing', 'Security',
]

const SENSITIVITIES = [
  '', 'public', 'internal', 'confidential', 'restricted',
]

const DOC_TYPES = [
  '', 'policy', 'procedure', 'report', 'contract', 'form',
  'guideline', 'standard', 'audit_report',
]

function SelectField({
  label, id, value, options, onChange,
}: {
  label: string
  id:    string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label htmlFor={id} style={{ color:'#64748B', fontSize:'0.7rem', fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background:   '#0D1117',
          border:       `1px solid ${value ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '8px',
          color:        value ? '#E2E8F0' : '#475569',
          fontSize:     '0.78rem',
          padding:      '7px 10px',
          outline:      'none',
          cursor:       'pointer',
          width:        '100%',
          transition:   'border-color 0.15s',
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background:'#0D1117' }}>
            {opt === '' ? `Any ${label}` : opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}

function DateField({
  label, id, value, onChange,
}: {
  label:    string
  id:       string
  value:    string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label htmlFor={id} style={{ color:'#64748B', fontSize:'0.7rem', fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>
        {label}
      </label>
      <input
        type="date"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background:   '#0D1117',
          border:       `1px solid ${value ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '8px',
          color:        value ? '#E2E8F0' : '#475569',
          fontSize:     '0.78rem',
          padding:      '7px 10px',
          outline:      'none',
          cursor:       'pointer',
          width:        '100%',
          colorScheme:  'dark',
          transition:   'border-color 0.15s',
        }}
      />
    </div>
  )
}

export function SearchFiltersPanel({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const activeCount = [
    filters.department, filters.sensitivity,
    filters.docType, filters.dateFrom, filters.dateTo,
  ].filter(Boolean).length

  function clear() {
    onChange({ department: '', sensitivity: '', docType: '', dateFrom: '', dateTo: '' })
  }

  return (
    <div style={{ position:'relative' }}>
      {/* Toggle button */}
      <button
        id="search-filters-toggle"
        onClick={() => setOpen((o) => !o)}
        title="Search Filters"
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          padding:      '7px 12px',
          borderRadius: '10px',
          border:       `1px solid ${activeCount > 0 ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
          background:   activeCount > 0 ? 'rgba(139,92,246,0.10)' : 'rgba(255,255,255,0.03)',
          color:        activeCount > 0 ? '#A78BFA' : '#64748B',
          fontSize:     '0.78rem',
          cursor:       'pointer',
          transition:   'all 0.15s ease',
        }}
      >
        <Icon icon="solar:tuning-2-bold" width={14} />
        Filters
        {activeCount > 0 && (
          <span style={{
            background:   '#7C3AED',
            color:        '#fff',
            borderRadius: '99px',
            fontSize:     '0.6rem',
            padding:      '1px 5px',
            fontWeight:   600,
            lineHeight:   1.4,
          }}>
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          id="search-filters-panel"
          style={{
            position:     'absolute',
            bottom:       'calc(100% + 8px)',
            right:        0,
            zIndex:       40,
            width:        '280px',
            background:   '#0D1117',
            border:       '1px solid rgba(255,255,255,0.10)',
            borderRadius: '14px',
            padding:      '16px',
            boxShadow:    '0 12px 40px rgba(0,0,0,0.5)',
            display:      'flex',
            flexDirection:'column',
            gap:          '12px',
          }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#E2E8F0', fontSize:'0.82rem', fontWeight:600 }}>
              Search Filters
            </span>
            {activeCount > 0 && (
              <button
                id="filters-clear-btn"
                onClick={clear}
                style={{
                  background:   'none',
                  border:       'none',
                  color:        '#F43F5E',
                  fontSize:     '0.72rem',
                  cursor:       'pointer',
                  padding:      '2px 6px',
                  borderRadius: '5px',
                }}
              >
                Clear all
              </button>
            )}
          </div>

          <SelectField
            id="filter-department"
            label="Department"
            value={filters.department ?? ''}
            options={DEPARTMENTS}
            onChange={(v) => onChange({ ...filters, department: v })}
          />

          <SelectField
            id="filter-sensitivity"
            label="Sensitivity"
            value={filters.sensitivity ?? ''}
            options={SENSITIVITIES}
            onChange={(v) => onChange({ ...filters, sensitivity: v })}
          />

          <SelectField
            id="filter-doctype"
            label="Document Type"
            value={filters.docType ?? ''}
            options={DOC_TYPES}
            onChange={(v) => onChange({ ...filters, docType: v })}
          />

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <DateField
              id="filter-date-from"
              label="From"
              value={filters.dateFrom ?? ''}
              onChange={(v) => onChange({ ...filters, dateFrom: v })}
            />
            <DateField
              id="filter-date-to"
              label="To"
              value={filters.dateTo ?? ''}
              onChange={(v) => onChange({ ...filters, dateTo: v })}
            />
          </div>

          <div style={{
            paddingTop:  '8px',
            borderTop:   '1px solid rgba(255,255,255,0.06)',
            color:       '#334155',
            fontSize:    '0.68rem',
          }}>
            Filters apply to the next message you send.
          </div>
        </div>
      )}
    </div>
  )
}

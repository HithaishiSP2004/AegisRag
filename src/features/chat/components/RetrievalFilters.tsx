'use client'
// =============================================================================
// RetrievalFilters — Sprint 3C: Shared metadata filter component
//
// Used in:
//   - ChatWorkspace: restricts which documents are retrieved during chat
//   - KnowledgeVaultShell: filters the displayed document list
//
// Props:
//   filters   — current SearchFiltersUI state
//   onChange  — called whenever any filter changes
//   variant   — 'inline' (KV bar, always visible) | 'compact' (chip strip)
// =============================================================================

import { Icon } from '@iconify/react'
import { colors, font, radius } from '@/components/ui/tokens'

export interface RetrievalFiltersState {
  department?:  string
  docType?:     string
  sensitivity?: string
  documentId?:  string
}

interface Props {
  filters:   RetrievalFiltersState
  onChange:  (f: RetrievalFiltersState) => void
  /** 'inline' = always-visible horizontal bar  |  'chip' = slim chip strip (read-only display) */
  variant?:  'inline' | 'chip'
}

// ── Option lists ──────────────────────────────────────────────────────────────
const DEPARTMENTS: [string, string][] = [
  ['', 'All Departments'],
  ['Legal',       'Legal'],
  ['HR',          'HR'],
  ['Finance',     'Finance'],
  ['IT',          'IT'],
  ['Operations',  'Operations'],
  ['Compliance',  'Compliance'],
  ['Engineering', 'Engineering'],
  ['Marketing',   'Marketing'],
  ['Security',    'Security'],
]

const DOC_TYPES: [string, string][] = [
  ['',                 'All Doc Types'],
  ['hr_policy',        'HR Policy'],
  ['security_policy',  'Security Policy'],
  ['compliance_manual','Compliance Manual'],
  ['legal',            'Legal'],
  ['vendor',           'Vendor'],
  ['regulatory',       'Regulatory'],
  ['other',            'Other'],
]

const SENSITIVITIES: [string, string][] = [
  ['',             'All Sensitivity'],
  ['public',       'Public'],
  ['internal',     'Internal'],
  ['confidential', 'Confidential'],
  ['restricted',   'Restricted'],
]

const SENSITIVITY_COLOR: Record<string, string> = {
  public:       '#10B981',
  internal:     '#3B82F6',
  confidential: '#F59E0B',
  restricted:   '#F43F5E',
}

// ── Chip strip (read-only, shows active filters inline) ───────────────────────
export function ActiveFilterChips({
  filters,
  documents = [],
  onClear,
}: {
  filters:  RetrievalFiltersState
  documents?: { id: string; originalName: string }[]
  onClear:  (field: keyof RetrievalFiltersState) => void
}) {
  const chips: { key: keyof RetrievalFiltersState; label: string; color?: string }[] = []

  if (filters.department)
    chips.push({ key: 'department',  label: filters.department })
  if (filters.docType)
    chips.push({ key: 'docType',     label: DOC_TYPES.find(([v]) => v === filters.docType)?.[1] ?? filters.docType })
  if (filters.sensitivity)
    chips.push({
      key:   'sensitivity',
      label: SENSITIVITIES.find(([v]) => v === filters.sensitivity)?.[1] ?? filters.sensitivity,
      color: SENSITIVITY_COLOR[filters.sensitivity],
    })
  if (filters.documentId) {
    const doc = documents.find((d) => d.id === filters.documentId)
    chips.push({
      key:   'documentId',
      label: doc ? doc.originalName : 'Selected PDF',
      color: '#06B6D4',
    })
  }

  if (chips.length === 0) return null

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        '6px',
      padding:    '6px 20px',
      flexShrink: 0,
      flexWrap:   'wrap',
    }}>
      <span style={{ color:'#334155', fontSize:'0.68rem', flexShrink:0 }}>Filtering by:</span>
      {chips.map(({ key, label, color }) => (
        <span
          key={key}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          '5px',
            padding:      '2px 8px 2px 10px',
            borderRadius: '99px',
            background:   color ? `${color}14` : 'rgba(139,92,246,0.12)',
            border:       color ? `1px solid ${color}28` : '1px solid rgba(139,92,246,0.24)',
            color:        color ?? '#A78BFA',
            fontSize:     '0.7rem',
            fontWeight:   500,
          }}
        >
          {label}
          <button
            onClick={() => onClear(key)}
            title={`Remove ${key} filter`}
            style={{
              background: 'none', border: 'none',
              color: 'inherit', cursor: 'pointer',
              padding: '0', lineHeight: 1,
              opacity: 0.6,
              fontSize: '0.75rem',
            }}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}

// ── Inline filter bar (always visible, horizontal) ────────────────────────────
export function RetrievalFilters({ filters, onChange }: Props) {
  const activeCount = [filters.department, filters.docType, filters.sensitivity].filter(Boolean).length

  function set(key: keyof RetrievalFiltersState, value: string) {
    onChange({ ...filters, [key]: value || undefined })
  }

  function clearAll() {
    onChange({})
  }

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         '8px',
      flexWrap:    'wrap',
      padding:     '10px 16px',
      background:  'rgba(255,255,255,0.02)',
      border:      '1px solid rgba(255,255,255,0.06)',
      borderRadius:'12px',
    }}>
      {/* Label */}
      <div style={{ display:'flex', alignItems:'center', gap:'5px', flexShrink:0, marginRight:'4px' }}>
        <Icon icon="solar:filter-bold" width={13} style={{ color: activeCount > 0 ? '#A78BFA' : '#334155' }} />
        <span style={{ color: activeCount > 0 ? '#A78BFA' : '#475569', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>
          Filter
        </span>
        {activeCount > 0 && (
          <span style={{
            background:'#7C3AED', color:'#fff',
            borderRadius:'99px', fontSize:'0.6rem',
            padding:'1px 5px', fontWeight:600, lineHeight:1.4,
          }}>
            {activeCount}
          </span>
        )}
      </div>

      {/* Department */}
      <select
        id="retrieval-filter-department"
        value={filters.department ?? ''}
        onChange={(e) => set('department', e.target.value)}
        style={selectStyle(!!filters.department)}
      >
        {DEPARTMENTS.map(([v, l]) => <option key={v} value={v} style={{ background:'#0D1117' }}>{l}</option>)}
      </select>

      {/* Doc type */}
      <select
        id="retrieval-filter-doctype"
        value={filters.docType ?? ''}
        onChange={(e) => set('docType', e.target.value)}
        style={selectStyle(!!filters.docType)}
      >
        {DOC_TYPES.map(([v, l]) => <option key={v} value={v} style={{ background:'#0D1117' }}>{l}</option>)}
      </select>

      {/* Sensitivity */}
      <select
        id="retrieval-filter-sensitivity"
        value={filters.sensitivity ?? ''}
        onChange={(e) => set('sensitivity', e.target.value)}
        style={selectStyle(!!filters.sensitivity)}
      >
        {SENSITIVITIES.map(([v, l]) => (
          <option key={v} value={v} style={{ background:'#0D1117', color: v ? (SENSITIVITY_COLOR[v] ?? 'inherit') : 'inherit' }}>
            {l}
          </option>
        ))}
      </select>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          id="retrieval-filter-clear"
          onClick={clearAll}
          style={{
            background:   'none',
            border:       'none',
            color:        '#F43F5E',
            fontSize:     '0.72rem',
            cursor:       'pointer',
            padding:      '3px 7px',
            borderRadius: '6px',
            display:      'flex',
            alignItems:   'center',
            gap:          '4px',
          }}
        >
          <Icon icon="solar:close-circle-bold" width={12} />
          Clear filters
        </button>
      )}
    </div>
  )
}

function selectStyle(active: boolean): React.CSSProperties {
  return {
    background:   '#0D1117',
    border:       `1px solid ${active ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '8px',
    color:        active ? '#E2E8F0' : '#475569',
    fontSize:     '0.75rem',
    padding:      '5px 9px',
    outline:      'none',
    cursor:       'pointer',
    transition:   'border-color 0.15s',
  }
}

// ── Slide-over Retrieval Scope Panel ──────────────────────────────────────────
export function RetrievalScopePanel({
  isOpen,
  onClose,
  filters,
  onChange,
  documents = [],
}: {
  isOpen: boolean
  onClose: () => void
  filters: RetrievalFiltersState
  onChange: (f: RetrievalFiltersState) => void
  documents?: { id: string; originalName: string }[]
}) {
  if (!isOpen) return null

  const activeCount = [filters.department, filters.docType, filters.sensitivity, filters.documentId].filter(Boolean).length

  function set(key: keyof RetrievalFiltersState, value: string) {
    onChange({ ...filters, [key]: value || undefined })
  }

  function clearAll() {
    onChange({})
  }

  return (
    <div style={{
      position:      'absolute',
      top:           0,
      right:         0,
      width:         '360px',
      height:        '100%',
      background:    'rgba(8, 12, 20, 0.97)',
      backdropFilter:'blur(20px)',
      borderLeft:    `1px solid ${colors.glassBorder}`,
      boxShadow:     '-12px 0 40px rgba(0, 0, 0, 0.5)',
      zIndex:        200,
      display:       'flex',
      flexDirection: 'column',
      fontFamily:    font.sans,
      transform:     'translateX(0)',
      transition:    'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* Drawer Header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '18px 20px',
        borderBottom:   `1px solid ${colors.glassBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:filter-bold" width={16} style={{ color: colors.cyan }} />
          <span style={{
            color:         '#fff',
            fontSize:      font.sizes.sm,
            fontWeight:    700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Retrieval Scope
          </span>
          {activeCount > 0 && (
            <span style={{
              background:   colors.cyan,
              color:        '#000',
              borderRadius: '99px',
              fontSize:     '0.65rem',
              padding:      '1px 6px',
              fontWeight:   700,
            }}>
              {activeCount}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border:     'none',
            color:      colors.textMuted,
            cursor:     'pointer',
            fontSize:   '1.2rem',
            padding:    '4px',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Info Notice */}
      <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.01)', borderBottom: `1px solid ${colors.glassBorder}` }}>
        <p style={{
          color:      colors.textSecondary,
          fontSize:   '0.75rem',
          lineHeight: 1.5,
          margin:     0,
        }}>
          Bound queries to specific corporate divisions, document formats, or sensitivity thresholds. Restricted queries only retrieve chunks matching all parameters.
        </p>
      </div>

      {/* Fields Stack */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        {/* Department */}
        <div>
          <label style={{
            display:       'block',
            color:         colors.textMuted,
            fontSize:      font.sizes.xs,
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom:  '8px',
            fontFamily:    font.mono,
          }}>
            Corporate Department
          </label>
          <select
            id="scope-filter-department"
            value={filters.department ?? ''}
            onChange={(e) => set('department', e.target.value)}
            style={scopeSelectStyle(!!filters.department)}
          >
            {DEPARTMENTS.map(([v, l]) => <option key={v} value={v} style={{ background:'#0D1117' }}>{l}</option>)}
          </select>
        </div>

        {/* Doc Type */}
        <div>
          <label style={{
            display:       'block',
            color:         colors.textMuted,
            fontSize:      font.sizes.xs,
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom:  '8px',
            fontFamily:    font.mono,
          }}>
            Document Type
          </label>
          <select
            id="scope-filter-doctype"
            value={filters.docType ?? ''}
            onChange={(e) => set('docType', e.target.value)}
            style={scopeSelectStyle(!!filters.docType)}
          >
            {DOC_TYPES.map(([v, l]) => <option key={v} value={v} style={{ background:'#0D1117' }}>{l}</option>)}
          </select>
        </div>

        {/* Sensitivity */}
        <div>
          <label style={{
            display:       'block',
            color:         colors.textMuted,
            fontSize:      font.sizes.xs,
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom:  '8px',
            fontFamily:    font.mono,
          }}>
            Security Sensitivity
          </label>
          <select
            id="scope-filter-sensitivity"
            value={filters.sensitivity ?? ''}
            onChange={(e) => set('sensitivity', e.target.value)}
            style={scopeSelectStyle(!!filters.sensitivity)}
          >
            {SENSITIVITIES.map(([v, l]) => (
              <option key={v} value={v} style={{ background:'#0D1117', color: v ? (SENSITIVITY_COLOR[v] ?? 'inherit') : 'inherit' }}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Document Scoping Filter */}
        <div>
          <label style={{
            display:       'block',
            color:         colors.textMuted,
            fontSize:      font.sizes.xs,
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom:  '8px',
            fontFamily:    font.mono,
          }}>
            Target Document (PDF)
          </label>
          <select
            id="scope-filter-document"
            value={filters.documentId ?? ''}
            onChange={(e) => set('documentId', e.target.value)}
            style={scopeSelectStyle(!!filters.documentId)}
          >
            <option value="" style={{ background:'#0D1117' }}>All Documents</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id} style={{ background:'#0D1117' }}>
                {doc.originalName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clear/Footer panel */}
      {activeCount > 0 && (
        <div style={{
          padding:      '16px 20px',
          borderTop:    `1px solid ${colors.glassBorder}`,
          background:   'rgba(255,255,255,0.01)',
          display:      'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            id="scope-filter-clear"
            onClick={clearAll}
            style={{
              background:   'rgba(244,63,94,0.1)',
              border:       '1px solid rgba(244,63,94,0.25)',
              borderRadius: radius.md,
              color:        '#F43F5E',
              fontSize:     '0.75rem',
              fontWeight:   600,
              cursor:       'pointer',
              padding:      '8px 16px',
              fontFamily:    font.mono,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display:      'flex',
              alignItems:   'center',
              gap:          '6px',
            }}
          >
            <Icon icon="solar:close-circle-bold" width={14} />
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  )
}

function scopeSelectStyle(active: boolean): React.CSSProperties {
  return {
    width:        '100%',
    background:   '#0D1117',
    border:       `1px solid ${active ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '8px',
    color:        active ? '#fff' : '#8892B0',
    fontSize:     '0.8rem',
    padding:      '10px 12px',
    outline:      'none',
    cursor:       'pointer',
    fontFamily:   'var(--font-jetbrains-mono, monospace)',
    transition:   'border-color 0.15s',
  }
}


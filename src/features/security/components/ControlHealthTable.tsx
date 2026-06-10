'use client'
import { useState, useEffect } from 'react'
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileWarning, 
  Clipboard,
  X,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Check,
  Calendar,
  Layers,
  FileText,
  User,
  Heart,
  History,
  FileCode
} from 'lucide-react'
import { useComplianceControls } from '../hooks/useComplianceControls'
import { useComplianceFrameworks } from '../hooks/useComplianceFrameworks'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { colors, radius, font, shadow } from '@/components/ui/tokens'
import type { ControlRow } from '../hooks/useComplianceControls'
import type { FindingSeverity } from '@/types/database'

const SEV_COLOR: Record<FindingSeverity, string> = {
  critical: '#F43F5E', 
  high: '#FB923C', 
  medium: '#F59E0B', 
  low: '#10B981',
}

const STATUS_COLOR: Record<string, string> = {
  approved: '#10B981', 
  rejected: '#F43F5E', 
  needs_followup: '#F59E0B', 
  pending: '#64748b',
}

function ControlRow_({ ctrl, active, onClick }: { ctrl: ControlRow; active: boolean; onClick: () => void }) {
  const isOverdue = ctrl.last_review?.next_review_date
    ? new Date(ctrl.last_review.next_review_date) < new Date()
    : false
  const reviewStatus = ctrl.last_review?.status

  return (
    <tr 
      onClick={onClick}
      style={{ 
        borderBottom: '1px solid rgba(255,255,255,0.05)', 
        transition: 'background 0.15s ease',
        cursor: 'pointer',
        background: active ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
      }} 
      className="hover-row"
    >
      <td style={{ padding: '12px', color: active ? colors.indigoLight : colors.textSecondary, fontSize: '12px', fontFamily: font.mono }}>
        {ctrl.control_id}
      </td>
      <td style={{ padding: '12px', color: colors.textPrimary, fontSize: '13px' }}>
        <div style={{ fontWeight: 500, color: active ? colors.indigoLight : colors.textPrimary }}>{ctrl.title}</div>
        <div style={{ fontSize: '11px', color: colors.textMuted, marginTop: '2px' }}>{ctrl.framework_name}</div>
      </td>
      <td style={{ padding: '12px' }}>
        <span style={{
          background: `${SEV_COLOR[ctrl.severity]}15`,
          color: SEV_COLOR[ctrl.severity],
          borderRadius: radius.sm, 
          padding: '2px 7px', 
          fontSize: '11px', 
          fontWeight: 600,
          textTransform: 'capitalize'
        }}>{ctrl.severity}</span>
      </td>
      <td style={{ padding: '12px', color: colors.textSecondary, fontSize: '12px' }}>
        {ctrl.category}
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          {ctrl.evidence_count > 0 ? (
            <CheckCircle2 size={14} style={{ color: '#10B981' }} />
          ) : (
            <FileWarning size={14} style={{ color: '#F59E0B' }} />
          )}
          <span style={{ fontSize: '12px', color: ctrl.evidence_count > 0 ? colors.textPrimary : '#F59E0B', fontWeight: 600 }}>
            {ctrl.evidence_count}
          </span>
        </div>
      </td>
      <td style={{ padding: '12px', textAlign: 'center' }}>
        {reviewStatus ? (
          <span style={{
            background: `${STATUS_COLOR[reviewStatus]}15`,
            color: STATUS_COLOR[reviewStatus],
            borderRadius: radius.sm, 
            padding: '2px 7px', 
            fontSize: '11px', 
            fontWeight: 600,
            textTransform: 'capitalize'
          }}>
            {isOverdue && reviewStatus === 'pending' ? '⚠ overdue' : reviewStatus}
          </span>
        ) : (
          <span style={{ color: colors.textMuted, fontSize: '11px' }}>no review</span>
        )}
      </td>
    </tr>
  )
}

export function ControlHealthTable() {
  const { frameworks } = useComplianceFrameworks()
  const [frameworkId, setFrameworkId] = useState<string>('')
  const { controls, loading, error } = useComplianceControls(frameworkId || undefined)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<'control_id' | 'severity' | 'category' | 'evidence_count' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedControl, setSelectedControl] = useState<ControlRow | null>(null)

  useEffect(() => {
    if (!loading && controls.length > 0 && !selectedControl) {
      setSelectedControl(controls[0])
    }
  }, [controls, loading, selectedControl])

  const handleSort = (field: 'control_id' | 'severity' | 'category' | 'evidence_count') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const severityValue = (s: FindingSeverity): number => {
    switch (s) {
      case 'critical': return 4
      case 'high':     return 3
      case 'medium':   return 2
      case 'low':      return 1
      default:         return 0
    }
  }

  const filteredAndSortedControls = [...controls]
    .filter(ctrl => {
      const matchSearch = 
        ctrl.control_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ctrl.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ctrl.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ctrl.framework_name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    })
    .sort((a, b) => {
      if (!sortField) return 0
      let valA: any = a[sortField]
      let valB: any = b[sortField]

      if (sortField === 'severity') {
        valA = severityValue(a.severity)
        valB = severityValue(b.severity)
      } else if (sortField === 'evidence_count') {
        valA = a.evidence_count
        valB = b.evidence_count
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  const frameworkOptions = [
    { value: '', label: 'All Frameworks' },
    ...frameworks.map(fw => ({ value: fw.id, label: fw.name }))
  ]

  const SortHeader = ({ field, label, align = 'left' }: { 
    field: 'control_id' | 'severity' | 'category' | 'evidence_count'
    label: string
    align?: 'left' | 'center'
  }) => {
    const isSorted = sortField === field
    return (
      <th 
        onClick={() => handleSort(field)}
        style={{ 
          padding: '8px 12px', 
          color: colors.textSecondary, 
          fontSize: '11px', 
          textAlign: align,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          userSelect: 'none',
          position: 'sticky',
          top: 0,
          background: '#090d16',
          zIndex: 10,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: align === 'center' ? 'center' : 'flex-start', width: '100%' }}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
          ) : (
            <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
          )}
        </div>
      </th>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ color: colors.textPrimary, fontSize: '16px', fontWeight: 600, margin: 0 }}>
        Enterprise Control Workspace
      </h3>

      {/* Controls Header Toolbar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: '280px' }}>
          {/* Framework Select */}
          <CustomSelect
            value={frameworkId}
            onChange={(val) => {
              setFrameworkId(val)
              setSearchTerm('')
            }}
            options={frameworkOptions}
            width="200px"
          />

          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '240px' }}>
            <Search size={14} style={{ 
              position: 'absolute', 
              left: '10px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: colors.textMuted 
            }} />
            <input
              type="text"
              placeholder="Search controls..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: radius.md,
                padding: '8px 12px 8px 32px',
                color: colors.textPrimary,
                fontSize: '13px',
                width: '100%',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>
        </div>

        <span style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>
          {filteredAndSortedControls.length} control{filteredAndSortedControls.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Main Split Layout Workspace */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Left Side: Catalog Table */}
        <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>
              <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>Loading controls...</div>
            </div>
          ) : error ? (
            <div style={{ padding: 16, color: '#F43F5E', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          ) : filteredAndSortedControls.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Clipboard size={32} style={{ color: colors.textMuted }} />
              </div>
              <div style={{ fontSize: 13 }}>No controls match criteria.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '550px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.lg }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#090d16' }}>
                    <SortHeader field="control_id" label="ID" />
                    <th style={{ 
                      padding: '8px 12px', 
                      color: colors.textSecondary, 
                      fontSize: '11px', 
                      textAlign: 'left', 
                      letterSpacing: '0.05em',
                      position: 'sticky',
                      top: 0,
                      background: '#090d16',
                      zIndex: 10,
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      Title
                    </th>
                    <SortHeader field="severity" label="Severity" />
                    <SortHeader field="category" label="Category" />
                    <SortHeader field="evidence_count" label="Evidence" align="center" />
                    <th style={{ 
                      padding: '8px 12px', 
                      color: colors.textSecondary, 
                      fontSize: '11px', 
                      textAlign: 'center', 
                      letterSpacing: '0.05em',
                      position: 'sticky',
                      top: 0,
                      background: '#090d16',
                      zIndex: 10,
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      Last Review
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedControls.map(ctrl => (
                    <ControlRow_ 
                      key={ctrl.id} 
                      ctrl={ctrl} 
                      active={selectedControl?.id === ctrl.id}
                      onClick={() => setSelectedControl(ctrl)} 
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Control Inspector Panel */}
        <div style={{
          width: '450px',
          minHeight: '400px',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: radius.lg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {selectedControl ? (
            <ControlInspectorPanel ctrl={selectedControl} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: colors.textMuted, gap: '8px' }}>
              <Layers size={32} />
              <span style={{ fontSize: '13px' }}>Select a control to view inspector details</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ControlInspectorPanel({ ctrl }: { ctrl: ControlRow }) {
  const [evidence, setEvidence] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Owners list seeded based on control/framework categories
  const owners: Record<string, string> = {
    organizational: 'Sam Krishnamurthy (SecOps)',
    access_control: 'Jordan Blake (IAM Principal)',
    operations: 'Jordan Blake (Ops Lead)',
    incident_response: 'Priya Nair (IR Manager)',
    data_protection: 'Hithaishi (Super Admin)',
    administrative: 'Priya Nair (Compliance Manager)',
    technical: 'Sam Krishnamurthy (SecOps)',
    policies: 'Hithaishi (Compliance Lead)'
  }
  const owner = owners[ctrl.category] ?? 'Aegis Security Operations'

  // Calculate Health Score
  const calculateHealthScore = () => {
    let score = 50
    if (ctrl.evidence_count > 0) score += 25
    if (ctrl.last_review?.status === 'approved') score += 25
    else if (ctrl.last_review?.status === 'rejected') score -= 15
    return Math.max(0, Math.min(100, score))
  }
  const healthScore = calculateHealthScore()

  useEffect(() => {
    if (!ctrl) return
    setLoadingEvidence(true)
    fetch(`/api/compliance/evidence?control_id=${ctrl.id}`)
      .then(res => res.json())
      .then(data => setEvidence(data.evidence ?? []))
      .catch(err => console.error('Error fetching evidence:', err))
      .finally(() => setLoadingEvidence(false))

    setLoadingReviews(true)
    fetch(`/api/compliance/reviews?control_id=${ctrl.id}`)
      .then(res => res.json())
      .then(data => setReviews(data.reviews ?? []))
      .catch(err => console.error('Error fetching reviews:', err))
      .finally(() => setLoadingReviews(false))

    setLoadingEvents(true)
    fetch(`/api/compliance/timeline?control_id=${ctrl.id}`)
      .then(res => res.json())
      .then(data => setEvents(data.events ?? []))
      .catch(err => console.error('Error fetching events:', err))
      .finally(() => setLoadingEvents(false))
  }, [ctrl])

  const severityRisk: Record<string, { label: string; color: string }> = {
    critical: { label: 'High Risk', color: '#F43F5E' },
    high: { label: 'High Risk', color: '#FB923C' },
    medium: { label: 'Medium Risk', color: '#F59E0B' },
    low: { label: 'Low Risk', color: '#10B981' }
  }
  const risk = severityRisk[ctrl.severity] ?? { label: 'Low Risk', color: '#10B981' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Inspector Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Layers size={18} style={{ color: colors.indigoLight }} />
          <div>
            <h4 style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14, margin: 0 }}>
              Control Inspector Workspace
            </h4>
            <span style={{ fontSize: 11, color: colors.textSecondary, fontFamily: font.mono }}>
              ID: {ctrl.control_id}
            </span>
          </div>
        </div>
      </div>

      {/* Inspector Details Panel */}
      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Health Score Component */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: radius.md
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Heart size={16} style={{ color: healthScore >= 80 ? '#10B981' : '#F59E0B' }} />
            <span style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>Control Health Score</span>
          </div>
          <span style={{
            fontSize: '15px',
            fontWeight: 800,
            color: healthScore >= 80 ? '#10B981' : '#F59E0B'
          }}>{healthScore}%</span>
        </div>

        {/* Control Summary */}
        <div>
          <h5 style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 6 }}>
            Control Metadata
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: colors.textSecondary }}>Title</span>
              <span style={{ color: colors.textPrimary, fontWeight: 500, textAlign: 'right', maxWidth: '230px' }}>{ctrl.title}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: colors.textSecondary }}>Framework</span>
              <span style={{ color: colors.textPrimary }}>{ctrl.framework_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: colors.textSecondary }}>Category</span>
              <span style={{ color: colors.textPrimary }}>{ctrl.category}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: colors.textSecondary }}>Owner</span>
              <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{owner}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: colors.textSecondary }}>Severity</span>
              <span style={{
                background: `${SEV_COLOR[ctrl.severity]}15`,
                color: SEV_COLOR[ctrl.severity],
                borderRadius: radius.sm,
                padding: '1px 5px',
                fontSize: 10,
                fontWeight: 600
              }}>{ctrl.severity}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: colors.textSecondary }}>Risk Level</span>
              <span style={{ color: risk.color, fontWeight: 600 }}>{risk.label}</span>
            </div>
          </div>
        </div>

        {/* History Feed */}
        <div>
          <h5 style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 6 }}>
            Control History & Changes
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <History size={12} style={{ color: colors.indigoLight, marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ color: colors.textPrimary, fontWeight: 600 }}>Owner Updated: </span>
                <span style={{ color: colors.textSecondary }}>Assigned control owner to {owner.split(' ')[0]}.</span>
              </div>
            </div>
            {ctrl.evidence_count > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <CheckCircle2 size={12} style={{ color: '#10B981', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <span style={{ color: colors.textPrimary, fontWeight: 600 }}>Evidence Added: </span>
                  <span style={{ color: colors.textSecondary }}>Linked electronic security evidence files to control.</span>
                </div>
              </div>
            )}
            {ctrl.last_review?.status === 'approved' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <ShieldCheck size={12} style={{ color: '#10B981', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <span style={{ color: colors.textPrimary, fontWeight: 600 }}>Review Approved: </span>
                  <span style={{ color: colors.textSecondary }}>Auditor signed off control logic structure.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mapped Evidence */}
        <div>
          <h5 style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 6 }}>
            Mapped Evidence ({evidence.length})
          </h5>
          {loadingEvidence ? (
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Loading evidence...</div>
          ) : evidence.length === 0 ? (
            <div style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>No evidence mapped.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidence.map((ev, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: radius.md,
                  padding: 8,
                  fontSize: 11
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: colors.textPrimary, fontWeight: 600 }}>ID: {ev.id.slice(0, 8)}</span>
                    <span style={{ color: colors.textSecondary }}>{ev.evidence_type}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.textMuted }}>
                    <span>Source: {ev.source_table}</span>
                    <span style={{ color: ev.is_verified ? '#10B981' : '#F43F5E' }}>
                      {ev.is_verified ? '✓ Verified' : '✗ Unverified'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline Events */}
        <div>
          <h5 style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 6 }}>
            Timeline Events ({events.length})
          </h5>
          {loadingEvents ? (
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>No timeline events.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map((ev, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 11,
                  color: colors.textSecondary
                }}>
                  <Clock size={12} style={{ color: colors.indigoLight, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span style={{ color: colors.textPrimary, fontWeight: 500 }}>{ev.event_label}</span>
                    <span style={{ fontSize: 9, color: colors.textMuted, marginLeft: 6 }}>
                      {new Date(ev.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

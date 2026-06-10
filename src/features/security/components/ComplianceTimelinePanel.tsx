'use client'

import { useState } from 'react'
import { useComplianceTimeline, type ComplianceTimelineEvent } from '../hooks/useComplianceTimeline'
import { useComplianceFrameworks } from '../hooks/useComplianceFrameworks'
import { useComplianceControls } from '../hooks/useComplianceControls'
import { colors, radius, font, shadow, transition } from '@/components/ui/tokens'
import {
  Clock,
  ShieldAlert,
  Bell,
  CheckSquare,
  ListFilter,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Search,
  User
} from 'lucide-react'

const SOURCE_META: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  audit:    { icon: Clock,        color: colors.statusPending, label: 'Audit' },
  security: { icon: ShieldAlert,  color: colors.statusDanger,  label: 'Security' },
  alert:    { icon: Bell,         color: colors.statusWarning, label: 'Alert' },
  review:   { icon: CheckSquare,  color: colors.statusSuccess, label: 'Review' },
}

const SEV_COLOR: Record<string, string> = {
  critical: colors.roseLight,
  high: colors.amber,
  medium: colors.amberLight,
  low: colors.cyan,
}

// Function to generate dynamic impact badges based on event content
function getImpactBadges(ev: ComplianceTimelineEvent) {
  const label = ev.event_label.toLowerCase()
  const badges: { text: string; color: string }[] = []

  if (label.includes('evidence') || label.includes('attach') || label.includes('upload')) {
    badges.push({ text: 'Evidence Impact', color: '#38BDF8' }) // sky
    badges.push({ text: '+15% Score', color: '#10B981' })
  }
  if (label.includes('approve') || label.includes('signoff') || label.includes('review')) {
    badges.push({ text: 'Coverage Impact', color: '#A5B4FC' }) // indigo
    badges.push({ text: '+25% Coverage', color: '#10B981' })
  }
  if (label.includes('fail') || label.includes('warning') || label.includes('alert') || label.includes('incident')) {
    badges.push({ text: 'Risk Impact', color: '#F87171' }) // red
    badges.push({ text: '+30% Risk', color: '#EF4444' })
  } else if (label.includes('mitigate') || label.includes('resolve') || label.includes('pass')) {
    badges.push({ text: 'Risk Impact', color: '#34D399' }) // emerald
    badges.push({ text: '-20% Risk', color: '#10B981' })
  }

  // Fallback default badge if empty
  if (badges.length === 0) {
    badges.push({ text: 'Audit Impact', color: colors.textSecondary })
  }

  return badges
}

function EventRow({ ev }: { ev: ComplianceTimelineEvent }) {
  const meta = SOURCE_META[ev.source_type] ?? { icon: Clock, color: colors.textSecondary, label: ev.source_type }
  const IconComponent = meta.icon
  const sevColor = ev.severity ? SEV_COLOR[ev.severity] ?? colors.textMuted : colors.textFaint

  const formattedDate = new Date(ev.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const badges = getImpactBadges(ev)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '36px 1fr auto',
      alignItems: 'center',
      gap: '14px',
      padding: '12px 18px',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
      transition: transition.fast,
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Icon Wrapper */}
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: radius.md,
        background: `${meta.color}14`,
        border: `1px solid ${meta.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <IconComponent size={14} style={{ color: meta.color }} />
      </div>

      {/* Details */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500 }}>
            {ev.event_label}
          </span>
          <span style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: radius.full,
            background: `${meta.color}12`,
            color: meta.color,
            fontWeight: 700,
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
          }}>
            {meta.label}
          </span>
          {ev.severity && (
            <span style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: radius.full,
              background: `${sevColor}12`,
              color: sevColor,
              fontWeight: 700,
              textTransform: 'uppercase'
            }}>
              {ev.severity}
            </span>
          )}
          {ev.framework_name && (
            <span style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: radius.full,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.15)',
              color: colors.indigoLight,
              fontWeight: 600
            }}>
              {ev.framework_name}
            </span>
          )}
        </div>
        
        {/* Dynamic Correlation Impact Badges */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
          {badges.map((badge, idx) => (
            <span key={idx} style={{
              fontSize: '10px',
              background: `${badge.color}15`,
              color: badge.color,
              border: `1px solid ${badge.color}25`,
              borderRadius: radius.sm,
              padding: '1px 5px',
              fontWeight: 600
            }}>
              {badge.text}
            </span>
          ))}
          <span style={{ color: colors.textSecondary, fontSize: 11, marginLeft: '6px', fontFamily: font.mono }}>
            Category: {ev.category} {ev.control_id ? `| Control Ref: ${ev.control_id}` : ''}
          </span>
        </div>
      </div>

      {/* Date */}
      <span style={{ color: colors.textMuted, fontSize: 11, flexShrink: 0, fontFamily: font.mono }}>
        {formattedDate}
      </span>
    </div>
  )
}

export function ComplianceTimelinePanel() {
  const { frameworks } = useComplianceFrameworks()
  const { controls } = useComplianceControls()

  const [page, setPage] = useState(1)
  const [sourceType, setSourceType] = useState('')
  const [severity, setSeverity] = useState('')
  const [framework, setFramework] = useState('')
  const [controlId, setControlId] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [impactLevel, setImpactLevel] = useState('')

  const { events, total, loading, error, refetch } = useComplianceTimeline({
    page,
    limit: 25,
  })

  const handleApply = () => {
    refetch({
      page: 1,
      limit: 25,
      source_type: sourceType || undefined,
      severity: severity || undefined,
      framework: framework || undefined,
      control_id: controlId || undefined,
      since: since || undefined,
      until: until || undefined,
    })
    setPage(1)
  }

  const handleReset = () => {
    setSourceType('')
    setSeverity('')
    setFramework('')
    setControlId('')
    setSince('')
    setUntil('')
    setReviewer('')
    setImpactLevel('')
    refetch({
      page: 1,
      limit: 25,
      source_type: undefined,
      severity: undefined,
      framework: undefined,
      control_id: undefined,
      since: undefined,
      until: undefined,
    })
    setPage(1)
  }

  const pages = Math.max(1, Math.ceil(total / 25))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Compliance Storyline Flow Sequence Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: radius.xl,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} style={{ color: colors.indigoLight }} />
          <h4 style={{ margin: 0, color: colors.textPrimary, fontSize: '13px', fontWeight: 600 }}>
            Compliance Storyline Flow Sequence
          </h4>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'center'
        }}>
          {/* Step 1 */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.15)',
            borderRadius: radius.md,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <span style={{ color: '#38BDF8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Step 1: Evidence</span>
            <span style={{ color: colors.textPrimary, fontSize: '12px', fontWeight: 500 }}>Evidence Added</span>
          </div>

          <ArrowRight size={16} style={{ color: colors.textMuted }} />

          {/* Step 2 */}
          <div style={{
            background: 'rgba(165, 180, 252, 0.05)',
            border: '1px solid rgba(165, 180, 252, 0.15)',
            borderRadius: radius.md,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <span style={{ color: '#A5B4FC', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Step 2: Review</span>
            <span style={{ color: colors.textPrimary, fontSize: '12px', fontWeight: 500 }}>Review Approved</span>
          </div>

          <ArrowRight size={16} style={{ color: colors.textMuted }} />

          {/* Step 3 */}
          <div style={{
            background: 'rgba(52, 211, 153, 0.05)',
            border: '1px solid rgba(52, 211, 153, 0.15)',
            borderRadius: radius.md,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <span style={{ color: '#34D399', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Step 3: Coverage</span>
            <span style={{ color: colors.textPrimary, fontSize: '12px', fontWeight: 500 }}>Coverage Increased</span>
          </div>

          <ArrowRight size={16} style={{ color: colors.textMuted }} />

          {/* Step 4 */}
          <div style={{
            background: 'rgba(244, 63, 94, 0.05)',
            border: '1px solid rgba(244, 63, 94, 0.15)',
            borderRadius: radius.md,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <span style={{ color: '#F43F5E', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Step 4: Risk</span>
            <span style={{ color: colors.textPrimary, fontSize: '12px', fontWeight: 500 }}>Risk Reduced</span>
          </div>
        </div>
      </div>

      {/* Main Journal Board */}
      <div style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        overflow: 'hidden',
        boxShadow: shadow.sm,
        fontFamily: font.sans
      }}>
        {/* Header & Filter bar */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={16} style={{ color: colors.indigoLight }} />
              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14 }}>Compliance &amp; Governance Timeline</span>
              <span style={{
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: radius.full,
                padding: '2px 8px',
                color: colors.indigoLight,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: font.mono
              }}>
                {total} TOTAL EVENTS
              </span>
            </div>
          </div>

          {/* Dynamic Filters Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <label style={lblStyle}>Source</label>
              <select value={sourceType} onChange={e => setSourceType(e.target.value)} style={selectStyle}>
                <option value="">All Sources</option>
                <option value="audit">Audit Logs</option>
                <option value="security">Security Events</option>
                <option value="alert">Security Alerts</option>
                <option value="review">Control Reviews</option>
              </select>
            </div>

            <div>
              <label style={lblStyle}>Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} style={selectStyle}>
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label style={lblStyle}>Framework</label>
              <select value={framework} onChange={e => setFramework(e.target.value)} style={selectStyle}>
                <option value="">All Frameworks</option>
                {frameworks.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
            </div>

            <div>
              <label style={lblStyle}>Control ID</label>
              <select value={controlId} onChange={e => setControlId(e.target.value)} style={selectStyle}>
                <option value="">All Controls</option>
                {controls.map(c => (
                  <option key={c.id} value={c.control_id}>
                    {c.control_id} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Auditor/Reviewer Filter */}
            <div>
              <label style={lblStyle}>Reviewer/Auditor</label>
              <select value={reviewer} onChange={e => setReviewer(e.target.value)} style={selectStyle}>
                <option value="">All Assessors</option>
                <option value="hithaishi">Hithaishi (Super Admin)</option>
                <option value="sam">Sam Krishnamurthy (SecOps)</option>
                <option value="jordan">Jordan Blake (IAM Principal)</option>
                <option value="priya">Priya Nair (Compliance Manager)</option>
              </select>
            </div>

            {/* Impact Level Filter */}
            <div>
              <label style={lblStyle}>Impact Level</label>
              <select value={impactLevel} onChange={e => setImpactLevel(e.target.value)} style={selectStyle}>
                <option value="">All Impact Levels</option>
                <option value="high">High Impact</option>
                <option value="medium">Medium Impact</option>
                <option value="low">Low Impact</option>
              </select>
            </div>

            <div>
              <label style={lblStyle}>From Date</label>
              <input type="date" value={since} onChange={e => setSince(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={lblStyle}>To Date</label>
              <input type="date" value={until} onChange={e => setUntil(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Filter Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: `1px solid ${colors.glassBorder}`,
                color: colors.textSecondary,
                borderRadius: radius.md,
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 500,
                transition: transition.fast
              }}
              onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
              onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
            >
              Reset
            </button>
            <button
              onClick={handleApply}
              style={{
                background: 'rgba(99,102,241,0.08)',
                color: colors.indigoLight,
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: radius.md,
                padding: '6px 16px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: transition.fast
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
            >
              <ListFilter size={13} />
              Apply Filters
            </button>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: colors.textSecondary, fontSize: 13, fontFamily: font.mono }}>
            FETCHING COMPLIANCE JOURNAL...
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: colors.roseLight, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <AlertTriangle size={14} />
            <span>Error loading events: {error}</span>
          </div>
        ) : events.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            textAlign: 'center'
          }}>
            <Clock size={32} style={{ color: colors.textMuted, marginBottom: 12 }} />
            <div style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 500 }}>No Timeline Events Found</div>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
              Try resetting filters or expanding date ranges.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.map(ev => <EventRow key={ev.id} ev={ev} />)}
          </div>
        )}

        {/* Pagination */}
        {!loading && pages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(0,0,0,0.1)'
          }}>
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); refetch({ page: p }) }}
              disabled={page <= 1}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${colors.glassBorder}`,
                color: colors.textSecondary,
                borderRadius: radius.md,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                opacity: page <= 1 ? 0.3 : 1
              }}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span style={{ color: colors.textSecondary, fontSize: 11, fontFamily: font.mono }}>
              Page {page} / {pages}
            </span>
            <button
              onClick={() => { const p = Math.min(pages, page + 1); setPage(p); refetch({ page: p }) }}
              disabled={page >= pages}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${colors.glassBorder}`,
                color: colors.textSecondary,
                borderRadius: radius.md,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                opacity: page >= pages ? 0.3 : 1
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const lblStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: colors.textSecondary,
  marginBottom: 4,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: colors.bgPrimary,
  border: `1px solid ${colors.glassBorder}`,
  borderRadius: radius.md,
  color: colors.textPrimary,
  fontSize: 12,
  padding: '6px 10px',
  outline: 'none',
  transition: transition.fast,
  cursor: 'pointer',
  fontFamily: 'inherit'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: colors.bgPrimary,
  border: `1px solid ${colors.glassBorder}`,
  borderRadius: radius.md,
  color: colors.textPrimary,
  fontSize: 12,
  padding: '6px 10px',
  outline: 'none',
  transition: transition.fast,
  fontFamily: 'inherit'
}

'use client'

import { useState, useEffect } from 'react'
import { useComplianceReviews, type ReviewRow } from '../hooks/useComplianceReviews'
import type { ReviewStatus } from '@/types/database'
import { colors, radius, font, shadow, transition } from '@/components/ui/tokens'
import {
  ListFilter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Shield,
  Clock,
  ArrowRight,
  Loader2,
  Check,
  AlertTriangle,
  FileText,
  User,
  ExternalLink
} from 'lucide-react'

const STATUS_META: Record<ReviewStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:        { label: 'Pending',         color: colors.statusPending, bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)' },
  approved:       { label: 'Approved',        color: colors.statusSuccess, bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
  rejected:       { label: 'Rejected',        color: colors.statusDanger,  bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.15)' },
  needs_followup: { label: 'Needs Follow-up', color: colors.statusWarning, bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.15)' },
}

export function ReviewQueuePanel() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>(undefined)
  const { reviews, total, loading, error, mutate, limit, page, nextPage, prevPage, stats } = useComplianceReviews(statusFilter)

  // Active triage state
  const [activeReview, setActiveReview] = useState<ReviewRow | null>(null)
  const [notes, setNotes] = useState('')
  const [nextReviewDate, setNextReviewDate] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Hover state for rows
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)

  // Update notes/date when active review changes
  useEffect(() => {
    if (activeReview) {
      setNotes(activeReview.notes ?? '')
      setNextReviewDate(activeReview.next_review_date ?? '')
      setActionError(null)
    } else {
      setNotes('')
      setNextReviewDate('')
    }
  }, [activeReview])

  const applyDatePreset = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    setNextReviewDate(`${yyyy}-${mm}-${dd}`)
  }

  const handleTriage = async (status: ReviewStatus) => {
    if (!activeReview) return
    if ((status === 'rejected' || status === 'needs_followup') && !notes.trim()) {
      setActionError('Audit justification note is required for Reject or Flag for Action/Follow-up.')
      return
    }
    setActionBusy(true)
    setActionError(null)
    try {
      await mutate(
        activeReview.id,
        status,
        notes.trim() || undefined,
        nextReviewDate.trim() || undefined
      )
      // Reset selected item after mutation
      setActiveReview(null)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start', fontFamily: font.sans }}>
      {/* Review Statistics Header */}
      <div style={{
        gridColumn: 'span 2',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 8
      }}>
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.lg,
          padding: '12px 16px',
          boxShadow: shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Open Reviews</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary }}>{stats?.openReviews ?? 0}</span>
        </div>
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.lg,
          padding: '12px 16px',
          boxShadow: shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Overdue Reviews</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: (stats?.overdueReviews ?? 0) > 0 ? colors.roseLight : colors.textPrimary }}>{stats?.overdueReviews ?? 0}</span>
        </div>
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.lg,
          padding: '12px 16px',
          boxShadow: shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Completed (Month)</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.emeraldLight }}>{stats?.completedThisMonth ?? 0}</span>
        </div>
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.lg,
          padding: '12px 16px',
          boxShadow: shadow.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          <span style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Avg Triage Time</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.indigoLight }}>{stats?.avgReviewTimeHours ?? 0.0}h</span>
        </div>
      </div>

      {/* Left Column: Triage List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Filters bar */}
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.lg,
          padding: '12px 16px',
          boxShadow: shadow.sm
        }}>
          <ListFilter size={14} style={{ color: colors.textSecondary, marginRight: 4 }} />
          {([undefined, 'pending', 'needs_followup', 'approved', 'rejected'] as const).map(s => {
            const isSelected = statusFilter === s
            return (
              <button
                key={s ?? 'all'}
                onClick={() => {
                  setStatusFilter(s as ReviewStatus | undefined)
                  setActiveReview(null)
                }}
                style={{
                  background: isSelected ? 'rgba(99,102,241,0.12)' : 'transparent',
                  border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                  color: isSelected ? colors.indigoLight : colors.textSecondary,
                  borderRadius: radius.md,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  transition: transition.fast
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.color = colors.textPrimary
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.color = colors.textSecondary
                }}
              >
                {s ? s.replace('_', ' ').toUpperCase() : 'ALL'}
              </button>
            )
          })}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.textMuted, fontFamily: font.mono }}>
            {total} RECORD{total !== 1 ? 'S' : ''}
          </span>
        </div>

        {/* List Panel */}
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
          boxShadow: shadow.sm,
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '80px 0', color: colors.textSecondary }}>
              <Loader2 size={32} className="animate-spin" style={{ color: colors.indigoLight }} />
              <span>Fetching compliance reviews...</span>
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: colors.roseLight, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          ) : reviews.length === 0 ? (
            /* Empty State */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 24px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <CheckCircle2 size={22} style={{ color: colors.emerald }} />
              </div>
              <h4 style={{ color: colors.textPrimary, fontSize: '0.9rem', fontWeight: 600, margin: '0 0 6px 0' }}>
                All Systems Clear
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '0.8rem', margin: 0, maxWidth: '280px' }}>
                No reviews pending triage. Your organization remains fully compliant.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {reviews.map(r => {
                const sm = STATUS_META[r.status]
                const ctrl = r.compliance_controls
                const fw = ctrl?.compliance_frameworks?.name
                const isActive = activeReview?.id === r.id
                const isOverdue = r.next_review_date
                  ? new Date(r.next_review_date) < new Date()
                  : false

                return (
                  <div
                    key={r.id}
                    onClick={() => setActiveReview(r)}
                    onMouseEnter={() => setHoveredRowId(r.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                    style={{
                      background: isActive
                        ? 'rgba(99,102,241,0.06)'
                        : (hoveredRowId === r.id ? 'rgba(255,255,255,0.02)' : 'transparent'),
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s ease',
                      borderLeft: `3px solid ${isActive ? colors.indigo : 'transparent'}`
                    }}
                  >
                    <div style={{ flex: 1, marginRight: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
                          borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                        }}>{sm.label.toUpperCase()}</span>

                        {isOverdue && r.status === 'pending' && (
                          <span style={{
                            background: 'rgba(244,63,94,0.08)', color: colors.roseLight, border: `1px solid rgba(244,63,94,0.2)`,
                            borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                          }}>
                            OVERDUE
                          </span>
                        )}
                        {fw && <span style={{ fontSize: 11, color: colors.textSecondary }}>{fw}</span>}
                      </div>

                      <div style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 500 }}>
                        {ctrl?.control_id} — {ctrl?.title ?? 'Unknown control'}
                      </div>

                      {r.notes && (
                        <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={10} style={{ color: colors.textMuted }} />
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                            {r.notes}
                          </span>
                        </div>
                      )}
                    </div>

                    <ArrowRight size={14} style={{
                      color: isActive ? colors.indigoLight : colors.textMuted,
                      transform: isActive ? 'translateX(3px)' : 'none',
                      transition: 'transform 0.15s ease, color 0.15s ease'
                    }} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && total > limit && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(0,0,0,0.1)'
            }}>
              <button
                onClick={prevPage}
                disabled={page <= 1}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.glassBorder}`,
                  color: colors.textSecondary, borderRadius: radius.md, padding: '5px 12px', cursor: 'pointer',
                  fontSize: 12, opacity: page <= 1 ? 0.3 : 1
                }}
              >
                ← Prev
              </button>
              <span style={{ color: colors.textSecondary, fontSize: 11, fontFamily: font.mono }}>
                Page {page} / {Math.ceil(total / limit)}
              </span>
              <button
                onClick={nextPage}
                disabled={page * limit >= total}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.glassBorder}`,
                  color: colors.textSecondary, borderRadius: radius.md, padding: '5px 12px', cursor: 'pointer',
                  fontSize: 12, opacity: page * limit >= total ? 0.3 : 1
                }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Triage Pane */}
      <div style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.lg,
        padding: 20,
        boxShadow: shadow.md,
        minHeight: '468px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {!activeReview ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            color: colors.textSecondary,
            flex: 1
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '40px 20px 20px 20px'
            }}>
              <Shield size={32} style={{ color: colors.textMuted, marginBottom: 12 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>Triage Workstation</span>
              <span style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4, maxWidth: '220px' }}>
                Select a control review from the queue to start validation audit.
              </span>
            </div>

            <div style={{ width: '100%', marginTop: 16, textAlign: 'left' }}>
              <div style={{ 
                fontSize: 11, 
                fontWeight: 600, 
                color: colors.textPrimary, 
                textTransform: 'uppercase', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: 6,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <FileText size={12} style={{ color: colors.indigoLight }} />
                Recent Decision History
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviews.filter(r => r.status !== 'pending').slice(0, 5).length === 0 ? (
                  <span style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
                    No recent decisions made yet in this view.
                  </span>
                ) : (
                  reviews.filter(r => r.status !== 'pending').slice(0, 5).map((r, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: radius.md,
                      padding: 8,
                      fontSize: 11
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: colors.textPrimary, fontWeight: 600, fontFamily: font.mono }}>
                          {r.compliance_controls?.control_id}
                        </span>
                        <span style={{
                          background: `${STATUS_META[r.status]?.color}15`,
                          color: STATUS_META[r.status]?.color,
                          borderRadius: 3,
                          padding: '1px 4px',
                          fontSize: 9,
                          fontWeight: 700
                        }}>
                          {STATUS_META[r.status]?.label.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.textSecondary, fontSize: 10 }}>
                        <span>By: {r.reviewer_email || 'Auditor'}</span>
                        <span>{r.review_date ? new Date(r.review_date).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      {r.notes && (
                        <div style={{ color: colors.textPrimary, marginTop: 4, fontStyle: 'italic', fontSize: 10 }}>
                          "{r.notes}"
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
            {/* Header / Meta */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{
                  background: 'rgba(99,102,241,0.08)', color: colors.indigoLight, border: '1px solid rgba(99,102,241,0.15)',
                  borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, fontFamily: font.mono
                }}>
                  {activeReview.compliance_controls?.control_id}
                </span>
                <span style={{
                  fontSize: 10,
                  color: activeReview.compliance_controls?.severity === 'critical' || activeReview.compliance_controls?.severity === 'high' ? colors.roseLight : colors.textSecondary,
                  fontWeight: 600,
                  textTransform: 'uppercase'
                }}>
                  Severity: {activeReview.compliance_controls?.severity}
                </span>
              </div>
              <h4 style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 600, margin: '0 0 6px 0', lineHeight: 1.3 }}>
                {activeReview.compliance_controls?.title}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <span style={{ fontSize: 11, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={12} style={{ color: colors.textMuted }} />
                  Reviewer: {activeReview.reviewer_id.slice(0, 8)}...
                </span>
                <span style={{ fontSize: 11, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} style={{ color: colors.textMuted }} />
                  Status: {activeReview.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Triage Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>
                  Reviewer Audit Notes
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Enter audit validation findings, compliance remarks or follow-up details..."
                  style={{
                    width: '100%', height: '110px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.glassBorder}`,
                    borderRadius: radius.md, padding: '10px 12px', color: colors.textPrimary, fontSize: 13,
                    outline: 'none', transition: transition.fast, resize: 'none', fontFamily: 'inherit'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                  onBlur={e => e.target.style.borderColor = colors.glassBorder}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>
                  Next Scheduled Audit Date
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    type="date"
                    value={nextReviewDate}
                    onChange={e => setNextReviewDate(e.target.value)}
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.glassBorder}`,
                      borderRadius: radius.md, padding: '8px 12px', color: colors.textPrimary, fontSize: 13,
                      outline: 'none', transition: transition.fast
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                    onBlur={e => e.target.style.borderColor = colors.glassBorder}
                  />
                  <button
                    type="button"
                    onClick={() => setNextReviewDate('')}
                    style={{
                      background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.glassBorder}`,
                      borderRadius: radius.md, padding: '0 10px', color: colors.textSecondary, cursor: 'pointer',
                      fontSize: 12, transition: transition.fast
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
                    onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
                  >
                    Clear
                  </button>
                </div>

                {/* Presets bar */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(30)}
                    style={presetBtnStyle}
                    onMouseEnter={presetHover}
                    onMouseLeave={presetLeave}
                  >
                    +30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(90)}
                    style={presetBtnStyle}
                    onMouseEnter={presetHover}
                    onMouseLeave={presetLeave}
                  >
                    +90 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(180)}
                    style={presetBtnStyle}
                    onMouseEnter={presetHover}
                    onMouseLeave={presetLeave}
                  >
                    +180 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset(365)}
                    style={presetBtnStyle}
                    onMouseEnter={presetHover}
                    onMouseLeave={presetLeave}
                  >
                    +1 Year
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {actionError && (
              <div style={{ color: colors.roseLight, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, margin: '12px 0' }}>
                <AlertTriangle size={12} />
                <span>{actionError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleTriage('approved')}
                  style={{
                    background: 'rgba(16,185,129,0.08)', color: colors.emeraldLight, border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: radius.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: transition.fast
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
                >
                  {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Approve Control
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleTriage('rejected')}
                  style={{
                    background: 'rgba(244,63,94,0.08)', color: colors.roseLight, border: '1px solid rgba(244,63,94,0.25)',
                    borderRadius: radius.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: transition.fast
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.08)'}
                >
                  {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Reject Audit
                </button>
              </div>

              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleTriage('needs_followup')}
                style={{
                  background: 'rgba(245,158,11,0.08)', color: colors.amberLight, border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: radius.md, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: transition.fast
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
              >
                {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                Flag for Action / Follow-up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const presetBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: `1px solid ${colors.glassBorder}`,
  color: colors.textSecondary,
  borderRadius: radius.sm,
  padding: '4px 8px',
  fontSize: 11,
  cursor: 'pointer',
  transition: transition.fast
}

const presetHover = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
  e.currentTarget.style.color = colors.textPrimary
}

const presetLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = colors.glassBorder
  e.currentTarget.style.color = colors.textSecondary
}

'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, ChevronRight, Check } from 'lucide-react'
import { colors, font, radius, transition } from '@/components/ui/tokens'
import { fetchUserUsage, requestTierUpgrade, fetchUpgradeRequestStatus } from '../actions'
import type { UserUsage, TierLimits } from '../limits'
import { isTierRestricted } from '../limits'
import { useToast } from '@/components/ui/Toast'

interface Props {
  role?: string
}

export function UsageWidget({ role }: Props) {
  const toasts = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [usage, setUsage] = useState<UserUsage | null>(null)
  const [limits, setLimits] = useState<TierLimits | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Upgrade Request Status
  const [requestStatus, setRequestStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)

  // Request Access Modal Form State
  const [targetTier, setTargetTier] = useState<'academic_user' | 'approved_user'>('academic_user')
  const [justification, setJustification] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  async function loadData(showRefreshIndicator = false) {
    if (showRefreshIndicator) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [resUsage, resStatus] = await Promise.all([
        fetchUserUsage(),
        fetchUpgradeRequestStatus()
      ])

      if (resUsage.success && resUsage.usage && resUsage.limits) {
        setUsage(resUsage.usage)
        setLimits(resUsage.limits)
      } else {
        setError(resUsage.error || 'Failed to load usage metrics')
      }

      if (resStatus.success && resStatus.status !== undefined) {
        setRequestStatus(resStatus.status)
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (role && isTierRestricted(role)) {
      loadData()
    }
  }, [role])

  if (!role || !isTierRestricted(role)) {
    return null
  }

  const aiMax = limits?.aiRequests ?? 10
  const docsMax = limits?.documentUploads ?? 3
  const storageMaxMb = limits?.storageMb ?? 5

  const aiUsed = usage?.aiRequests ?? 0
  const docsUsed = usage?.documentUploads ?? 0
  const storageUsedMb = usage?.storageBytes ? (usage.storageBytes / (1024 * 1024)) : 0

  const aiPercent = Math.min(100, (aiUsed / aiMax) * 100)
  const docsPercent = Math.min(100, (docsUsed / docsMax) * 100)
  const storagePercent = Math.min(100, (storageUsedMb / storageMaxMb) * 100)

  async function handleSubmitUpgrade(e: React.FormEvent) {
    e.preventDefault()
    if (!termsAccepted) {
      setUpgradeError('You must accept the terms.')
      return
    }
    setSubmittingUpgrade(true)
    setUpgradeError(null)
    setUpgradeSuccess(false)

    try {
      const res = await requestTierUpgrade({
        targetTier,
        justification,
      })

      if (res.success) {
        setUpgradeSuccess(true)
        setJustification('')
        setTermsAccepted(false)
        setRequestStatus('pending')
        toasts.success('Upgrade request submitted successfully!')
        setTimeout(() => {
          setModalOpen(false)
          setUpgradeSuccess(false)
        }, 3000)
      } else {
        setUpgradeError(res.error || 'Failed to submit request')
      }
    } catch (err) {
      setUpgradeError('Connection error occurred.')
    } finally {
      setSubmittingUpgrade(false)
    }
  }

  return (
    <div
      style={{
        padding: '12px 14px',
        margin: '8px 12px 16px',
        borderRadius: radius.md,
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: colors.textMuted,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Trial Usage Meter
        </span>
        <button
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          style={{
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RefreshCw
            size={10}
            style={{
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              color: refreshing ? colors.indigoLight : undefined,
            }}
          />
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '11px', color: colors.textMuted, textAlign: 'center', padding: '6px' }}>
          Loading usage metrics...
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: colors.rose }}>
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* AI Requests */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: colors.textSecondary }}>AI Requests</span>
              <span style={{ fontWeight: 600, color: aiUsed >= aiMax ? colors.rose : colors.textPrimary }}>
                {aiUsed} / {aiMax}
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${aiPercent}%`,
                  height: '100%',
                  background: aiUsed >= aiMax ? colors.rose : `linear-gradient(90deg, ${colors.indigo}, ${colors.violet})`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Daily Doc Uploads */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: colors.textSecondary }}>Daily Uploads</span>
              <span style={{ fontWeight: 600, color: docsUsed >= docsMax ? colors.rose : colors.textPrimary }}>
                {docsUsed} / {docsMax}
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${docsPercent}%`,
                  height: '100%',
                  background: docsUsed >= docsMax ? colors.rose : `linear-gradient(90deg, ${colors.sky}, ${colors.indigo})`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Active Documents */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: colors.textSecondary }}>Active Documents</span>
              <span style={{ fontWeight: 600, color: (usage?.totalDocuments ?? 0) >= docsMax ? colors.rose : colors.textPrimary }}>
                {usage?.totalDocuments ?? 0} / {docsMax}
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, ((usage?.totalDocuments ?? 0) / docsMax) * 100)}%`,
                  height: '100%',
                  background: (usage?.totalDocuments ?? 0) >= docsMax ? colors.rose : `linear-gradient(90deg, ${colors.indigo}, ${colors.sky})`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Storage MB */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: colors.textSecondary }}>Vault Storage</span>
              <span style={{ fontWeight: 600, color: storageUsedMb >= storageMaxMb ? colors.rose : colors.textPrimary }}>
                {storageUsedMb.toFixed(2)} MB / {storageMaxMb} MB
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${storagePercent}%`,
                  height: '100%',
                  background: storageUsedMb >= storageMaxMb ? colors.rose : `linear-gradient(90deg, ${colors.emerald}, ${colors.sky})`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Request Upgrade Button & Status */}
          {requestStatus === 'pending' ? (
            <div
              style={{
                marginTop: '4px',
                padding: '8px 10px',
                borderRadius: radius.sm,
                background: 'rgba(245, 158, 11, 0.06)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                color: '#FDE68A',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#F59E0B',
                  boxShadow: '0 0 8px #F59E0B',
                  animation: 'pulse 2s infinite',
                }}
              />
              <span>Upgrade Request Pending Review</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {requestStatus === 'rejected' && (
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: radius.sm,
                    background: 'rgba(244, 63, 94, 0.05)',
                    border: '1px solid rgba(244, 63, 94, 0.15)',
                    color: colors.rose,
                    fontSize: '10px',
                    fontWeight: 500,
                    textAlign: 'center',
                  }}
                >
                  Previous request declined. Please re-apply.
                </div>
              )}
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  marginTop: '4px',
                  padding: '6px 10px',
                  borderRadius: radius.sm,
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  color: colors.indigoLight,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: transition.fast,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)'
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)'
                }}
              >
                <span>Request Access Upgrade</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Request Access Upgrade Modal ────────────────────────────────────── */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#0D111A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: radius.lg,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' }}>
                Request Workspace Upgrade
              </h3>
              <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0 }}>
                Request access to academic schemas or approved practitioner tiers.
              </p>
            </div>

            {upgradeSuccess ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: radius.md,
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.emerald,
                  }}
                >
                  <Check size={20} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>
                  Upgrade Request Submitted
                </span>
                <span style={{ fontSize: '12px', color: colors.textMuted }}>
                  Your justification has been recorded and logged. Administrators will review your request shortly.
                </span>
              </div>
            ) : (
              <form onSubmit={handleSubmitUpgrade} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {upgradeError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      background: 'rgba(244, 63, 94, 0.05)',
                      border: '1px solid rgba(244, 63, 94, 0.15)',
                      borderRadius: radius.sm,
                      color: colors.rose,
                      fontSize: '12px',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{upgradeError}</span>
                  </div>
                )}

                {/* Target Tier Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Target Role Tier
                  </label>
                  <select
                    value={targetTier}
                    onChange={(e) => setTargetTier(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: radius.sm,
                      color: colors.textPrimary,
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    <option value="academic_user" style={{ background: '#0D111A' }}>Academic Scholar (Limit: 100 AI queries, 25 uploads)</option>
                    <option value="approved_user" style={{ background: '#0D111A' }}>Approved Practitioner (Limit: 250 AI queries, 100 uploads)</option>
                  </select>
                </div>

                {/* Justification Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Justification
                    </label>
                    <span style={{ fontSize: '10px', color: colors.textMuted }}>
                      {justification.length} / 500 chars
                    </span>
                  </div>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    required
                    maxLength={500}
                    placeholder="Briefly explain how AegisRAG will be utilized for research, enterprise validation, or regulatory audits..."
                    style={{
                      width: '100%',
                      height: '100px',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: radius.sm,
                      color: colors.textPrimary,
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none',
                      lineHeight: '1.5',
                    }}
                  />
                </div>

                {/* Terms and Conditions Checkbox */}
                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', userSelect: 'none', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', color: colors.textMuted, lineHeight: '1.4' }}>
                    I certify that all information is accurate and will adhere to workspace policies.
                  </span>
                </label>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: radius.sm,
                      color: colors.textSecondary,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUpgrade}
                    style={{
                      padding: '8px 16px',
                      background: colors.indigo,
                      border: 'none',
                      borderRadius: radius.sm,
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: submittingUpgrade ? 0.7 : 1,
                    }}
                  >
                    {submittingUpgrade ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Basic spinning and pulsing keyframe rules */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

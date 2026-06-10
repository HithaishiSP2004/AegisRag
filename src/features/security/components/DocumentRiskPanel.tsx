'use client'

import { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { useDocumentRisk } from '../hooks/useDocumentRisk'
import type { DocumentRiskFlag } from '../hooks/useDocumentRisk'
import { colors, radius, font } from '@/components/ui/tokens'

const SENS_COLOR: Record<string, string> = {
  public:       '#10B981', // Green
  internal:     '#38BDF8', // Cyan
  confidential: '#F59E0B', // Amber
  restricted:   '#FF4D6D', // Red
}

export function DocumentRiskPanel() {
  const { flags, summary, loading, error, refetch, mutate } = useDocumentRisk({ mismatches_only: true, limit: 20 })
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})

  async function handleAction(id: string, action: 'review' | 'dismiss') {
    setBusyMap(prev => ({ ...prev, [id]: true }))
    try {
      await mutate(id, action)
      refetch({ mismatches_only: true })
    } catch (err) {
      console.error(err)
    } finally {
      setBusyMap(prev => ({ ...prev, [id]: false }))
    }
  }

  // Calculate Matrix Distribution
  const matrixCounts = useMemo(() => {
    let high = 0
    let med = 0
    let low = 0

    flags.forEach(f => {
      if (f.reviewed) return
      if (f.risk_score >= 70) high++
      else if (f.risk_score >= 40) med++
      else low++
    })

    return { high, med, low }
  }, [flags])

  const distributionItems = useMemo(() => {
    const dist = summary?.sensitivity_distribution ?? { public: 0, internal: 0, confidential: 0, restricted: 0 }
    const totalDocs = summary?.total_indexed_docs ?? 0

    const items = [
      { name: 'Public', color: '#10B981', count: dist.public },
      { name: 'Internal', color: '#38BDF8', count: dist.internal },
      { name: 'Confidential', color: '#F59E0B', count: dist.confidential },
      { name: 'Restricted', color: '#FF4D6D', count: dist.restricted }
    ]

    return items.map(item => {
      const pct = totalDocs > 0 ? Math.round((item.count / totalDocs) * 100) : 0
      return { ...item, pct }
    })
  }, [summary])

  const hasRiskData = matrixCounts.high > 0 || matrixCounts.med > 0 || matrixCounts.low > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:document-bold" width={18} style={{ color: '#F59E0B' }} />
          <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.85rem' }}>Document Risk Observability & Sensitivity Scan</span>
        </div>
        <button
          id="doc-risk-refresh"
          onClick={() => refetch({ mismatches_only: true })}
          style={{
            padding: '5px 12px',
            borderRadius: radius.md,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.20)',
            color: '#F59E0B',
            fontSize: '0.72rem',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.15)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.08)' }}
        >
          Rescan Index
        </button>
      </div>

      {loading && (
        <div style={{ padding: '60px', textAlign: 'center', color: '#475569', fontSize: '0.8rem', fontFamily: font.mono }}>
          <Icon icon="solar:spinner-line-duotone" width={24} className="animate-spin" style={{ color: '#F59E0B', margin: '0 auto 8px' }} />
          SCANNING CLASSIFICATION VECTOR SPACE...
        </div>
      )}

      {!loading && error && (
        <div style={{ color: '#FF4D6D', fontSize: '0.8rem', padding: '20px', border: '1px dashed rgba(255,77,109,0.3)', borderRadius: radius.lg }}>
          Failed to scan documents: {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '20px',
          alignItems: 'start'
        }}>
          
          {/* Left Column: List of Mismatches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              background: '#090D18',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: radius.xl,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                color: '#E2E8F0',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Icon icon="solar:shield-warning-bold" width={15} style={{ color: '#F59E0B' }} />
                <span>Active Sensitivity Mismatches</span>
                {summary && summary.unreviewed_mismatches > 0 && (
                  <span style={{
                    background: 'rgba(245,158,11,0.10)',
                    border: '1px solid rgba(245,158,11,0.20)',
                    borderRadius: radius.full,
                    padding: '1px 6px',
                    color: '#F59E0B',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    marginLeft: '4px',
                  }}>{summary.unreviewed_mismatches} Flagged</span>
                )}
              </div>

              {flags.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '50px 24px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: radius.full,
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}>
                    <Icon icon="solar:shield-check-bold" width={20} style={{ color: '#10B981' }} />
                  </div>
                  <h4 style={{ color: '#E2E8F0', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 4px' }}>
                    Index Integrity Secured
                  </h4>
                  <p style={{ color: '#64748B', fontSize: '0.7rem', margin: 0, maxWidth: '280px' }}>
                    No document sensitivity level mismatches detected. All access controls aligned.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {flags.map((flag) => {
                    const isBusy = busyMap[flag.id] || false
                    const docName = flag.documents?.original_name || 'document_node.bin'
                    const docType = flag.documents?.doc_type || 'PDF'

                    // Risk metrics reasoning fallbacks
                    let riskType = 'Sensitivity Conflict'
                    if (flag.risk_score >= 80) riskType = 'Critical Mismatch (Restricted Data)'
                    else if (flag.risk_score >= 60) riskType = 'Confidential Spill Danger'

                    return (
                      <div
                        key={flag.id}
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          opacity: flag.reviewed ? 0.5 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: radius.sm,
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              <Icon icon={docType === 'pdf' ? 'solar:document-text-bold' : 'solar:document-bold'} width={12} style={{ color: '#64748B' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: '#E2E8F0', fontSize: '0.78rem', fontWeight: 600 }}>{docName}</span>
                              <span style={{ fontSize: '0.62rem', color: '#475569', fontFamily: font.mono }}>ID: {flag.document_id.slice(0, 12)}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              color: flag.risk_score >= 70 ? '#FF4D6D' : flag.risk_score >= 40 ? '#F59E0B' : '#10B981',
                              background: flag.risk_score >= 70 ? 'rgba(255,77,109,0.1)' : flag.risk_score >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                              padding: '2px 8px',
                              borderRadius: radius.full,
                              fontFamily: font.mono,
                            }}>
                              Risk Score: {flag.risk_score}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: '#475569' }}>{riskType}</span>
                          </div>
                        </div>

                        {/* Classification Swap Row */}
                        <div style={{
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.03)',
                          borderRadius: radius.md,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Declared:</span>
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: SENS_COLOR[flag.declared_sensitivity] || '#94A3B8',
                              background: `${SENS_COLOR[flag.declared_sensitivity]}10`,
                              border: `1px solid ${SENS_COLOR[flag.declared_sensitivity]}25`,
                              padding: '1px 6px',
                              borderRadius: radius.xs,
                              textTransform: 'uppercase',
                            }}>{flag.declared_sensitivity}</span>
                          </div>

                          <Icon icon="solar:double-alt-arrow-right-linear" width={12} style={{ color: '#334155' }} />

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Detected:</span>
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              color: SENS_COLOR[flag.detected_sensitivity] || '#94A3B8',
                              background: `${SENS_COLOR[flag.detected_sensitivity]}10`,
                              border: `1px solid ${SENS_COLOR[flag.detected_sensitivity]}25`,
                              padding: '1px 6px',
                              borderRadius: radius.xs,
                              textTransform: 'uppercase',
                            }}>{flag.detected_sensitivity}</span>
                          </div>
                        </div>

                        {/* Reason & Findings */}
                        {flag.reasoning && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 600 }}>Risk Findings:</span>
                            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.7rem', lineHeight: 1.35 }}>
                              {flag.reasoning}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        {!flag.reviewed && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                                id={`risk-review-${flag.id}`}
                                onClick={() => handleAction(flag.id, 'review')}
                                disabled={isBusy}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: radius.md,
                                  background: 'rgba(245,158,11,0.12)',
                                  border: '1px solid rgba(245,158,11,0.25)',
                                  color: '#F59E0B',
                                  fontSize: '0.68rem',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                            >
                              Review Risk
                            </button>
                            <button
                                id={`risk-dismiss-${flag.id}`}
                                onClick={() => handleAction(flag.id, 'dismiss')}
                                disabled={isBusy}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: radius.md,
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  color: '#94A3B8',
                                  fontSize: '0.68rem',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                }}
                            >
                              Dismiss Flag
                            </button>
                          </div>
                        )}
                        {flag.reviewed && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981', fontSize: '0.65rem', fontWeight: 600 }}>
                            <Icon icon="solar:check-circle-bold" width={12} />
                            <span>Reviewed & Secured</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Visual Summary Stats, Distribution, Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* General Index Statistics */}
            <div style={{
              background: '#090D18',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: radius.xl,
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <Icon icon="solar:folder-open-bold" width={15} style={{ color: '#F59E0B' }} />
                <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.8rem' }}>Index Scan Diagnostics</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Indexed Corpus</span>
                  <span style={{ fontSize: '0.75rem', color: '#E2E8F0', fontWeight: 600, fontFamily: font.mono }}>
                    {summary?.total_indexed_docs ?? 0} docs
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Sensitivity Integrity</span>
                  <span style={{ fontSize: '0.75rem', color: (summary?.unreviewed_mismatches ?? 0) > 0 ? '#F59E0B' : '#10B981', fontWeight: 600, fontFamily: font.mono }}>
                    {(summary?.unreviewed_mismatches ?? 0) > 0 ? 'WARNING' : 'SECURE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748B' }}>Classification Scan Range</span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>Full Corpus</span>
                </div>
              </div>
            </div>

            {/* Classification Distribution Chart */}
            <div style={{
              background: '#090D18',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: radius.xl,
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                <Icon icon="solar:chart-square-bold" width={15} style={{ color: '#F59E0B' }} />
                <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.8rem' }}>Classification Distribution</span>
              </div>

              {/* Progress bars representing document shares */}
              {summary?.total_indexed_docs === 0 ? (
                <div style={{ padding: '20px 10px', textAlign: 'center', color: '#64748B', fontSize: '0.7rem' }}>
                  <Icon icon="solar:info-circle-bold" width={16} style={{ color: '#64748B', margin: '0 auto 8px', display: 'block' }} />
                  No documents indexed. Upload files to trigger auto-classification scan.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {distributionItems.map((item) => (
                    <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                        <span style={{ color: '#94A3B8', fontWeight: 500 }}>{item.name}</span>
                        <span style={{ color: '#64748B', fontFamily: font.mono }}>{item.count} ({item.pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: radius.full, overflow: 'hidden' }}>
                        <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: radius.full }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3x3 Risk Matrix */}
            {hasRiskData && (
              <div style={{
                background: '#090D18',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: radius.xl,
                padding: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Icon icon="solar:grid-bold" width={15} style={{ color: '#F59E0B' }} />
                  <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.8rem' }}>Operational Risk Matrix</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '0.62rem', color: '#64748B', lineHeight: 1.3 }}>
                  Maps active vulnerabilities by Impact vs Likelihood density based on AI classification.
                </p>

                {/* 3x3 Matrix Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  
                  {/* HIGH LIKELIHOOD ROW */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 600, textAlign: 'right', paddingRight: '4px' }}>High</span>
                    
                    {/* Low Impact / High Likelihood (Yellow) */}
                    <div style={{ height: '36px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#F59E0B', fontWeight: 700 }}>0</span>
                    </div>

                    {/* Med Impact / High Likelihood (Orange) */}
                    <div style={{ height: '36px', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#FB923C', fontWeight: 700 }}>{matrixCounts.med}</span>
                    </div>

                    {/* High Impact / High Likelihood (Red) */}
                    <div style={{ height: '36px', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#FF4D6D', fontWeight: 700 }}>{matrixCounts.high}</span>
                    </div>
                  </div>

                  {/* MED LIKELIHOOD ROW */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 600, textAlign: 'right', paddingRight: '4px' }}>Med</span>
                    
                    {/* Low Impact / Med Likelihood (Green-Yellow) */}
                    <div style={{ height: '36px', background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#10B981', fontWeight: 700 }}>{matrixCounts.low}</span>
                    </div>

                    {/* Med Impact / Med Likelihood (Yellow) */}
                    <div style={{ height: '36px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#F59E0B', fontWeight: 700 }}>0</span>
                    </div>

                    {/* High Impact / Med Likelihood (Orange) */}
                    <div style={{ height: '36px', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#FB923C', fontWeight: 700 }}>0</span>
                    </div>
                  </div>

                  {/* LOW LIKELIHOOD ROW */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 600, textAlign: 'right', paddingRight: '4px' }}>Low</span>
                    
                    {/* Low Impact / Low Likelihood (Green) */}
                    <div style={{ height: '36px', background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.05)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#64748B', fontWeight: 500 }}>0</span>
                    </div>

                    {/* Med Impact / Low Likelihood (Green) */}
                    <div style={{ height: '36px', background: 'rgba(16,185,129,0.02)', border: '1px solid rgba(16,185,129,0.05)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#64748B', fontWeight: 500 }}>0</span>
                    </div>

                    {/* High Impact / Low Likelihood (Yellow) */}
                    <div style={{ height: '36px', background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)', borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: font.mono, color: '#64748B', fontWeight: 500 }}>0</span>
                    </div>
                  </div>

                  {/* MATRIX FOOTER (IMPACT LABEL) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr', gap: '4px', marginTop: '2px', textAlign: 'center', fontSize: '0.55rem', color: '#475569', fontWeight: 600 }}>
                    <span />
                    <span>Low Impact</span>
                    <span>Med Impact</span>
                    <span>High Impact</span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  )
}

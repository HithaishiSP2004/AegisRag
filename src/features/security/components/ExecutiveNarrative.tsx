'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileText, Compass, AlertCircle, TrendingUp, Sparkles, Info, RefreshCw } from 'lucide-react'
import { colors, radius, font } from '@/components/ui/tokens'

interface Props {
  data: any
  loading: boolean
}

type NarrativeSection = 'executive' | 'compliance' | 'security' | 'retrieval' | 'governance'

interface NarrativeState {
  title: string
  firm: string
  summary: string
  what: string
  why: string
  impact: string
  next: string
}

export function ExecutiveNarrative({ data, loading }: Props) {
  const [activeSection, setActiveSection] = useState<NarrativeSection>('executive')
  const [narratives, setNarratives] = useState<Record<string, NarrativeState>>({})
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = data?.days ?? 30

  const fetchNarrative = useCallback(async (section: NarrativeSection, force = false) => {
    setFetching(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/narrative?reportType=${section}&days=${days}${force ? '&forceRefresh=true' : ''}`)
      if (!res.ok) {
        throw new Error('Failed to retrieve advisory narrative')
      }
      const json = await res.json()
      setNarratives(prev => ({
        ...prev,
        [`${section}-${days}`]: json
      }))
    } catch (err: any) {
      setError(err?.message || 'Error generating advisory brief')
    } finally {
      setFetching(false)
    }
  }, [days])

  // Fetch when active section or days changes, if not already fetched
  useEffect(() => {
    if (!loading && data) {
      const cacheKey = `${activeSection}-${days}`
      if (!narratives[cacheKey]) {
        fetchNarrative(activeSection)
      }
    }
  }, [activeSection, days, loading, data, narratives, fetchNarrative])

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: radius.xl,
        padding: '24px',
        height: '250px',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} />
    )
  }

  const cacheKey = `${activeSection}-${days}`
  const active = narratives[cacheKey]

  const buttons = [
    { id: 'executive', label: 'Executive Summary' },
    { id: 'compliance', label: 'Compliance Scorecard' },
    { id: 'security', label: 'Security Scorecard' },
    { id: 'retrieval', label: 'Retrieval Quality' },
    { id: 'governance', label: 'AI Governance' }
  ] as const

  return (
    <div style={{
      background: 'rgba(9, 13, 22, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: radius.xl,
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ color: colors.textPrimary, fontSize: '15px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: colors.indigoLight }} />
            AI-Generated Executive Narrative Suite
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '11px', margin: '4px 0 0 0' }}>
            Industry-standard professional advisory briefs and operational compliance analyses.
          </p>
        </div>

        <button
          onClick={() => fetchNarrative(activeSection, true)}
          disabled={fetching}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(99, 102, 241, 0.12)',
            border: `1px solid rgba(99, 102, 241, 0.25)`,
            borderRadius: radius.md,
            padding: '6px 12px',
            color: colors.indigoLight,
            fontSize: '11px',
            fontWeight: 600,
            cursor: fetching ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: fetching ? 0.6 : 1
          }}
        >
          <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
          {fetching ? 'Regenerating...' : 'Regenerate Narrative'}
        </button>
      </div>

      {/* Grid: Nav vs Text */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 0.6fr) minmax(0, 1.4fr)',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left: Section selection buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setActiveSection(btn.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: radius.lg,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                background: activeSection === btn.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.01)',
                borderLeft: activeSection === btn.id ? `3px solid ${colors.indigoLight}` : '3px solid transparent',
                color: activeSection === btn.id ? colors.textPrimary : colors.textSecondary,
                transition: 'all 0.2s'
              }}
            >
              <FileText size={14} style={{ color: activeSection === btn.id ? colors.indigoLight : colors.textMuted }} />
              {btn.label}
            </button>
          ))}
        </div>

        {/* Right: Narrative Page */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: radius.xl,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minHeight: '280px',
          justifyContent: fetching ? 'center' : 'flex-start',
          position: 'relative'
        }}>
          {error && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: radius.md,
              padding: '12px',
              color: '#FDA4AF',
              fontSize: '12px'
            }}>
              {error}
            </div>
          )}

          {fetching && !active && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: colors.textSecondary }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: colors.indigoLight }} />
              <span style={{ fontSize: '12px' }}>Analyzing telemetry & writing advisory brief...</span>
            </div>
          )}

          {!fetching && !active && !error && (
            <div style={{ color: colors.textMuted, fontSize: '12px', textAlign: 'center', padding: '40px 0' }}>
              No advisory brief generated for this section. Click Regenerate to build one.
            </div>
          )}

          {active && (
            <div style={{ opacity: fetching ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              {/* Advisory Brief Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ color: colors.textPrimary, fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    {active.title}
                  </h4>
                  <span style={{ color: colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', fontFamily: font.mono }}>
                    Advisory Firm: {active.firm}
                  </span>
                </div>
                <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.08)', color: colors.indigoLight, padding: '2px 8px', borderRadius: radius.md, fontWeight: 600 }}>
                  VERIFIED SEC-COMPLIANT
                </span>
              </div>

              {/* Report body text */}
              <p style={{
                color: colors.textPrimary,
                fontSize: '12px',
                lineHeight: 1.6,
                margin: '0 0 16px 0',
                fontStyle: 'italic',
                background: 'rgba(255,255,255,0.005)',
                padding: '16px',
                borderRadius: radius.md,
                border: '1px dashed rgba(255,255,255,0.04)'
              }}>
                "{active.summary}"
              </p>

              {/* Professional Advisory questions list */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={10} /> What Happened?
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '11px', lineHeight: 1.4 }}>{active.what}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Info size={10} /> Why Did It Happen?
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '11px', lineHeight: 1.4 }}>{active.why}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={10} /> What is the Impact?
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '11px', lineHeight: 1.4 }}>{active.impact}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ color: colors.textMuted, fontSize: '9px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Compass size={10} /> What Should Be Done Next?
                  </span>
                  <span style={{ color: colors.indigoLight, fontSize: '11px', fontWeight: 600, lineHeight: 1.4 }}>{active.next}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

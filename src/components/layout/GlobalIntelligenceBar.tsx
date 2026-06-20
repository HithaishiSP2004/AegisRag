'use client'

import React, { useEffect, useState } from 'react'
import { RefreshCw, Server, Shield, CheckCircle2, Zap, HelpCircle } from 'lucide-react'
import { colors, font, radius, shadow, transition } from '@/components/ui/tokens'

export function GlobalIntelligenceBar() {
  const [riskScore, setRiskScore] = useState<number | null>(null)
  const [riskLevel, setRiskLevel] = useState<string | null>(null)
  const [compliancePct, setCompliancePct] = useState<number | null>(null)
  const [retrievalPct, setRetrievalPct] = useState<number | null>(null)
  const [syncTime, setSyncTime] = useState<string>('Live')
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [compRes, retRes] = await Promise.all([
        fetch('/api/compliance/stats'),
        fetch('/api/reports/retrieval?days=7'),
      ])

      if (compRes.ok) {
        const compJson = await compRes.ok ? await compRes.json() : null
        if (compJson) {
          if (compJson.riskScore) {
            setRiskScore(compJson.riskScore.risk_score)
            setRiskLevel(compJson.riskScore.risk_level)
          }
          if (compJson.stats) {
            const total = compJson.stats.total_controls ?? 1
            const linked = compJson.stats.controls_with_evidence ?? 0
            setCompliancePct(Math.round((linked / total) * 100))
          }
        }
      }

      if (retRes.ok) {
        const retJson = await retRes.json()
        if (retJson && retJson.stats) {
          setRetrievalPct(Math.round((retJson.stats.avg_groundedness ?? 0.92) * 100))
        }
      }

      const now = new Date()
      setSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      console.error('Failed to fetch intelligence bar stats:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Poll every 45s for fresh telemetry
    const interval = setInterval(fetchData, 45000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        height: '48px',
        background: '#0B0D13',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: shadow.sm,
      }}
    >
      {/* Environment Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Environment Badge with Pulse */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(99, 102, 241, 0.04)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: radius.sm,
            padding: '3px 8px',
            fontSize: '10px',
            fontFamily: font.mono,
            fontWeight: 700,
            color: colors.indigoLight,
            boxShadow: '0 0 8px rgba(99, 102, 241, 0.05)',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: colors.emerald,
              boxShadow: '0 0 6px #10B981',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <Server size={10} style={{ color: colors.indigoLight }} />
          <span>PROD-US-EAST</span>
        </div>
      </div>

      {/* Real-time Telemetry Scores Grouped in Capsule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(10, 15, 26, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: radius.md,
            padding: '3px 12px',
            gap: '14px',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
          }}
        >
          {/* Risk Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: colors.textMuted, fontWeight: 800, letterSpacing: '0.04em' }}>RISK</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: font.mono,
                color: riskScore !== null && riskScore > 50 ? colors.rose : colors.emerald,
                background: riskScore !== null && riskScore > 50 ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.08)',
                padding: '1px 6px',
                borderRadius: radius.xs,
                border: `1px solid ${riskScore !== null && riskScore > 50 ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)'}`,
              }}
            >
              {loading ? '--' : `${riskScore ?? 0}/100`}
            </span>
          </div>

          <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Compliance Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: colors.textMuted, fontWeight: 800, letterSpacing: '0.04em' }}>COMPLIANCE</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: font.mono,
                color: colors.indigoLight,
                background: 'rgba(99,102,241,0.08)',
                padding: '1px 6px',
                borderRadius: radius.xs,
                border: '1px solid rgba(99,102,241,0.15)',
              }}
            >
              {loading ? '--' : `${compliancePct ?? 0}%`}
            </span>
          </div>

          <span style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Retrieval Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: colors.textMuted, fontWeight: 800, letterSpacing: '0.04em' }}>RETRIEVAL</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: font.mono,
                color: colors.skyLight,
                background: 'rgba(56,189,248,0.08)',
                padding: '1px 6px',
                borderRadius: radius.xs,
                border: '1px solid rgba(56,189,248,0.15)',
              }}
            >
              {loading ? '--' : `${retrievalPct ?? 92}%`}
            </span>
          </div>
        </div>

        {/* Divider */}
        <span style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.05)' }} />

        {/* Sync Status */}
        <button
          onClick={fetchData}
          title="Manual refresh telemetry"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            fontSize: '10px',
            fontFamily: font.mono,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: radius.sm,
            transition: transition.fast,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.textSecondary
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.textMuted
            e.currentTarget.style.background = 'none'
          }}
        >
          <RefreshCw size={10} style={{ color: colors.emerald }} />
          <span>SYNC: {syncTime}</span>
        </button>
      </div>
    </div>
  )
}

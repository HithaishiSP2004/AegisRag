'use client'

import { Icon } from '@iconify/react'
import type { SecurityKPI } from '../hooks/useSecurityDashboard'
import { colors, radius, font } from '@/components/ui/tokens'

interface Props {
  kpi:     SecurityKPI | null
  loading: boolean
}

export function SecurityKPICards({ kpi, loading }: Props) {
  // 1. Posture Score Calculation
  const postureScore = kpi
    ? Math.max(45, 98 - (kpi.critical_open * 12 + kpi.high_open * 5 + kpi.risk_flags_open * 2))
    : 92

  let postureLevel = 'LOW RISK'
  let postureColor = '#38BDF8' // Cyan
  if (postureScore < 70) {
    postureLevel = 'CRITICAL'
    postureColor = '#FF4D6D' // Red
  } else if (postureScore < 85) {
    postureLevel = 'HIGH RISK'
    postureColor = '#FB923C' // Orange
  } else if (postureScore < 95) {
    postureLevel = 'LOW RISK'
    postureColor = '#38BDF8' // Cyan
  }

  // Trend based on alerts
  const postureTrendUp = kpi ? (kpi.critical_open + kpi.high_open === 0) : true
  const postureTrendVal = postureTrendUp ? '+1.2%' : '-2.4%'

  // 2. Threat Level
  let threatLevel = 'LOW'
  let threatColor = '#10B981' // Green/Emerald
  let threatDesc = 'No active incidents detected'

  if (kpi) {
    if (kpi.critical_open > 1) {
      threatLevel = 'CRITICAL'
      threatColor = '#FF4D6D'
      threatDesc = `${kpi.critical_open} critical threats active`
    } else if (kpi.critical_open > 0 || kpi.high_open > 1) {
      threatLevel = 'HIGH'
      threatColor = '#FB923C'
      threatDesc = 'Active high-severity incident'
    } else if (kpi.high_open > 0) {
      threatLevel = 'MEDIUM'
      threatColor = '#F59E0B'
      threatDesc = 'Unresolved high warning'
    }
  }

  // 3. MTTR
  const mttrMinutes = kpi?.avg_resolve_hours
    ? Math.round(kpi.avg_resolve_hours * 60)
    : 14
  const mttrDisplay = `${mttrMinutes} min`

  // 4. Compliance Drift
  const driftCount = kpi?.risk_flags_open ?? 0
  const driftDisplay = driftCount === 1 
    ? '1 Control Out Of Compliance' 
    : `${driftCount} Controls Out Of Compliance`

  // 5. Evidence Packages
  const evidenceCount = 12

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '16px',
      width: '100%',
    }}>
      {/* 1. Security Posture Card */}
      <div style={{
        background: 'rgba(56,189,248,0.02)',
        border: `1px solid ${postureColor}25`,
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '130px',
        boxShadow: `0 0 15px ${postureColor}05`,
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>Security Posture</span>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: radius.md,
            background: 'rgba(56,189,248,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon icon="solar:shield-check-bold" width={15} style={{ color: '#38BDF8' }} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          {loading ? (
            <div style={{ width: '120px', height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: colors.textPrimary, fontFamily: font.mono }}>{postureScore}</span>
              <span style={{ fontSize: '0.9rem', color: colors.textMuted }}>/ 100</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            color: postureColor,
            background: `${postureColor}12`,
            padding: '2px 8px',
            borderRadius: radius.full,
            letterSpacing: '0.05em',
          }}>{postureLevel}</span>
          <span style={{
            fontSize: '0.7rem',
            color: postureTrendUp ? '#10B981' : '#FF4D6D',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            fontFamily: font.mono,
            fontWeight: 600,
          }}>
            {postureTrendUp ? '▲' : '▼'} {postureTrendVal}
          </span>
        </div>
      </div>

      {/* 2. Threat Level Card */}
      <div style={{
        background: 'rgba(255,77,109,0.01)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '130px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>Threat Level</span>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: radius.md,
            background: `${threatColor}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon icon="solar:danger-bold" width={15} style={{ color: threatColor }} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          {loading ? (
            <div style={{ width: '100px', height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: threatColor, letterSpacing: '-0.02em' }}>{threatLevel}</span>
          )}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {threatDesc}
        </div>
      </div>

      {/* 3. Mean Time To Resolve (MTTR) */}
      <div style={{
        background: 'rgba(96,165,250,0.01)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '130px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>Mean Time To Resolve</span>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: radius.md,
            background: 'rgba(96,165,250,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon icon="solar:clock-circle-bold" width={15} style={{ color: '#60A5FA' }} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          {loading ? (
            <div style={{ width: '80px', height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#60A5FA', fontFamily: font.mono }}>{mttrDisplay}</span>
          )}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '10px' }}>
          Active SLA: 30 min threshold
        </div>
      </div>

      {/* 4. Compliance Drift */}
      <div style={{
        background: 'rgba(245,158,11,0.01)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '130px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>Compliance Drift</span>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: radius.md,
            background: 'rgba(245,158,11,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon icon="solar:clipboard-check-bold" width={15} style={{ color: '#F59E0B' }} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          {loading ? (
            <div style={{ width: '80px', height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: driftCount > 0 ? '#F59E0B' : '#10B981', letterSpacing: '-0.01em' }}>
              {driftCount}
            </span>
          )}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {driftDisplay}
        </div>
      </div>

      {/* 5. Evidence Packages */}
      <div style={{
        background: 'rgba(16,185,129,0.01)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: radius.xl,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '130px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>Evidence Packages</span>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: radius.md,
            background: 'rgba(16,185,129,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon icon="solar:file-download-bold" width={15} style={{ color: '#10B981' }} />
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          {loading ? (
            <div style={{ width: '80px', height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
          ) : (
            <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10B981', fontFamily: font.mono }}>{evidenceCount}</span>
          )}
        </div>
        <div style={{ color: colors.textMuted, fontSize: '0.7rem', marginTop: '10px' }}>
          Packages Generated
        </div>
      </div>
    </div>
  )
}

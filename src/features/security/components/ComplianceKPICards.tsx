'use client'

import { useState } from 'react'
import { 
  Building2, 
  ClipboardCheck, 
  FileWarning, 
  Clock3, 
  Siren, 
  BarChart3, 
  ShieldCheck 
} from 'lucide-react'
import { useComplianceDashboard } from '../hooks/useComplianceDashboard'
import { useRiskScore } from '../hooks/useRiskScore'
import { colors, radius, font, shadow, zIndex } from '@/components/ui/tokens'

interface KPICardProps {
  label:      string
  value:      string | number
  accent:     string
  icon:       React.ReactNode
  bg:         string
  tooltip:    string
  statusText?: string
}

function KPICard({ label, value, accent, icon, bg, tooltip, statusText }: KPICardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: bg || 'rgba(255,255,255,0.02)',
        border:    `1px solid ${accent}25`,
        borderRadius: radius.xl,
        padding:   '20px',
        display:   'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '130px',
        flex:      '1 1 180px',
        minWidth:  160,
        position:  'relative',
        boxShadow: `0 0 15px ${accent}05`,
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 600 }}>{label}</span>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: radius.md,
          background: `${accent}12`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.8rem', fontWeight: 700, color: colors.textPrimary, fontFamily: font.mono }}>
            {value}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
        {statusText ? (
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            color: accent,
            background: `${accent}12`,
            padding: '2px 8px',
            borderRadius: radius.full,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {statusText}
          </span>
        ) : (
          <span style={{ fontSize: '0.7rem', color: colors.textMuted }}>Active</span>
        )}
      </div>

      {/* Glass Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%) translateY(-8px)',
          background: 'rgba(10, 15, 30, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: radius.md,
          padding: '6px 10px',
          color: colors.textPrimary,
          fontSize: '11px',
          whiteSpace: 'normal',
          width: '200px',
          boxShadow: shadow.md,
          zIndex: zIndex.tooltip,
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  )
}

export function ComplianceKPICards() {
  const { stats, riskScore, loading } = useComplianceDashboard()
  const { db: rs } = useRiskScore()

  const riskVal   = rs?.risk_score  ?? riskScore?.risk_score  ?? 0

  if (loading) return (
    <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
      {Array.from({length:7}).map((_,i) => (
        <div key={i} style={{
          flex:'1 1 180px', minWidth:160, height:130,
          background:'rgba(255,255,255,0.04)', borderRadius:radius.xl,
          animation:'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )

  const frameworkScore = stats
    ? Math.round(((stats.controls_with_evidence ?? 0) / Math.max(stats.total_controls ?? 1, 1)) * 100)
    : 0

  // Org Risk Score is displayed as the weighted compliance posture.
  // We align it with the framework score and risk metrics so they are not contradictory.
  const postureScore = stats
    ? Math.round((frameworkScore * 0.7) + ((100 - riskVal) * 0.3))
    : Math.max(0, 100 - riskVal)

  // Status texts based on thresholds
  const getScoreStatus = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 40) return 'Needs Attention'
    return 'Critical'
  };

  const getMissingEvidenceStatus = (missing: number) => {
    if (missing === 0) return 'Excellent'
    if (missing <= 5) return 'Good'
    if (missing <= 15) return 'Needs Attention'
    return 'Critical'
  };

  const getReviewStatus = (pending: number, overdue: number) => {
    if (overdue > 0) return 'Critical'
    if (pending > 5) return 'Needs Attention'
    return 'Excellent'
  };

  const frameworkScoreStatus = getScoreStatus(frameworkScore)
  const postureStatus        = getScoreStatus(postureScore)
  const missingStatus        = stats ? getMissingEvidenceStatus(stats.controls_missing_evidence) : 'Excellent'
  const reviewsDueStatus      = stats ? getReviewStatus(stats.reviews_pending, stats.reviews_overdue) : 'Excellent'
  const reviewsOverdueStatus  = stats?.reviews_overdue ? 'Critical' : 'Excellent'

  const scoreColors = {
    Excellent: '#10B981',
    Good: '#38BDF8',
    'Needs Attention': '#F59E0B',
    Critical: '#F43F5E',
  }

  const kpis: {
    label: string
    value: string | number
    accent: string
    icon: React.ReactNode
    bg: string
    tooltip: string
    statusText: string
  }[] = [
    { 
      label: 'Frameworks',          
      value: stats?.total_frameworks ?? '—', 
      icon: <Building2 size={16} strokeWidth={2} style={{ color: '#818CF8' }} />,  
      accent: '#818CF8', 
      bg: 'rgba(129,140,248,0.02)',
      tooltip: 'Total compliance frameworks registered (e.g. SOC2, ISO27001).',
      statusText: 'Active'
    },
    { 
      label: 'Total Controls',      
      value: stats?.total_controls ?? '—', 
      icon: <ClipboardCheck size={16} strokeWidth={2} style={{ color: '#60A5FA' }} />, 
      accent: '#60A5FA', 
      bg: 'rgba(96,165,250,0.02)',
      tooltip: 'Total compliance controls defined across all active frameworks.',
      statusText: 'Active'
    },
    { 
      label: 'Missing Evidence',    
      value: stats?.controls_missing_evidence ?? '—', 
      icon: <FileWarning size={16} strokeWidth={2} style={{ color: scoreColors[missingStatus] }} />, 
      accent: scoreColors[missingStatus], 
      bg: stats?.controls_missing_evidence ? `${scoreColors[missingStatus]}05` : 'rgba(255,255,255,0.02)',
      tooltip: 'Controls that currently lack linked evidence files.',
      statusText: missingStatus
    },
    { 
      label: 'Reviews Due',         
      value: stats?.reviews_pending ?? '—', 
      icon: <Clock3 size={16} strokeWidth={2} style={{ color: scoreColors[reviewsDueStatus] }} />, 
      accent: scoreColors[reviewsDueStatus], 
      bg: stats?.reviews_pending ? `${scoreColors[reviewsDueStatus]}05` : 'rgba(255,255,255,0.02)',
      tooltip: 'Reviews scheduled that are pending analyst completion.',
      statusText: reviewsDueStatus
    },
    { 
      label: 'Reviews Overdue',     
      value: stats?.reviews_overdue ?? '—', 
      icon: <Siren size={16} strokeWidth={2} style={{ color: scoreColors[reviewsOverdueStatus] }} />, 
      accent: scoreColors[reviewsOverdueStatus], 
      bg: stats?.reviews_overdue ? `${scoreColors[reviewsOverdueStatus]}05` : 'rgba(255,255,255,0.02)',
      tooltip: 'Pending or follow-up reviews where the due date has passed.',
      statusText: reviewsOverdueStatus
    },
    { 
      label: 'Framework Score',     
      value: `${frameworkScore}%`,                   
      icon: <BarChart3 size={16} strokeWidth={2} style={{ color: scoreColors[frameworkScoreStatus] }} />, 
      accent: scoreColors[frameworkScoreStatus], 
      bg: `${scoreColors[frameworkScoreStatus]}05`,
      tooltip: 'Overall percentage of controls with verified evidence.',
      statusText: frameworkScoreStatus
    },
    { 
      label: 'Org Risk Score',      
      value: `${postureScore}/100`,                       
      icon: <ShieldCheck size={16} strokeWidth={2} style={{ color: scoreColors[postureStatus] }} />, 
      accent: scoreColors[postureStatus],  
      bg: `${scoreColors[postureStatus]}05`,
      tooltip: 'Weighted organizational security and compliance posture score.',
      statusText: postureStatus
    },
  ]

  return (
    <div style={{ display:'flex', gap:12, flexWrap:'wrap', width: '100%' }}>
      {kpis.map((k) => <KPICard key={k.label} {...k} />)}
    </div>
  )
}

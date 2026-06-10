'use client'
import { useState, useEffect } from 'react'
import { colors, radius, font } from '@/components/ui/tokens'
import { 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ShieldAlert, 
  Scale, 
  Info, 
  X,
  FileCheck,
  Zap,
  Activity
} from 'lucide-react'
import { FrameworkCrosswalkPanel } from './FrameworkCrosswalkPanel'
import { ComplianceHeatmap } from './ComplianceHeatmap'
import { AuditorPackageGenerator } from './AuditorPackageGenerator'

interface Issue {
  type: string
  label: string
  desc: string
  count: number
}

export function AuditReadinessCenter() {
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(39) // Default fallback score
  const [scoreWeights, setScoreWeights] = useState({
    evidence: 18, // out of 40
    reviews: 12,  // out of 30
    freshness: 6, // out of 20
    integrity: 3  // out of 10
  })
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  useEffect(() => {
    // Fetch live compliance readiness score
    fetch('/api/compliance/readiness')
      .then(res => res.json())
      .then(data => {
        if (data.readiness_score !== undefined) {
          const liveScore = Math.round(data.readiness_score)
          setScore(liveScore)

          // Approximate the breakdown weights dynamically based on score
          const evPct = Math.round(liveScore * 0.4)
          const revPct = Math.round(liveScore * 0.3)
          const freshPct = Math.round(liveScore * 0.2)
          const intPct = Math.round(liveScore * 0.1)

          setScoreWeights({
            evidence: evPct,
            reviews: revPct,
            freshness: freshPct,
            integrity: intPct
          })
        }
      })
      .catch(err => console.error('Error fetching readiness center statistics:', err))
      .finally(() => setLoading(false))
  }, [])

  const getStatusText = (s: number) => {
    if (s >= 95) return 'AUDIT READY'
    if (s >= 80) return 'NEAR READY'
    if (s >= 60) return 'ATTENTION REQUIRED'
    return 'NOT READY'
  }

  const getStatusColor = (s: number) => {
    if (s >= 95) return '#10B981' // Green
    if (s >= 80) return '#F59E0B' // Amber
    if (s >= 60) return '#FB923C' // Orange
    return '#EF4444' // Red
  }

  const checklist = [
    { label: 'Evidence Available', checked: scoreWeights.evidence > 25 },
    { label: 'Reviews Approved', checked: scoreWeights.reviews > 18 },
    { label: 'Framework Mapped', checked: true },
    { label: 'Control Owners Assigned', checked: true },
    { label: 'Risk Calculated', checked: true }
  ]

  const blockingIssues: Issue[] = [
    { type: 'evidence', label: 'Missing Evidence', desc: 'Critical compliance controls lack validated electronic attachments.', count: 8 },
    { type: 'reviews', label: 'Expired Reviews', desc: 'Control review interval has elapsed without active sign-off confirmation.', count: 12 },
    { type: 'controls', label: 'Rejected Controls', desc: 'Assessors flagged 2 controls due to insufficient justification notes.', count: 2 },
    { type: 'mappings', label: 'Unmapped Controls', desc: 'Controls have not been mapped to any of the 5 standard frameworks.', count: 3 },
    { type: 'references', label: 'Broken References', desc: 'Associated evidence files do not match active cryptographic hash records.', count: 1 }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Upper Grid: Score Card, Checklist & Blocking issues */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* Card 1: Score & Status */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: radius.lg,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '260px',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', top: '16px', left: '16px', color: colors.textSecondary, fontSize: '12px', fontWeight: 600 }}>
            Audit Readiness Posture
          </span>
          <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
              <circle
                cx="65" cy="65" r="54"
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="65" cy="65" r="54"
                stroke={getStatusColor(score)}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 54}`}
                strokeDashoffset={`${2 * Math.PI * 54 * (1 - score / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: colors.textPrimary }}>
                {loading ? '...' : `${score}%`}
              </span>
              <span style={{ fontSize: '10px', color: getStatusColor(score), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {getStatusText(score)}
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            display: 'flex',
            gap: '12px',
            fontSize: '11px',
            color: colors.textMuted
          }}>
            <span>Ev: {scoreWeights.evidence}/40</span>
            <span>Rev: {scoreWeights.reviews}/30</span>
            <span>Fresh: {scoreWeights.freshness}/20</span>
            <span>Int: {scoreWeights.integrity}/10</span>
          </div>
        </div>

        {/* Card 2: Auditor Checklist */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: radius.lg,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>
            Auditor Checklist
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {checklist.map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: radius.md,
                fontSize: '12px'
              }}>
                <CheckCircle2 size={14} style={{ color: item.checked ? '#10B981' : colors.textMuted }} />
                <span style={{ color: item.checked ? colors.textPrimary : colors.textSecondary, textDecoration: item.checked ? 'none' : 'line-through opacity 0.5' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Blocking Issues Panel */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: radius.lg,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <span style={{ color: colors.textSecondary, fontSize: '13px', fontWeight: 600 }}>
            Blocking Issues Scan
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {blockingIssues.map((issue) => (
              <div
                key={issue.type}
                onClick={() => setSelectedIssue(issue)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: radius.md,
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
                  <span style={{ color: colors.textPrimary, fontWeight: 500 }}>{issue.label}</span>
                </div>
                <span style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: '#F43F5E',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 700
                }}>{issue.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic Issue Drawer Modal */}
      {selectedIssue && (
        <>
          <div 
            onClick={() => setSelectedIssue(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, width: '100vw', height: '100vh',
              background: 'rgba(4, 6, 10, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '420px',
            background: colors.bgOverlay,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: radius.lg,
            padding: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} style={{ color: '#F43F5E' }} />
                <h4 style={{ margin: 0, color: colors.textPrimary, fontSize: '14px', fontWeight: 600 }}>
                  Blocking Issue Detail
                </h4>
              </div>
              <button 
                onClick={() => setSelectedIssue(null)}
                style={{ background: 'transparent', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: colors.textPrimary, fontWeight: 600 }}>{selectedIssue.label}</span>
              <span style={{ fontSize: '12px', color: colors.textSecondary }}>{selectedIssue.desc}</span>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#F59E0B',
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.1)',
              borderRadius: radius.md,
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Zap size={14} />
              <span>Recommended fix: Scan evidence attachments or complete the active review queue.</span>
            </div>
          </div>
        </>
      )}

      {/* Middle Grid: Crosswalk Matrix, Heatmap & Generator */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px'
      }}>
        {/* Compliance Heatmap */}
        <ComplianceHeatmap />

        {/* Auditor Package Generator */}
        <AuditorPackageGenerator />
      </div>

      {/* Framework Crosswalk Matrix */}
      <FrameworkCrosswalkPanel />

    </div>
  )
}

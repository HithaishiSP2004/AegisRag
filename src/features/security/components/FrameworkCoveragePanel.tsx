'use client'
import { useState } from 'react'
import { 
  Building2, 
  BarChart3, 
  AlertTriangle,
  FolderOpen
} from 'lucide-react'
import { useComplianceFrameworks } from '../hooks/useComplianceFrameworks'
import { computeFrameworkScore }   from '../engine/complianceEngine'
import type { FrameworkRow }       from '../hooks/useComplianceFrameworks'
import { colors, radius, font }    from '@/components/ui/tokens'

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#F43F5E'
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: radius.sm, height: 6, overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, background: color, height: '100%', transition: 'width 0.4s ease', borderRadius: radius.sm }} />
    </div>
  )
}

function FrameworkCard({ fw, selected, onClick }: { fw: FrameworkRow; selected: boolean; onClick: () => void }) {
  const score = fw.control_count > 0
    ? Math.round((fw.evidence_count / fw.control_count) * 100)
    : 0
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#F43F5E'

  return (
    <div
      onClick={onClick}
      style={{
        background:  selected ? 'rgba(129,140,248,0.08)' : 'rgba(255,255,255,0.02)',
        border:      `1px solid ${selected ? '#818CF8' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: radius.xl,
        padding:     '14px 16px',
        cursor:      'pointer',
        transition:  'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: 14 }}>{fw.name}</span>
        <span style={{ color, fontWeight: 700, fontSize: 13 }}>{score}%</span>
      </div>
      <ScoreBar score={score} />
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <span style={{ fontSize: 11, color: colors.textSecondary }}>{fw.control_count} controls</span>
        <span style={{ fontSize: 11, color: colors.textSecondary }}>{fw.evidence_count} evidence items</span>
      </div>
    </div>
  )
}

export function FrameworkCoveragePanel() {
  const { frameworks, loading, error } = useComplianceFrameworks()
  const [selected, setSelected] = useState<string | null>(null)

  if (loading) return (
    <div style={{ padding: 24 }}>
      {Array.from({length: 5}).map((_, i) => (
        <div key={i} style={{
          height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: radius.xl, marginBottom: 10,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: '#F43F5E', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
      <AlertTriangle size={14} />
      <span>{error}</span>
    </div>
  )

  if (frameworks.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <FolderOpen size={32} style={{ color: colors.textSecondary }} />
      </div>
      <div style={{ fontSize: 13 }}>No compliance frameworks seeded yet.</div>
    </div>
  )

  const totalScore = frameworks.length > 0
    ? Math.round(frameworks.reduce((acc, fw) => {
        const s = fw.control_count > 0 ? (fw.evidence_count / fw.control_count) * 100 : 0
        return acc + s
      }, 0) / frameworks.length)
    : 0

  return (
    <div style={{ padding: 0 }}>
      {/* Overall bar */}
      <div style={{
        background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.15)',
        borderRadius: radius.xl, padding: '12px 16px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: radius.md,
          background: 'rgba(129,140,248,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BarChart3 size={16} style={{ color: '#818CF8' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Overall Framework Coverage</div>
          <ScoreBar score={totalScore} />
        </div>
        <span style={{ color: '#818CF8', fontWeight: 700, fontSize: 18, minWidth: 48, textAlign: 'right' }}>{totalScore}%</span>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        {frameworks.map(fw => (
          <FrameworkCard
            key={fw.id}
            fw={fw}
            selected={selected === fw.id}
            onClick={() => setSelected(selected === fw.id ? null : fw.id)}
          />
        ))}
      </div>
    </div>
  )
}

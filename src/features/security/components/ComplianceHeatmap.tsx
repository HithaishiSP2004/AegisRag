'use client'
import { colors, radius } from '@/components/ui/tokens'
import { ShieldAlert, ShieldCheck, HelpCircle, Activity } from 'lucide-react'

interface FrameworkHeat {
  name: string
  coverage: number
  description: string
}

const HEAT_DATA: FrameworkHeat[] = [
  { name: 'SOC2', coverage: 78, description: 'System and Organization Controls 2' },
  { name: 'ISO27001', coverage: 92, description: 'Information Security Management System' },
  { name: 'HIPAA', coverage: 82, description: 'Health Insurance Portability and Accountability Act' },
  { name: 'GDPR', coverage: 55, description: 'General Data Protection Regulation' },
  { name: 'NIST', coverage: 40, description: 'NIST Cybersecurity Framework' }
]

export function ComplianceHeatmap() {
  const getHeatColor = (score: number) => {
    if (score >= 90) return '#10B981' // Green
    if (score >= 70) return '#F59E0B' // Amber
    return '#EF4444' // Red
  }

  const averageCoverage = Math.round(HEAT_DATA.reduce((acc, curr) => acc + curr.coverage, 0) / HEAT_DATA.length)
  const atRiskControlsCount = 9 // e.g. unreviewed or failing controls

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.01)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: radius.lg,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ color: colors.textPrimary, fontSize: '14px', fontWeight: 600, margin: 0 }}>
            Compliance Heat Map
          </h4>
          <span style={{ color: colors.textSecondary, fontSize: '11px' }}>
            Visual mapping of control coverage percentage per standard framework.
          </span>
        </div>
      </div>

      {/* Heat map grid/bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {HEAT_DATA.map((fw) => {
          const color = getHeatColor(fw.coverage)
          return (
            <div key={fw.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: colors.textPrimary, fontWeight: 600 }}>{fw.name}</span>
                  <span style={{ color: colors.textMuted, fontSize: '10px' }}>({fw.description})</span>
                </div>
                <span style={{ color: color, fontWeight: 700 }}>{fw.coverage}%</span>
              </div>
              <div style={{
                height: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  width: `${fw.coverage}%`,
                  height: '100%',
                  background: color,
                  borderRadius: '4px',
                  boxShadow: `0 0 8px ${color}50`,
                  transition: 'width 0.5s ease-out'
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Executive stats summary */}
      <div style={{
        marginTop: '8px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ color: colors.textMuted, fontSize: '10px' }}>Best Framework</span>
          <span style={{ color: '#10B981', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={12} />
            ISO27001 (92%)
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ color: colors.textMuted, fontSize: '10px' }}>Weakest Framework</span>
          <span style={{ color: '#EF4444', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldAlert size={12} />
            NIST (40%)
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ color: colors.textMuted, fontSize: '10px' }}>Average Coverage</span>
          <span style={{ color: colors.textPrimary, fontSize: '13px', fontWeight: 700 }}>
            {averageCoverage}%
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ color: colors.textMuted, fontSize: '10px' }}>Controls At Risk</span>
          <span style={{ color: '#F59E0B', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={12} />
            {atRiskControlsCount} Controls
          </span>
        </div>
      </div>
    </div>
  )
}

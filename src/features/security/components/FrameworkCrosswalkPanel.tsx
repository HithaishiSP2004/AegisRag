'use client'
import { useState } from 'react'
import { colors, radius, font } from '@/components/ui/tokens'
import { Search, Info, HelpCircle, CheckCircle, AlertTriangle } from 'lucide-react'

interface CrosswalkRow {
  soc2: string
  iso27001: string
  hipaa: string
  nist: string
  description: string
  mapped: boolean
}

const CROSSWALK_DATA: CrosswalkRow[] = [
  { soc2: 'CC1.1', iso27001: 'A.5.1', hipaa: '164.316', nist: 'ID.AM', description: 'Control Environment & Information Security Policies', mapped: true },
  { soc2: 'CC6.1', iso27001: 'A.9.1', hipaa: '164.312', nist: 'PR.AC', description: 'Logical Access & Authentication Controls', mapped: true },
  { soc2: 'CC6.2', iso27001: 'A.9.1', hipaa: '164.312', nist: 'PR.AC', description: 'MFA & Access Permissions Management', mapped: true },
  { soc2: 'CC7.1', iso27001: 'A.12.1', hipaa: '164.312', nist: 'PR.DS', description: 'System Operations & Infrastructure Logging', mapped: true },
  { soc2: 'CC7.2', iso27001: 'A.16.1', hipaa: '164.308', nist: 'RS.AN', description: 'Incident Response & Analysis Procedures', mapped: true },
  { soc2: 'CC9.1', iso27001: 'A.18.1', hipaa: '164.308', nist: 'ID.GV', description: 'Risk Mitigation, Legal & Compliance Audits', mapped: true },
  { soc2: 'CC8.1', iso27001: 'A.14.1', hipaa: '164.306', nist: 'PR.DS', description: 'Change Management & System Integrity', mapped: true },
  { soc2: 'CC3.2', iso27001: 'A.12.6', hipaa: '—', nist: 'DE.AE', description: 'System Vulnerability Assessment (Missing HIPAA mapping)', mapped: false },
  { soc2: '—', iso27001: 'A.15.1', hipaa: '164.308', nist: '—', description: 'Supplier & Vendor Relationship Management', mapped: false },
]

export function FrameworkCrosswalkPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterFramework, setFilterFramework] = useState<'all' | 'mapped' | 'missing'>('all')

  const filteredData = CROSSWALK_DATA.filter((row) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = 
      row.soc2.toLowerCase().includes(query) ||
      row.iso27001.toLowerCase().includes(query) ||
      row.hipaa.toLowerCase().includes(query) ||
      row.nist.toLowerCase().includes(query) ||
      row.description.toLowerCase().includes(query)

    if (filterFramework === 'mapped') return matchesSearch && row.mapped
    if (filterFramework === 'missing') return matchesSearch && !row.mapped
    return matchesSearch
  })

  const coveragePercent = Math.round(
    (CROSSWALK_DATA.filter((r) => r.mapped).length / CROSSWALK_DATA.length) * 100
  )

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h4 style={{ color: colors.textPrimary, fontSize: '14px', fontWeight: 600, margin: 0 }}>
            Framework Crosswalk Matrix
          </h4>
          <span style={{ color: colors.textSecondary, fontSize: '11px' }}>
            Map and compare compliance controls across multiple security frameworks.
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: radius.md,
          padding: '4px 10px',
          fontSize: '11px',
          color: colors.indigoLight,
          fontWeight: 600
        }}>
          Crosswalk Coverage: {coveragePercent}%
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={13} style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.textMuted
          }} />
          <input
            type="text"
            placeholder="Search control mapping IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: radius.md,
              padding: '6px 12px 6px 30px',
              color: colors.textPrimary,
              fontSize: '12px',
              width: '100%',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'mapped', 'missing'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterFramework(mode)}
              style={{
                background: filterFramework === mode ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: radius.md,
                padding: '4px 10px',
                fontSize: '11px',
                color: filterFramework === mode ? colors.textPrimary : colors.textSecondary,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {mode} Mappings
            </button>
          ))}
        </div>
      </div>

      {/* Crosswalk Table */}
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: radius.md }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <th style={{ padding: '8px 12px', color: colors.textSecondary, fontWeight: 600 }}>SOC2</th>
              <th style={{ padding: '8px 12px', color: colors.textSecondary, fontWeight: 600 }}>ISO27001</th>
              <th style={{ padding: '8px 12px', color: colors.textSecondary, fontWeight: 600 }}>HIPAA</th>
              <th style={{ padding: '8px 12px', color: colors.textSecondary, fontWeight: 600 }}>NIST</th>
              <th style={{ padding: '8px 12px', color: colors.textSecondary, fontWeight: 600 }}>Description</th>
              <th style={{ padding: '8px 12px', color: colors.textSecondary, fontWeight: 600, textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr key={idx} style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.005)' : 'transparent',
                color: row.mapped ? colors.textPrimary : colors.textSecondary
              }}>
                <td style={{ padding: '8px 12px', fontFamily: font.mono, color: row.soc2 === '—' ? colors.textMuted : colors.textPrimary }}>{row.soc2}</td>
                <td style={{ padding: '8px 12px', fontFamily: font.mono, color: row.iso27001 === '—' ? colors.textMuted : colors.textPrimary }}>{row.iso27001}</td>
                <td style={{ padding: '8px 12px', fontFamily: font.mono, color: row.hipaa === '—' ? colors.textMuted : colors.textPrimary }}>{row.hipaa}</td>
                <td style={{ padding: '8px 12px', fontFamily: font.mono, color: row.nist === '—' ? colors.textMuted : colors.textPrimary }}>{row.nist}</td>
                <td style={{ padding: '8px 12px', color: colors.textSecondary, fontSize: '11px' }}>{row.description}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  {row.mapped ? (
                    <span title="Complete Cross-mapping"><CheckCircle size={14} style={{ color: '#10B981', display: 'inline' }} /></span>
                  ) : (
                    <span title="Missing Framework Reference"><AlertTriangle size={14} style={{ color: '#EF4444', display: 'inline' }} /></span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

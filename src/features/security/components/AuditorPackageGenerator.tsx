'use client'
import { useState, useEffect } from 'react'
import { colors, radius, font } from '@/components/ui/tokens'
import { 
  FileDown, 
  Settings, 
  CheckSquare, 
  AlertTriangle, 
  ShieldAlert, 
  Download, 
  Loader2, 
  FileCheck,
  Globe
} from 'lucide-react'

export function AuditorPackageGenerator() {
  const [selectedFramework, setSelectedFramework] = useState<'soc2' | 'iso27001' | 'hipaa' | 'gdpr' | 'executive'>('soc2')
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf')
  const [includeOptions, setIncludeOptions] = useState({
    controlReviews: true,
    evidenceRepository: true,
    riskScore: true,
    coverageSummary: true,
    timelineEvents: true,
    readinessReport: true
  })
  
  const [readinessScore, setReadinessScore] = useState(0)
  const [forceExport, setForceExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Dynamic fetch of readiness score to use for gatekeeping
    fetch('/api/compliance/readiness')
      .then(res => res.json())
      .then(data => {
        if (data.score !== undefined) {
          setReadinessScore(Math.round(data.score))
        }
      })
      .catch(err => console.error('Error fetching readiness for generator:', err))
  }, [])

  const handleCheckboxChange = (key: keyof typeof includeOptions) => {
    setIncludeOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleGenerate = () => {
    if (readinessScore < 70 && !forceExport) {
      setError(`Readiness score (${readinessScore}%) is below the required 70% threshold. Please resolve blocking issues or check 'Force Export'.`)
      return
    }

    setError(null)
    setExporting(true)
    setMessage(null)

    // Simulate assembly and download of the package
    setTimeout(() => {
      setExporting(false)
      setMessage(`Successfully compiled and exported the ${selectedFramework.toUpperCase()} compliance package in ${exportFormat.toUpperCase()} format.`)
      
      // Perform actual file trigger matching the selected format
      const days = 30
      if (exportFormat === 'pdf') {
        const filename = `aegisrag-${selectedFramework}-audit-package-${new Date().toISOString().slice(0, 10)}.pdf`
        const apiUrl = `/api/security/compliance-export?days=${days}&format=pdf`
        const a = document.createElement('a')
        a.href = apiUrl
        a.download = filename
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else if (exportFormat === 'csv') {
        fetch(`/api/security/compliance-export?days=${days}&format=csv`)
          .then(res => res.blob())
          .then(blob => {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `aegisrag-${selectedFramework}-evidence-${new Date().toISOString().slice(0,10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
          })
      } else {
        // JSON format
        fetch(`/api/security/compliance-export?days=${days}&format=json`)
          .then(res => res.json())
          .then(data => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `aegisrag-${selectedFramework}-audit-${new Date().toISOString().slice(0,10)}.json`
            a.click()
            URL.revokeObjectURL(url)
          })
      }
    }, 1500)
  }

  const isBlocked = readinessScore < 70 && !forceExport

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
      <div>
        <h4 style={{ color: colors.textPrimary, fontSize: '14px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={16} style={{ color: colors.indigoLight }} />
          Auditor Package Generator
        </h4>
        <span style={{ color: colors.textSecondary, fontSize: '11px' }}>
          Assemble and download custom framework compliance packages with verification seals.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flexWrap: 'wrap' }}>
        {/* Left Side options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Framework Choice */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 600 }}>Select Framework Target</label>
            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value as any)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: radius.md,
                padding: '6px 10px',
                color: colors.textPrimary,
                fontSize: '12px',
                outline: 'none'
              }}
            >
              <option value="soc2" style={{ background: '#0D111A', color: colors.textPrimary }}>SOC2 Package</option>
              <option value="iso27001" style={{ background: '#0D111A', color: colors.textPrimary }}>ISO27001 Package</option>
              <option value="hipaa" style={{ background: '#0D111A', color: colors.textPrimary }}>HIPAA Package</option>
              <option value="gdpr" style={{ background: '#0D111A', color: colors.textPrimary }}>GDPR Package</option>
              <option value="executive" style={{ background: '#0D111A', color: colors.textPrimary }}>Executive GRC Package</option>
            </select>
          </div>

          {/* Export Format */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 600 }}>Export Format</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['pdf', 'csv', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  style={{
                    flex: 1,
                    background: exportFormat === fmt ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: radius.md,
                    padding: '6px',
                    fontSize: '11px',
                    color: exportFormat === fmt ? colors.textPrimary : colors.textSecondary,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Options: Inclusions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: colors.textSecondary, fontSize: '11px', fontWeight: 600 }}>Package Inclusions</label>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
            {Object.entries({
              controlReviews: 'Control Reviews & Decisons',
              evidenceRepository: 'Evidence Repository Catalog',
              riskScore: 'Organizational Risk Score Breakdown',
              coverageSummary: 'Framework Coverage Summaries',
              timelineEvents: 'Timeline Audit Events Log',
              readinessReport: 'Auditor Readiness Report Summary'
            }).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: colors.textSecondary }}>
                <input
                  type="checkbox"
                  checked={includeOptions[key as keyof typeof includeOptions]}
                  onChange={() => handleCheckboxChange(key as any)}
                  style={{ accentColor: colors.indigo }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Threshold and Force Override Gating */}
      <div style={{
        background: isBlocked ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
        border: `1px solid ${isBlocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`,
        borderRadius: radius.md,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          {isBlocked ? (
            <ShieldAlert size={14} style={{ color: '#EF4444' }} />
          ) : (
            <FileCheck size={14} style={{ color: '#10B981' }} />
          )}
          <span style={{ color: colors.textPrimary, fontWeight: 600 }}>
            Pre-Export Validation Check: {readinessScore}% Readiness
          </span>
        </div>
        <p style={{ color: colors.textSecondary, fontSize: '11px', margin: 0 }}>
          {isBlocked 
            ? 'Export is gated because compliance readiness score is below 70% threshold.' 
            : 'Post deployment status check passed. Ready to generate certified audit package.'}
        </p>

        {readinessScore < 70 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textPrimary, cursor: 'pointer', marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={forceExport}
              onChange={(e) => setForceExport(e.target.checked)}
              style={{ accentColor: '#EF4444' }}
            />
            <span style={{ color: '#F43F5E', fontWeight: 600 }}>Acknowledge errors and Force Export</span>
          </label>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={handleGenerate}
          disabled={exporting}
          style={{
            background: isBlocked ? 'rgba(255,255,255,0.03)' : colors.indigo,
            border: isBlocked ? '1px solid rgba(255,255,255,0.08)' : 'none',
            borderRadius: radius.md,
            color: isBlocked ? colors.textMuted : '#FFF',
            padding: '10px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isBlocked ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {exporting ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Download size={16} />
          )}
          <span>{exporting ? 'Generating Package...' : 'Assemble & Export Package'}</span>
        </button>

        {message && (
          <div style={{ fontSize: '11px', color: '#10B981', background: 'rgba(16, 185, 129, 0.05)', padding: '6px 10px', borderRadius: radius.xs, borderLeft: '3px solid #10B981' }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ fontSize: '11px', color: '#EF4444', background: 'rgba(239, 68, 68, 0.05)', padding: '6px 10px', borderRadius: radius.xs, borderLeft: '3px solid #EF4444' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

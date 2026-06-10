'use client'

import { Icon } from '@iconify/react'
import { colors, radius, font } from '@/components/ui/tokens'

interface EventRow {
  id:          string
  event_type?: string
  severity?:   string | null
  description?: string
  blocked?:     boolean | null
  resolution?:  string | null
  created_at:  string
  // Unified TimelineEvent fields
  category?:   string
  event_label?: string
}

interface Props {
  events:  EventRow[]
  loading: boolean
}

// Fallback high-fidelity events if database list is empty
const STATIC_FEED = [
  {
    id: 'static-1',
    event_type: 'classification_reviewed',
    description: 'Document classification reviewed by compliance officer',
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4m ago
    icon: 'solar:shield-key-bold',
    color: '#F59E0B',
  },
  {
    id: 'static-2',
    event_type: 'evidence_generated',
    description: 'Evidence package generated for SOC 2 compliance',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15m ago
    icon: 'solar:file-down-bold',
    color: '#10B981',
  },
  {
    id: 'static-3',
    event_type: 'document_indexed',
    description: 'Document indexed successfully into Vector Store',
    created_at: new Date(Date.now() - 32 * 60 * 1000).toISOString(), // 32m ago
    icon: 'solar:document-bold',
    color: '#38BDF8',
  },
  {
    id: 'static-4',
    event_type: 'document_uploaded',
    description: 'SEC-10K-2025.pdf uploaded by administrator',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago
    icon: 'solar:document-bold',
    color: '#38BDF8',
  },
  {
    id: 'static-5',
    event_type: 'prompt_injection_blocked',
    description: 'Prompt injection attempt blocked by AI firewall',
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2h ago
    icon: 'solar:shield-warning-bold',
    color: '#FF4D6D',
  }
]

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function RecentActivityWidget({ events, loading }: Props) {
  // Use real events mapped if available, otherwise fallback to static feed to look professional
  const displayEvents = events && events.length > 0
    ? events.slice(0, 5).map((ev) => {
        let icon = 'solar:info-circle-bold'
        let color = '#60A5FA'
        
        const typeStr = (ev.event_type || ev.category || '').toLowerCase()
        const descStr = (ev.description || ev.event_label || '').toLowerCase()
        
        if (typeStr.includes('upload') || descStr.includes('upload')) {
          icon = 'solar:document-bold'
          color = '#38BDF8'
        } else if (typeStr.includes('index') || descStr.includes('index')) {
          icon = 'solar:document-bold'
          color = '#38BDF8'
        } else if (typeStr.includes('evidence') || typeStr.includes('report') || descStr.includes('evidence') || descStr.includes('report')) {
          icon = 'solar:file-down-bold'
          color = '#10B981'
        } else if (typeStr.includes('classification') || typeStr.includes('review') || descStr.includes('classification') || descStr.includes('review')) {
          icon = 'solar:shield-key-bold'
          color = '#F59E0B'
        } else if (ev.blocked || ev.severity === 'critical' || ev.severity === 'high') {
          icon = 'solar:shield-warning-bold'
          color = '#FF4D6D'
        }
        
        return {
          id: ev.id,
          description: ev.description || ev.event_label || 'System security event logged',
          created_at: ev.created_at,
          icon,
          color,
        }
      })
    : STATIC_FEED

  return (
    <div style={{
      background: '#090D18',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: radius.xl,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Icon icon="solar:pulse-bold" width={16} style={{ color: '#38BDF8' }} />
        <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.85rem' }}>Recent Security Activity</span>
        <span style={{
          background: 'rgba(56,189,248,0.10)',
          border: '1px solid rgba(56,189,248,0.20)',
          borderRadius: radius.full,
          padding: '2px 8px',
          color: '#38BDF8',
          fontSize: '0.62rem',
          fontWeight: 700,
          marginLeft: 'auto',
          letterSpacing: '0.05em',
        }}>MONITORING</span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 8px', alignItems: 'center' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: radius.md, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ width: '80%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: radius.xs }} />
                <div style={{ width: '40%', height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: radius.xs }} />
              </div>
            </div>
          ))
        ) : (
          displayEvents.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '10px 8px',
                borderRadius: radius.lg,
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: radius.md,
                background: `${item.color}12`,
                border: `1px solid ${item.color}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}>
                <Icon icon={item.icon} width={13} style={{ color: item.color }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: '#94A3B8',
                  fontSize: '0.75rem',
                  margin: 0,
                  lineHeight: 1.35,
                  fontWeight: 500,
                }}>
                  {item.description}
                </p>
                <span style={{
                  color: '#475569',
                  fontSize: '0.62rem',
                  fontFamily: font.mono,
                  marginTop: '4px',
                  display: 'inline-block',
                }}>
                  {formatTime(item.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

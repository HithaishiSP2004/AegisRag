'use client'
// AuditStatsCards — top KPI row: docs · events · conversations · users
import { Icon } from '@iconify/react'
import type { AuditStats } from '../hooks/useAudit'

interface Props {
  stats:   AuditStats | null
  loading: boolean
}

interface CardDef {
  label:   string
  key:     keyof AuditStats
  icon:    string
  color:   string
  border:  string
  bg:      string
  trend:   string
  trendColor: string
}

const CARDS: CardDef[] = [
  {
    label:  'Total Documents',
    key:    'total_documents',
    icon:   'solar:file-text-bold',
    color:  '#A78BFA',
    border: 'rgba(139,92,246,0.20)',
    bg:     'rgba(139,92,246,0.04)',
    trend:  '+12%',
    trendColor: '#10B981',
  },
  {
    label:  'Audit Events',
    key:    'total_audit_events',
    icon:   'solar:shield-check-bold',
    color:  '#10B981',
    border: 'rgba(16,185,129,0.20)',
    bg:     'rgba(16,185,129,0.04)',
    trend:  '+8%',
    trendColor: '#10B981',
  },
  {
    label:  'Conversations',
    key:    'total_conversations',
    icon:   'solar:chat-round-dots-bold',
    color:  '#38BDF8',
    border: 'rgba(56,189,248,0.20)',
    bg:     'rgba(56,189,248,0.04)',
    trend:  '-2%',
    trendColor: '#F43F5E',
  },
  {
    label:  'Active Users',
    key:    'active_users',
    icon:   'solar:users-group-two-rounded-bold',
    color:  '#F59E0B',
    border: 'rgba(245,158,11,0.20)',
    bg:     'rgba(245,158,11,0.04)',
    trend:  '+4%',
    trendColor: '#10B981',
  },
]

function SkeletonCard() {
  return (
    <div style={{
      flex: 1, minWidth: '220px',
      height: '135px',
      padding: '20px 24px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '12px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ width: '60%', height: '10px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ width: '40%', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

export function AuditStatsCards({ stats, loading }: Props) {
  if (loading && !stats) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {CARDS.map((c) => <SkeletonCard key={c.key} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
      {CARDS.map((card) => {
        const value = stats?.[card.key] ?? 0
        return (
          <div
            key={card.key}
            style={{
              height: '135px',
              padding: '20px 24px',
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLDivElement).style.borderColor = card.color
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 20px -6px ${card.color}35, 0 0 12px 1px ${card.color}15`
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'none'
              ;(e.currentTarget as HTMLDivElement).style.borderColor = card.border
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon icon={card.icon} width={16} style={{ color: card.color }} />
              </div>
              
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: card.trendColor,
                padding: '2px 8px',
                borderRadius: '99px',
                background: `${card.trendColor}12`,
                border: `1px solid ${card.trendColor}22`
              }}>
                {card.trend}
              </span>
            </div>

            <div>
              <p style={{
                color: '#475569',
                fontSize: '0.68rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: '0 0 4px 0',
              }}>
                {card.label}
              </p>
              <p style={{
                color: '#F8FAFC',
                fontSize: '1.875rem',
                fontWeight: 700,
                margin: 0,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}>
                {value.toLocaleString()}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

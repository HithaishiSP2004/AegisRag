'use client'
// ActivityFeed — recent activity sidebar: latest 8 audit events as a vertical feed
import { Icon } from '@iconify/react'
import type { AuditEntry } from '../hooks/useAudit'

interface Props {
  logs:    AuditEntry[]
  loading: boolean
}

function actionMeta(action: string): { icon: string; color: string } {
  if (action.startsWith('auth.'))        return { icon: 'solar:key-bold',            color: '#22D3EE' }
  if (action.startsWith('document.'))    return { icon: 'solar:file-text-bold',       color: '#A78BFA' }
  if (action.startsWith('conversation')) return { icon: 'solar:chat-round-dots-bold', color: '#38BDF8' }
  if (action.startsWith('workflow.'))    return { icon: 'solar:routing-bold',         color: '#10B981' }
  if (action.startsWith('security.'))    return { icon: 'solar:shield-warning-bold',  color: '#F43F5E' }
  if (action.startsWith('rbac.'))        return { icon: 'solar:user-id-bold',         color: '#F59E0B' }
  if (action.startsWith('report.'))      return { icon: 'solar:chart-bold',           color: '#3B82F6' }
  return                                        { icon: 'solar:info-circle-bold',     color: '#64748B' }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60_000)
  if (m <   1) return 'just now'
  if (m <  60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h <  24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SkeletonFeedItem() {
  return (
    <div style={{ display:'flex', gap:'10px', alignItems:'flex-start', padding:'8px 0' }}>
      <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'rgba(255,255,255,0.04)', flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'5px', paddingTop:'2px' }}>
        <div style={{ width:'75%', height:'10px', borderRadius:'5px', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ width:'45%', height:'9px',  borderRadius:'5px', background:'rgba(255,255,255,0.03)' }} />
      </div>
    </div>
  )
}

export function ActivityFeed({ logs, loading }: Props) {
  const recent = logs.slice(0, 8)

  return (
    <div style={{
      background:   '#090D18',
      border:       '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      overflow:     'hidden',
      display:      'flex',
      flexDirection:'column',
    }}>
      {/* Header */}
      <div style={{
        padding:'14px 18px',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        display:'flex', alignItems:'center', gap:'8px', flexShrink:0,
      }}>
        <Icon icon="solar:pulse-bold" width={16} style={{ color:'#10B981' }} />
        <span style={{ color:'#E2E8F0', fontWeight:600, fontSize:'0.875rem' }}>Recent Activity</span>
        <span style={{
          background:'rgba(16,185,129,0.10)', border:'1px solid rgba(16,185,129,0.20)',
          borderRadius:'99px', padding:'2px 7px', color:'#10B981', fontSize:'0.67rem',
          marginLeft:'auto',
        }}>Live</span>
      </div>

      {/* Feed */}
      <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:'2px', flex:1, overflowY:'auto' }}>
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonFeedItem key={i} />)}

        {!loading && recent.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: '8px',
            background: 'rgba(16,185,129,0.01)',
            borderRadius: '8px',
          }}>
            <Icon icon="solar:shield-check-bold" width={20} style={{ color: '#10B981' }} />
            <span style={{ color: '#E2E8F0', fontSize: '0.78rem', fontWeight: 600 }}>Monitoring Active</span>
          </div>
        )}

        {!loading && recent.map((entry) => {
          const meta = actionMeta(entry.action)
          return (
            <div
              key={entry.id}
              style={{
                display:'flex', alignItems:'flex-start', gap:'10px',
                padding:'9px 8px', borderRadius:'9px',
                transition:'background 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* Icon dot */}
              <div style={{
                width:'28px', height:'28px', borderRadius:'8px',
                background:`${meta.color}18`,
                border:`1px solid ${meta.color}28`,
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, marginTop:'1px',
              }}>
                <Icon icon={meta.icon} width={13} style={{ color: meta.color }} />
              </div>

              {/* Text */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{
                  color:'#94A3B8', fontSize:'0.78rem', margin:0,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  <span style={{ color:'#E2E8F0', fontWeight:500 }}>
                    {entry.actor_name ?? 'System'}
                  </span>{' '}
                  {entry.action}
                </p>
                <p style={{ color:'#334155', fontSize:'0.68rem', margin:'2px 0 0', fontFamily:'monospace' }}>
                  {relativeTime(entry.created_at)}
                  {entry.resource_type && (
                    <span style={{ color:'#1E293B' }}> · {entry.resource_type}</span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

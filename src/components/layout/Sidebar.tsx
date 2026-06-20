'use client'
// =============================================================================
// Sidebar — Sprint 6A Layout
// Collapsible sidebar with active route detection, keyboard accessible nav,
// icon-only collapsed mode, and user profile section at bottom.
// =============================================================================
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare,
  Database,
  LayoutDashboard,
  ShieldAlert,
  Scale,
  BarChart3,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  Activity,
} from 'lucide-react'
import { colors, font, radius, transition, iconSize } from '@/components/ui/tokens'
import { UsageWidget } from '@/features/trial/components/UsageWidget'


interface NavItem {
  href:    string
  label:   string
  icon:    React.ReactNode
  exact?:  boolean
  roles?:  string[]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

interface Props {
  userEmail?: string
  userName?:  string
  role?:      string
}

export function Sidebar({ userEmail, userName, role }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  const NAV_GROUPS: NavGroup[] = [
    {
      title: 'MISSION',
      items: [
        {
          href:  '/dashboard',
          label: 'Command Center',
          icon:  <LayoutDashboard size={iconSize.md} aria-hidden="true" />,
          exact: true,
        },
      ]
    },
    {
      title: 'WORKSPACES',
      items: [
        {
          href:  '/chat',
          label: 'Knowledge Workbench',
          icon:  <MessageSquare size={iconSize.md} aria-hidden="true" />,
        },
        {
          href:  '/workflows',
          label: 'Compliance Workflows',
          icon:  <ScrollText size={iconSize.md} aria-hidden="true" />,
        },
        {
          href:  '/knowledge-vault',
          label: 'Knowledge Vault',
          icon:  <Database size={iconSize.md} aria-hidden="true" />,
        },
      ]
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          href:  '/dashboard/security',
          label: 'Security',
          icon:  <ShieldAlert size={iconSize.md} aria-hidden="true" />,
          roles: ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'],
        },
        {
          href:  '/dashboard/compliance',
          label: 'Compliance',
          icon:  <Scale size={iconSize.md} aria-hidden="true" />,
          roles: ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'],
        },
        {
          href:  '/dashboard/governance',
          label: 'AI Governance',
          icon:  <Shield size={iconSize.md} aria-hidden="true" />,
          roles: ['super_admin', 'compliance_officer'],
        },
        {
          href:  '/dashboard/resilience',
          label: 'System Resilience',
          icon:  <Activity size={iconSize.md} aria-hidden="true" />,
          roles: ['super_admin', 'compliance_officer'],
        },
      ]
    },
    {
      title: 'INTELLIGENCE',
      items: [
        {
          href:  '/dashboard/reports',
          label: 'Analytics & Reports',
          icon:  <BarChart3 size={iconSize.md} aria-hidden="true" />,
        },
        {
          href:  '/dashboard/audit',
          label: 'Audit Log',
          icon:  <ScrollText size={iconSize.md} aria-hidden="true" />,
        },
      ]
    }
  ]

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const initials = userName
    ? userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : userEmail?.charAt(0).toUpperCase() ?? '?'

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      aria-label="Primary navigation"
    >
      {/* Logo + collapse button */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding:        '16px 14px 12px',
          borderBottom:   '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink:     0,
          height:         '56px',
        }}
      >
        {!collapsed && (
          <Link
            href="/command-hub"
            className="aegis-logo-link"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <img
              src="/logo-icon.png"
              alt="Aegis Logo"
              className="logo-img"
              style={{
                height: '28px',
                width: '28px',
                objectFit: 'contain',
                userSelect: 'none',
                transition: 'transform 0.3s ease, filter 0.3s ease',
              }}
              draggable={false}
            />
            <span
              className="logo-text"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                fontFamily: font.sans,
                letterSpacing: '0.04em',
                background: 'linear-gradient(135deg, #22D3EE 0%, #6366F1 50%, #8B5CF6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
                transition: 'filter 0.3s ease',
              }}
            >
              Aegis
            </span>
          </Link>
        )}

        {collapsed && (
          <Link
            href="/command-hub"
            className="aegis-logo-link collapsed"
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <img
              src="/logo-icon.png"
              alt="AegisRAG Logo"
              className="logo-img"
              style={{
                width: '28px',
                height: '28px',
                objectFit: 'contain',
                transition: 'transform 0.3s ease, filter 0.3s ease',
              }}
            />
          </Link>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar (Ctrl+B)"
            title="Collapse sidebar (Ctrl+B)"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textMuted, padding: '4px', borderRadius: radius.sm,
              display: 'flex', alignItems: 'center', transition: transition.fast,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar (Ctrl+B)"
            title="Expand sidebar (Ctrl+B)"
            style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
              cursor: 'pointer', color: colors.textMuted, padding: '6px',
              borderRadius: radius.md, display: 'flex', alignItems: 'center',
              transition: transition.fast,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary}
            onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Nav items grouped as a tactical command layer */}
      <nav
        aria-label="App navigation"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}
      >
        {NAV_GROUPS.map((group, groupIdx) => {
          const visibleItems = group.items.filter(item => {
            if (!item.roles) return true
            if (!role) return false
            return item.roles.includes(role)
          })

          if (visibleItems.length === 0) return null

          return (
            <div key={group.title} style={{ marginBottom: '18px' }}>
              {!collapsed ? (
                <div className="sidebar-group-header">
                  {group.title}
                </div>
              ) : (
                groupIdx > 0 && (
                  <div
                    style={{
                      height: '1px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      margin: '6px 12px 10px',
                    }}
                    aria-hidden="true"
                  />
                )
              )}

              <ul role="list" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px', margin: 0, padding: 0 }}>
                {visibleItems.map((item) => {
                  const active = isActive(item)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`sidebar-nav-item ${active ? 'active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        style={{
                          justifyContent: collapsed ? 'center' : undefined,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            flexShrink: 0,
                            color: active ? colors.indigoLight : colors.textMuted,
                            display: 'flex',
                            transition: transition.fast,
                          }}
                        >
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {!collapsed && <UsageWidget role={role} />}

      {/* Operator Identity Strip */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          padding: collapsed ? '10px 6px' : '10px 10px',
          background: 'rgba(5, 8, 15, 0.5)',
          flexShrink: 0,
        }}
      >
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              title={`${userName ?? userEmail ?? 'User'} · ${role ?? ''}`}
              style={{
                width: '30px', height: '30px', borderRadius: '6px',
                background: `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: font.sizes.base, fontWeight: 700,
                position: 'relative',
              }}
            >
              {initials}
              <span style={{
                position: 'absolute', bottom: '-1px', right: '-1px',
                width: '7px', height: '7px', borderRadius: '50%',
                background: colors.emerald, border: '1px solid #080C14',
                boxShadow: '0 0 5px #10B981',
              }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Avatar */}
            <div
              aria-hidden="true"
              style={{
                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                background: `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: font.sizes.xs, fontWeight: 700,
                position: 'relative',
              }}
            >
              {initials}
              <span style={{
                position: 'absolute', bottom: '-1px', right: '-1px',
                width: '6px', height: '6px', borderRadius: '50%',
                background: colors.emerald, border: '1px solid #080C14',
                boxShadow: '0 0 4px #10B981',
              }} />
            </div>

            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                color: colors.textPrimary, fontSize: font.sizes.base,
                fontWeight: 650, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {userName ?? userEmail?.split('@')[0] ?? 'Operator'}
              </p>
              <p style={{
                color: colors.textMuted, fontSize: '9px',
                margin: 0, letterSpacing: '0.04em', fontFamily: font.mono,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }}>
                {role?.replace(/_/g, ' ') ?? 'SUPER ADMIN'}
              </p>
            </div>

            {/* Sign out */}
            <a
              href="/auth/signout"
              aria-label="Sign out"
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', color: colors.textMuted,
                textDecoration: 'none', padding: '4px', borderRadius: radius.sm,
                transition: transition.fast, flexShrink: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.rose}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.textMuted}
            >
              <LogOut size={12} aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </aside>
  )
}


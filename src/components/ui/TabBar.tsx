// =============================================================================
// TabBar — Sprint 6A Design System
// Animated tab bar with active indicator, icons, and keyboard navigation.
// =============================================================================
'use client'
import React, { useRef } from 'react'
import { colors, radius, font, transition } from './tokens'

interface Tab {
  id:    string
  label: string
  icon?: React.ReactNode
  badge?: number
  color?: string  // per-tab accent; falls back to the global accentColor prop
}

interface TabBarProps {
  tabs:     Tab[]
  activeId: string
  onChange: (id: string) => void
  accentColor?: string
}

export function TabBar({ tabs, activeId, onChange, accentColor = colors.indigo }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    const ids = tabs.map((t) => t.id)
    const idx = ids.indexOf(id)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      onChange(ids[(idx + 1) % ids.length])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onChange(ids[(idx - 1 + ids.length) % ids.length])
    }
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Dashboard sections"
      style={{
        display: 'flex',
        gap: '2px',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${colors.glassBorder}`,
        padding: '4px',
        borderRadius: radius.xl,
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '7px 14px',
              borderRadius: radius.lg,
              fontSize: font.sizes.md,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              transition: transition.colors,
              background: isActive ? `${tab.color ?? accentColor}18` : 'transparent',
              color: isActive ? (tab.color ?? accentColor) : colors.textMuted,
              letterSpacing: '-0.01em',
              position: 'relative',
              borderBottom: isActive ? `2px solid ${tab.color ?? accentColor}` : '2px solid transparent',
            }}
          >
            {tab.icon && (
              <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.7 }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  background: colors.rose,
                  color: colors.textPrimary,
                  fontSize: font.sizes.xs,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: radius.full,
                  minWidth: '16px',
                  textAlign: 'center',
                  lineHeight: '14px',
                }}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

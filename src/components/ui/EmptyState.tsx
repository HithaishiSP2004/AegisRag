// =============================================================================
// EmptyState — Sprint 6A Design System
// Centered empty state with icon, title, description, and optional action.
// =============================================================================
import React from 'react'
import { colors, font, radius } from './tokens'

interface EmptyStateProps {
  icon:        React.ReactNode
  title:       string
  description?: string
  action?:     React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: radius.xl,
          background: colors.glassSurface,
          border: `1px solid ${colors.glassBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textFaint,
        }}
      >
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
        <p style={{ color: colors.textSecondary, fontSize: font.sizes.lg, fontWeight: 600, margin: 0 }}>
          {title}
        </p>
        {description && (
          <p style={{ color: colors.textMuted, fontSize: font.sizes.base, margin: 0, lineHeight: 1.6 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ marginTop: '4px' }}>{action}</div>}
    </div>
  )
}

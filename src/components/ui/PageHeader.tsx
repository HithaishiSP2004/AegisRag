// =============================================================================
// PageHeader — Sprint 6A Design System
// Breadcrumb + title + subtitle + right-side action slot.
// =============================================================================
import React from 'react'
import { ChevronRight } from 'lucide-react'
import { colors, font, iconSize } from './tokens'

interface Crumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  crumbs:      Crumb[]
  title:       string
  description?: string
  actions?:    React.ReactNode
  badge?:      React.ReactNode
}

export function PageHeader({ crumbs, title, description, actions, badge }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '8px',
          }}
        >
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.label}>
              {i > 0 && (
                <ChevronRight
                  size={iconSize.sm}
                  style={{ color: colors.textFaint }}
                  aria-hidden="true"
                />
              )}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  style={{
                    color: i === crumbs.length - 1 ? colors.textMuted : colors.textFaint,
                    fontSize: font.sizes.base,
                    textDecoration: 'none',
                    fontWeight: i === crumbs.length - 1 ? 500 : 400,
                  }}
                >
                  {crumb.label}
                </a>
              ) : (
                <span
                  aria-current={i === crumbs.length - 1 ? 'page' : undefined}
                  style={{
                    color: i === crumbs.length - 1 ? colors.textMuted : colors.textFaint,
                    fontSize: font.sizes.base,
                    fontWeight: i === crumbs.length - 1 ? 500 : 400,
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Title + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: font.sizes['5xl'],
              fontWeight: 800,
              color: colors.textPrimary,
              letterSpacing: '-0.03em',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>
          {badge}
        </div>

        {/* Description */}
        {description && (
          <p style={{ color: colors.textMuted, fontSize: font.sizes.lg, margin: '6px 0 0', lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>

      {/* Actions slot */}
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}

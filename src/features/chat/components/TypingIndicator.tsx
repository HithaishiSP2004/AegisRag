'use client'
// =============================================================================
// TypingIndicator — Sprint 6A Chat Redesign
// Three-dot animated typing indicator for AI response loading state.
// =============================================================================
import { colors } from '@/components/ui/tokens'

export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="AegisRAG is thinking"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '4px 0',
        animation: 'fadeInUp 0.2s ease forwards',
      }}
    >
      {/* AI Avatar */}
      <div
        aria-hidden="true"
        style={{
          width: '32px', height: '32px', borderRadius: '10px',
          background: `linear-gradient(135deg, ${colors.emerald}, ${colors.sky})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: '2px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Dots container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '4px 16px 16px 16px',
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

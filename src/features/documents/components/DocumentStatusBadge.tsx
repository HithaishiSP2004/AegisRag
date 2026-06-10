// =============================================================================
// DocumentStatusBadge — Sprint 6A Redesign
// Maps document status → badge with Lucide icons and design tokens.
// Animated pulse for in-progress states.
// =============================================================================
import {
  CloudUpload, FileText, Layers, Cpu, CheckCircle2,
  AlertTriangle, XCircle, Trash2,
} from 'lucide-react'
import type { DocumentStatus } from '../types'
import { colors, radius, font } from '@/components/ui/tokens'

interface DocumentStatusBadgeProps {
  status: DocumentStatus
  size?:  'sm' | 'md'
}

const STATUS_CONFIG: Record<DocumentStatus, {
  label:  string
  icon:   React.ReactNode
  text:   string
  bg:     string
  border: string
  pulse?: boolean
}> = {
  uploading: {
    label: 'Uploading',
    icon:  <CloudUpload  size={12} aria-hidden="true" />,
    text:  colors.blueLight,
    bg:    'rgba(59,130,246,0.10)',
    border:'rgba(59,130,246,0.25)',
    pulse: true,
  },
  parsing: {
    label: 'Parsing',
    icon:  <FileText     size={12} aria-hidden="true" />,
    text:  colors.violetLight,
    bg:    'rgba(139,92,246,0.10)',
    border:'rgba(139,92,246,0.25)',
    pulse: true,
  },
  chunking: {
    label: 'Chunking',
    icon:  <Layers       size={12} aria-hidden="true" />,
    text:  colors.cyan,
    bg:    'rgba(34,211,238,0.08)',
    border:'rgba(34,211,238,0.20)',
    pulse: true,
  },
  embedding: {
    label: 'Embedding',
    icon:  <Cpu          size={12} aria-hidden="true" />,
    text:  colors.amber,
    bg:    'rgba(245,158,11,0.10)',
    border:'rgba(245,158,11,0.25)',
    pulse: true,
  },
  indexed: {
    label: 'Indexed',
    icon:  <CheckCircle2 size={12} aria-hidden="true" />,
    text:  colors.emeraldLight,
    bg:    'rgba(16,185,129,0.10)',
    border:'rgba(16,185,129,0.25)',
  },
  embedding_failed: {
    label: 'Embedding Failed',
    icon:  <AlertTriangle size={12} aria-hidden="true" />,
    text:  '#FB923C',
    bg:    'rgba(251,146,60,0.10)',
    border:'rgba(251,146,60,0.30)',
  },
  failed: {
    label: 'Failed',
    icon:  <XCircle      size={12} aria-hidden="true" />,
    text:  colors.rose,
    bg:    'rgba(244,63,94,0.10)',
    border:'rgba(244,63,94,0.25)',
  },
  deleted: {
    label: 'Deleted',
    icon:  <Trash2       size={12} aria-hidden="true" />,
    text:  colors.textMuted,
    bg:    'rgba(71,85,105,0.10)',
    border:'rgba(71,85,105,0.20)',
  },
}

export function DocumentStatusBadge({ status, size = 'md' }: DocumentStatusBadgeProps) {
  const cfg     = STATUS_CONFIG[status]
  const isSmall = size === 'sm'

  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label}`}
      style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        '5px',
        padding:    isSmall ? '2px 8px' : '3px 10px',
        borderRadius: radius.full,
        background: cfg.bg,
        border:     `1px solid ${cfg.border}`,
        color:      cfg.text,
        fontSize:   isSmall ? font.sizes.xs : font.sizes.base,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex',
          animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      >
        {cfg.icon}
      </span>
      {cfg.label}
    </span>
  )
}

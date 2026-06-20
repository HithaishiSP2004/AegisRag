// =============================================================================
// DocumentStatusBadge — Sprint 6A Redesign
// Maps document status → badge with Lucide icons and design tokens.
// Animated pulse for in-progress states.
// =============================================================================
import {
  CloudUpload, FileText, Layers, Cpu, CheckCircle2,
  AlertTriangle, XCircle, Trash2, Clock,
} from 'lucide-react'
import type { DocumentStatus } from '../types'
import { colors, radius, font } from '@/components/ui/tokens'

interface DocumentStatusBadgeProps {
  status: DocumentStatus
  size?:  'sm' | 'md'
}

const STATUS_CONFIG: Record<DocumentStatus | 'unknown', {
  label:  string
  icon:   React.ReactNode
  text:   string
  bg:     string
  border: string
  pulse?: boolean
  tooltip?: string
}> = {
  uploading: {
    label: 'Uploading',
    icon:  <CloudUpload  size={12} aria-hidden="true" />,
    text:  colors.blueLight,
    bg:    'rgba(59,130,246,0.10)',
    border:'rgba(59,130,246,0.25)',
    pulse: true,
    tooltip: 'Document is uploading to secure storage',
  },
  parsing: {
    label: 'Parsing',
    icon:  <FileText     size={12} aria-hidden="true" />,
    text:  colors.violetLight,
    bg:    'rgba(139,92,246,0.10)',
    border:'rgba(139,92,246,0.25)',
    pulse: true,
    tooltip: 'Extracting narrative text from file content',
  },
  chunking: {
    label: 'Chunking',
    icon:  <Layers       size={12} aria-hidden="true" />,
    text:  colors.cyan,
    bg:    'rgba(34,211,238,0.08)',
    border:'rgba(34,211,238,0.20)',
    pulse: true,
    tooltip: 'Segmenting text into contextual analysis units',
  },
  embedding: {
    label: 'Embedding',
    icon:  <Cpu          size={12} aria-hidden="true" />,
    text:  colors.amber,
    bg:    'rgba(245,158,11,0.10)',
    border:'rgba(245,158,11,0.25)',
    pulse: true,
    tooltip: 'Generating high-dimensional semantic vectors',
  },
  indexed: {
    label: 'Indexed',
    icon:  <CheckCircle2 size={12} aria-hidden="true" />,
    text:  colors.emeraldLight,
    bg:    'rgba(16,185,129,0.10)',
    border:'rgba(16,185,129,0.25)',
    tooltip: 'Document is successfully indexed and searchable',
  },
  embedding_failed: {
    label: 'Embedding Failed',
    icon:  <AlertTriangle size={12} aria-hidden="true" />,
    text:  '#FB923C',
    bg:    'rgba(251,146,60,0.10)',
    border:'rgba(251,146,60,0.30)',
    tooltip: 'Vector encoding pipeline failed',
  },
  failed: {
    label: 'Failed',
    icon:  <XCircle      size={12} aria-hidden="true" />,
    text:  colors.rose,
    bg:    'rgba(244,63,94,0.10)',
    border:'rgba(244,63,94,0.25)',
    tooltip: 'Document processing failed',
  },
  deleted: {
    label: 'Deleted',
    icon:  <Trash2       size={12} aria-hidden="true" />,
    text:  colors.textMuted,
    bg:    'rgba(71,85,105,0.10)',
    border:'rgba(71,85,105,0.20)',
    tooltip: 'Document soft-deleted and removed from queries',
  },
  queued: {
    label: 'Queued',
    icon:  <Clock        size={12} aria-hidden="true" />,
    text:  colors.textMuted,
    bg:    'rgba(148,163,184,0.10)',
    border:'rgba(148,163,184,0.25)',
    pulse: true,
    tooltip: 'Awaiting scheduling in processing pipeline queue',
  },
  processing: {
    label: 'Processing',
    icon:  <Cpu          size={12} aria-hidden="true" />,
    text:  '#818CF8',
    bg:    'rgba(129,140,248,0.10)',
    border:'rgba(129,140,248,0.25)',
    pulse: true,
    tooltip: 'Active embedding pipeline job execution',
  },
  waiting_provider: {
    label: 'Rate Limited',
    icon:  <Clock        size={12} aria-hidden="true" />,
    text:  '#F59E0B',
    bg:    'rgba(245,158,11,0.10)',
    border:'rgba(245,158,11,0.25)',
    pulse: true,
    tooltip: 'Rate limit hit, waiting on provider to resume',
  },
  unknown: {
    label: 'Unknown',
    icon:  <AlertTriangle size={12} aria-hidden="true" />,
    text:  colors.textMuted,
    bg:    'rgba(148,163,184,0.10)',
    border:'rgba(148,163,184,0.25)',
    tooltip: 'Unknown document processing status',
  },
}

export function DocumentStatusBadge({ status, size = 'md' }: DocumentStatusBadgeProps) {
  const cfg = (status && status in STATUS_CONFIG)
    ? STATUS_CONFIG[status as DocumentStatus]
    : STATUS_CONFIG['unknown']
  const isSmall = size === 'sm'

  return (
    <span
      role="status"
      aria-label={`Status: ${cfg.label}`}
      title={cfg.tooltip ?? cfg.label}
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


'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Layers, Trash2, RefreshCw, Edit2, Check, AlertTriangle, FileText, ChevronRight, Play, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { colors, radius, font, shadow, transition } from '@/components/ui/tokens'
import {
  deletePageAction,
  reprocessPageAction,
  replacePageAction,
  fetchDocumentPagesAction
} from '@/features/pipeline/actions'
import { useToast } from '@/components/ui/Toast'

interface DocumentItem {
  id: string
  filename: string
  original_name: string
  classification: string
  page_count: number
  status: string
}

interface PageDetail {
  id: string
  page_number: number
  word_count: number
  status: string
  error_message: string | null
  raw_text: string | null
  chunk_count: number
  embedding_provider?: string | null
  embedding_model?: string | null
  embedding_dimensions?: number | null
}

interface Props {
  documents: DocumentItem[]
  orgStats: {
    total_documents: number
    total_pages: number
    total_chunks: number
    total_embeddings: number
    documents_added_today: number
    documents_updated_today: number
    documents_deleted_today: number
  }
  queueMetrics?: {
    queued: number
    processing: number
    completed: number
    failed: number
    avgProcessingTimeMs: number
  }
}

export function DiagnosticsCockpit({ documents, orgStats, queueMetrics }: Props) {
  const toast = useToast()
  const [selectedDocId, setSelectedDocId] = useState<string>('')
  const [pages, setPages] = useState<PageDetail[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [editingPageNum, setEditingPageNum] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [cacheStats, setCacheStats] = useState<{
    provider: string
    model: string
    dimensions: number
    cache_entries: number
    cache_hit_rate: number
  } | null>(null)

  useEffect(() => {
    const fetchCacheStats = async () => {
      try {
        const res = await fetch('/api/admin/cache/stats')
        if (res.ok) {
          const data = await res.json()
          setCacheStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch cache stats:', err)
      }
    }
    fetchCacheStats()
  }, [])

  // Find the selected document metadata
  const selectedDoc = documents.find(d => d.id === selectedDocId)

  // Load pages when selected document changes
  const loadPages = async (docId: string) => {
    if (!docId) {
      setPages([])
      return
    }
    setLoadingPages(true)
    try {
      const res = await fetchDocumentPagesAction(docId)
      if (res.success) {
        setPages(res.pages as PageDetail[])
      } else {
        toast.error(res.error || 'Failed to load page diagnostics')
      }
    } catch (err) {
      toast.error('Connection error occurred.')
    } finally {
      setLoadingPages(false)
    }
  }

  useEffect(() => {
    loadPages(selectedDocId)
  }, [selectedDocId])

  // Handlers
  const handleDeletePage = (pageNumber: number) => {
    if (!confirm(`Are you sure you want to delete page ${pageNumber}? This will delete its chunks and vector embeddings immediately.`)) return

    startTransition(async () => {
      const res = await deletePageAction(selectedDocId, pageNumber)
      if (res.success) {
        toast.success(`Page ${pageNumber} deleted successfully.`)
        loadPages(selectedDocId)
      } else {
        toast.error(res.error || 'Failed to delete page')
      }
    })
  }

  const handleReprocessPage = (pageNumber: number) => {
    startTransition(async () => {
      const res = await reprocessPageAction(selectedDocId, pageNumber)
      if (res.success) {
        toast.success(`Page ${pageNumber} reprocessed successfully.`)
        loadPages(selectedDocId)
      } else {
        toast.error(res.error || 'Failed to reprocess page')
      }
    })
  }

  const handleSavePageText = (pageNumber: number) => {
    startTransition(async () => {
      const res = await replacePageAction(selectedDocId, pageNumber, editText)
      if (res.success) {
        toast.success(`Page ${pageNumber} replaced and re-embedded successfully.`)
        setEditingPageNum(null)
        setEditText('')
        loadPages(selectedDocId)
      } else {
        toast.error(res.error || 'Failed to replace page text')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Background Queue Metrics ───────────────────────────────────── */}
      {queueMetrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, padding: '16px', boxShadow: shadow.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '4px' }}>
            <RefreshCw size={14} style={{ color: colors.violetLight }} />
            <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: '0.85rem' }}>Background Embedding Queue Metrics</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md }}>
              <span style={{ fontSize: '0.62rem', color: colors.textSecondary, textTransform: 'uppercase' }}>Queued Jobs</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.textPrimary, fontFamily: font.mono, marginTop: '4px' }}>{queueMetrics.queued}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md }}>
              <span style={{ fontSize: '0.62rem', color: colors.textSecondary, textTransform: 'uppercase' }}>Processing Jobs</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818CF8', fontFamily: font.mono, marginTop: '4px' }}>{queueMetrics.processing}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md }}>
              <span style={{ fontSize: '0.62rem', color: colors.textSecondary, textTransform: 'uppercase' }}>Completed Jobs</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.emerald, fontFamily: font.mono, marginTop: '4px' }}>{queueMetrics.completed}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md }}>
              <span style={{ fontSize: '0.62rem', color: colors.textSecondary, textTransform: 'uppercase' }}>Failed Jobs</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.rose, fontFamily: font.mono, marginTop: '4px' }}>{queueMetrics.failed}</div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md }}>
              <span style={{ fontSize: '0.62rem', color: colors.textSecondary, textTransform: 'uppercase' }}>Avg Job Duration</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: colors.cyan, fontFamily: font.mono, marginTop: '4px' }}>
                {queueMetrics.avgProcessingTimeMs > 0 ? `${(queueMetrics.avgProcessingTimeMs / 1000).toFixed(1)}s` : '—'}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ── Stats Summary Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', fontFamily: font.mono }}>Database Corpus</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: font.mono, color: colors.textPrimary }}>{orgStats.total_documents}</span>
            <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>Docs indexed</span>
          </div>
        </div>

        <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', fontFamily: font.mono }}>Total Corpus Pages</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: font.mono, color: colors.violetLight }}>{orgStats.total_pages}</span>
            <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>Pages</span>
          </div>
        </div>

        <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', fontFamily: font.mono }}>Dynamic Telemetry (Added)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: font.mono, color: colors.emerald }}>+{orgStats.documents_added_today}</span>
            <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>Added today</span>
          </div>
        </div>

        <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', fontFamily: font.mono }}>Dynamic Telemetry (Updated)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: font.mono, color: colors.blueLight }}>{orgStats.documents_updated_today}</span>
            <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>Updated today</span>
          </div>
        </div>

        <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', fontFamily: font.mono }}>Dynamic Telemetry (Deleted)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: font.mono, color: colors.rose }}>-{orgStats.documents_deleted_today}</span>
            <span style={{ fontSize: '0.75rem', color: colors.textMuted }}>Deleted today</span>
          </div>
        </div>

        {cacheStats && (
          <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, boxShadow: shadow.sm, gridColumn: 'span 2' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', fontFamily: font.mono }}>Active Embedding Cache Stats</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '8px' }}>
              <div>
                <span style={{ fontSize: '0.6rem', color: colors.textSecondary }}>PROVIDER</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textPrimary, textTransform: 'capitalize' }}>{cacheStats.provider}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.6rem', color: colors.textSecondary }}>MODEL</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textPrimary }}>{cacheStats.model}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.6rem', color: colors.textSecondary }}>DIMENSIONS</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.violetLight }}>{cacheStats.dimensions}d</div>
              </div>
              <div>
                <span style={{ fontSize: '0.6rem', color: colors.textSecondary }}>CACHED ENTRIES</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.emerald }}>{cacheStats.cache_entries}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.6rem', color: colors.textSecondary }}>HIT RATE</span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.cyan }}>{cacheStats.cache_hit_rate}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Document Explorer Cockpit ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Document List Selector */}
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.xl, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.glassBorder}`, background: colors.glassSurface }}>
            <span style={{ color: colors.textPrimary, fontWeight: 700, fontSize: font.sizes.base }}>Select Document</span>
          </div>

          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {documents.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', textAlign: 'center', padding: '24px' }}>No documents available</p>
            ) : (
              documents.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: selectedDocId === doc.id ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${selectedDocId === doc.id ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: radius.md,
                    cursor: 'pointer',
                    transition: transition.fast,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: font.sizes.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {doc.original_name}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.65rem', color: colors.textSecondary }}>
                    <span>{doc.classification.toUpperCase()} · {doc.page_count} Pages</span>
                    <span style={{
                      color: doc.status === 'indexed' ? colors.emerald 
                           : doc.status === 'failed' || doc.status === 'embedding_failed' ? colors.rose 
                           : doc.status === 'queued' ? colors.textMuted
                           : doc.status === 'processing' ? '#818CF8'
                           : colors.violetLight
                    }}>
                      {doc.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Page Diagnostic Cockpit */}
        <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!selectedDocId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', border: `1px dashed ${colors.glassBorder}`, borderRadius: radius.xl, padding: '48px', color: colors.textMuted }}>
              <Layers size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: font.sizes.base }}>Select a document from the explorer to view page-level diagnostics and execute targeted CRUD operations.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Selected Doc Header */}
              <div style={{ padding: '16px', background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: colors.textPrimary, fontSize: font.sizes.lg, fontWeight: 700 }}>{selectedDoc?.original_name}</h4>
                  <p style={{ margin: 0, color: colors.textSecondary, fontSize: '0.7rem', fontFamily: font.mono }}>ID: {selectedDoc?.id}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => loadPages(selectedDocId)}
                    disabled={loadingPages}
                    icon={<RefreshCw size={12} className={loadingPages ? 'animate-spin' : ''} />}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Pages Grid */}
              {loadingPages ? (
                <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: colors.indigo }} />
                </div>
              ) : pages.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: `1px dashed ${colors.glassBorder}`, borderRadius: radius.lg }}>
                  <span style={{ color: colors.textMuted, fontSize: '0.75rem' }}>No pages registered in database for this document.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pages.map(page => (
                    <div
                      key={page.id}
                      style={{
                        padding: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${colors.glassBorder}`,
                        borderRadius: radius.lg,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        position: 'relative'
                      }}
                    >
                      {/* Page Info Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: font.sizes.base, fontWeight: 700, color: colors.textPrimary, fontFamily: font.mono }}>
                            PAGE #{page.page_number}
                          </span>
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: page.status === 'embedded' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            color: page.status === 'embedded' ? colors.emerald : colors.amber,
                            border: `1px solid ${page.status === 'embedded' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`
                          }}>
                            {page.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Page Stats */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.7rem', color: colors.textSecondary }}>
                          {page.embedding_provider && (
                            <span style={{ color: colors.violetLight }}>
                              Provenance: <strong>{page.embedding_provider} ({page.embedding_model}, {page.embedding_dimensions}d)</strong>
                            </span>
                          )}
                          <span>Word Count: <strong style={{ color: colors.textPrimary, fontFamily: font.mono }}>{page.word_count}</strong></span>
                          <span>Chunks: <strong style={{ color: colors.textPrimary, fontFamily: font.mono }}>{page.chunk_count}</strong></span>
                          <span>Vectors: <strong style={{ color: colors.textPrimary, fontFamily: font.mono }}>{page.chunk_count}</strong></span>
                        </div>
                      </div>

                      {/* Diagnostic logs / error messages */}
                      {page.error_message && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(244,63,94,0.05)', border: `1px solid rgba(244,63,94,0.15)`, borderRadius: radius.sm, color: colors.rose, fontSize: '0.7rem' }}>
                          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                          <span>{page.error_message}</span>
                        </div>
                      )}

                      {/* Replace/Edit Text Mode */}
                      {editingPageNum === page.page_number ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            style={{
                              width: '100%',
                              height: '140px',
                              background: 'rgba(0,0,0,0.2)',
                              border: `1px solid ${colors.indigo}`,
                              borderRadius: radius.md,
                              color: colors.textPrimary,
                              fontSize: '0.75rem',
                              padding: '10px',
                              fontFamily: font.sans,
                              outline: 'none',
                              resize: 'vertical'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingPageNum(null)
                                setEditText('')
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSavePageText(page.page_number)}
                              disabled={isPending}
                              icon={isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            >
                              Save & Re-embed
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Default display: buttons & text summary */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {page.raw_text && (
                            <div style={{
                              maxHeight: '60px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontSize: '0.72rem',
                              color: colors.textSecondary,
                              background: 'rgba(0,0,0,0.15)',
                              padding: '8px 10px',
                              borderRadius: radius.sm,
                              whiteSpace: 'nowrap'
                            }}>
                              {page.raw_text}
                            </div>
                          )}

                          {/* Dynamic Operations Cockpit Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                            <span style={{ fontSize: '0.65rem', color: colors.textMuted, fontFamily: font.mono }}>Targeted page control</span>
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingPageNum(page.page_number)
                                  setEditText(page.raw_text || '')
                                }}
                                icon={<Edit2 size={10} />}
                              >
                                Replace Text
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleReprocessPage(page.page_number)}
                                disabled={isPending}
                                icon={<RefreshCw size={10} className={isPending ? 'animate-spin' : ''} />}
                              >
                                Reprocess Page
                              </Button>

                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeletePage(page.page_number)}
                                disabled={isPending}
                                icon={<Trash2 size={10} />}
                              >
                                Delete Page
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

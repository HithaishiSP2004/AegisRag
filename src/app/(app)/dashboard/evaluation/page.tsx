'use client'

import React, { useState, useEffect } from 'react'
import { Card, Button, Badge } from '@/components/ui'
import { colors, radius, font, shadow, transition } from '@/components/ui/tokens'
import {
  Play,
  RotateCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Eye,
  Info,
  Search
} from 'lucide-react'

interface RunSummary {
  id: string
  dataset_name: string
  total_questions: number
  passed_questions: number
  overall_score: number
  retrieval_score: number
  grounding_score: number
  citation_score: number
  hallucination_score: number
  latency_ms: number
  provider: string
  model_name: string
  evaluation_version: string
  dataset_version: string
  created_at: string
}

interface QuestionEvaluation {
  id: string
  question: string
  expected_answer: string | null
  generated_answer: string | null
  retrieved_chunks: number
  retrieval_score: number
  grounding_score: number
  citation_score: number
  hallucination_score: number
  latency_ms: number
  passed: boolean
  failure_reason: 'LOW_RETRIEVAL' | 'NO_CHUNKS' | 'BAD_CITATION' | 'HALLUCINATION' | 'TIMEOUT' | 'OTHER' | null
}

const DATASET_LABELS: Record<string, string> = {
  nist80053: 'NIST SP 800-53 Rev5',
  nistcsf20: 'NIST CSF 2.0',
  owasp_top10: 'OWASP Top 10',
  all: 'All Datasets'
}

export default function EvaluationDashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<RunSummary | null>(null)
  const [questions, setQuestions] = useState<QuestionEvaluation[]>([])
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [runningEval, setRunningEval] = useState(false)
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionEvaluation | null>(null)
  const [tab, setTab] = useState<'runs' | 'questions'>('runs')

  // Fetch all historical runs
  const fetchRuns = async (selectLatest = false) => {
    setLoadingRuns(true)
    try {
      const res = await fetch('/api/admin/evaluation')
      const data = await res.json()
      if (data.success) {
        setRuns(data.runs)
        if (selectLatest && data.runs.length > 0) {
          handleSelectRun(data.runs[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err)
    } finally {
      setLoadingRuns(false)
    }
  }

  // Fetch detailed evaluations for a selected run
  const handleSelectRun = async (run: RunSummary) => {
    setSelectedRun(run)
    setLoadingDetails(true)
    setSelectedQuestion(null)
    setTab('runs')
    try {
      const res = await fetch(`/api/admin/evaluation?runId=${run.id}`)
      const data = await res.json()
      if (data.success) {
        setQuestions(data.questions)
      }
    } catch (err) {
      console.error('Failed to fetch run details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Trigger a new evaluation run
  const handleRunEvaluation = async (datasetName: string) => {
    setRunningEval(true)
    setRunMessage(`Running evaluation on ${DATASET_LABELS[datasetName]}... This may take a few moments.`)
    try {
      const res = await fetch('/api/admin/evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetName, evaluationName: `Run - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}` })
      })
      const data = await res.json()
      if (data.success) {
        setRunMessage('Evaluation completed successfully!')
        await fetchRuns(true)
      } else {
        setRunMessage(`Error: ${data.error || 'Failed to complete evaluation'}`)
      }
    } catch (err: any) {
      setRunMessage(`Error: ${err.message || 'Server error occurred'}`)
    } finally {
      setRunningEval(false)
      setTimeout(() => setRunMessage(null), 5000)
    }
  }

  // Export selected run to CSV
  const handleExportCSV = () => {
    if (!selectedRun || questions.length === 0) return

    const headers = [
      'Question',
      'Expected Answer',
      'Generated Answer',
      'Retrieved Chunks',
      'Retrieval Score',
      'Grounding Score',
      'Citation Score',
      'Hallucination Score',
      'Overall Score',
      'Latency (ms)',
      'Passed',
      'Failure Reason'
    ]

    const rows = questions.map((q) => [
      q.question,
      q.expected_answer || '',
      q.generated_answer || '',
      q.retrieved_chunks,
      q.retrieval_score,
      q.grounding_score,
      q.citation_score,
      q.hallucination_score,
      ((q.retrieval_score + q.grounding_score + q.citation_score + q.hallucination_score) / 4).toFixed(1),
      q.latency_ms,
      q.passed ? 'Yes' : 'No',
      q.failure_reason || ''
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `eval_run_${selectedRun.dataset_name}_${selectedRun.id.slice(0, 8)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export selected run to JSON
  const handleExportJSON = () => {
    if (!selectedRun || questions.length === 0) return

    const exportData = {
      summary: selectedRun,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        expectedAnswer: q.expected_answer,
        generatedAnswer: q.generated_answer,
        retrievedChunks: q.retrieved_chunks,
        scores: {
          retrieval: q.retrieval_score,
          grounding: q.grounding_score,
          citation: q.citation_score,
          hallucination: q.hallucination_score,
          overall: (q.retrieval_score + q.grounding_score + q.citation_score + q.hallucination_score) / 4
        },
        latencyMs: q.latency_ms,
        passed: q.passed,
        failureReason: q.failure_reason
      }))
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `eval_run_${selectedRun.dataset_name}_${selectedRun.id.slice(0, 8)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    document.body.removeChild(downloadAnchor)
  }

  useEffect(() => {
    fetchRuns(true)
  }, [])

  // Calculate Failure Categories Breakdown
  const failureStats = {
    LOW_RETRIEVAL: 0,
    NO_CHUNKS: 0,
    BAD_CITATION: 0,
    HALLUCINATION: 0,
    TIMEOUT: 0,
    OTHER: 0
  }

  let failedCount = 0
  questions.forEach((q) => {
    if (!q.passed) {
      failedCount++
      if (q.failure_reason) {
        failureStats[q.failure_reason] = (failureStats[q.failure_reason] || 0) + 1
      } else {
        failureStats.OTHER++
      }
    }
  })

  const failureRates = Object.entries(failureStats).map(([key, value]) => ({
    name: key.replace('_', ' '),
    count: value,
    pct: failedCount > 0 ? parseFloat(((value / failedCount) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.count - a.count)

  const filteredQuestions = questions.filter(q =>
    q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.failure_reason && q.failure_reason.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div style={{ padding: '24px 0', fontFamily: font.sans, color: colors.textPrimary }}>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: font.sizes['4xl'], fontWeight: 700, letterSpacing: '-0.02em', background: `linear-gradient(to right, ${colors.textPrimary}, ${colors.textSecondary})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            RAG Evaluation Control Panel
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: font.sizes.lg, marginTop: '4px' }}>
            Measure retrieval quality, grounding accuracy, citation verification, and hallucination metrics.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => fetchRuns(false)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCw size={16} /> Refresh
          </Button>
        </div>
      </div>

      {/* Run triggers */}
      <Card variant="elevated" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: font.sizes['2xl'], fontWeight: 600, borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Play size={20} style={{ color: colors.indigo }} /> Trigger Benchmark Evaluations
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Button variant="subtle" disabled={runningEval} onClick={() => handleRunEvaluation('nist80053')} style={{ justifyContent: 'space-between' }}>
            <span>NIST SP 800-53</span>
            <Badge variant="purple">100 Qs</Badge>
          </Button>
          <Button variant="subtle" disabled={runningEval} onClick={() => handleRunEvaluation('nistcsf20')} style={{ justifyContent: 'space-between' }}>
            <span>NIST CSF 2.0</span>
            <Badge variant="cyan">75 Qs</Badge>
          </Button>
          <Button variant="subtle" disabled={runningEval} onClick={() => handleRunEvaluation('owasp_top10')} style={{ justifyContent: 'space-between' }}>
            <span>OWASP Top 10</span>
            <Badge variant="purple">75 Qs</Badge>
          </Button>
          <Button variant="primary" disabled={runningEval} onClick={() => handleRunEvaluation('all')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Play size={16} /> Run All (250 Qs)
          </Button>
        </div>

        {runMessage && (
          <div style={{
            padding: '12px 16px',
            borderRadius: radius.lg,
            background: runMessage.startsWith('Error') ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${runMessage.startsWith('Error') ? colors.rose : colors.emerald}`,
            color: runMessage.startsWith('Error') ? colors.rose : colors.emerald,
            fontSize: font.sizes.md,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Info size={16} /> {runMessage}
          </div>
        )}
      </Card>

      {/* Main Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Sidebar: Historical Runs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: font.sizes.xl, fontWeight: 600, color: colors.textSecondary }}>Historical Runs</h3>
          {loadingRuns ? (
            <div style={{ color: colors.textMuted }}>Loading runs...</div>
          ) : runs.length === 0 ? (
            <div style={{ color: colors.textMuted }}>No runs recorded yet. Run a dataset above to generate stats.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => handleSelectRun(run)}
                  style={{
                    padding: '12px',
                    borderRadius: radius.lg,
                    background: selectedRun?.id === run.id ? colors.bgCardHover : colors.bgCard,
                    border: `1px solid ${selectedRun?.id === run.id ? colors.indigo : colors.glassBorder}`,
                    cursor: 'pointer',
                    transition: transition.base,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: font.sizes.md }}>
                      {DATASET_LABELS[run.dataset_name] || run.dataset_name}
                    </span>
                    <Badge variant={run.overall_score >= 80 ? 'success' : 'danger'}>
                      {run.overall_score.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: font.sizes.sm, color: colors.textSecondary }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Passed Qs:</span>
                      <span style={{ color: colors.textPrimary }}>{run.passed_questions}/{run.total_questions}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Provider/Model:</span>
                      <span style={{ color: colors.textPrimary, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {run.provider} ({run.model_name})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: font.sizes.xs, color: colors.textMuted }}>
                      <span>{new Date(run.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div>
          {selectedRun ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                <Card variant="elevated" style={{ borderTop: `4px solid ${colors.indigo}`, padding: '16px' }}>
                  <div style={{ color: colors.textSecondary, fontSize: font.sizes.sm }}>Overall Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: selectedRun.overall_score >= 80 ? colors.emerald : colors.rose }}>
                    {selectedRun.overall_score.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Target: &gt;= 80.0%</div>
                </Card>

                <Card variant="elevated" style={{ borderTop: `4px solid ${colors.blue}`, padding: '16px' }}>
                  <div style={{ color: colors.textSecondary, fontSize: font.sizes.sm }}>Retrieval Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: colors.blueLight }}>
                    {selectedRun.retrieval_score.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Doc & Keyword Match</div>
                </Card>

                <Card variant="elevated" style={{ borderTop: `4px solid ${colors.emerald}`, padding: '16px' }}>
                  <div style={{ color: colors.textSecondary, fontSize: font.sizes.sm }}>Grounding Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: colors.emeraldLight }}>
                    {selectedRun.grounding_score.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Grounded in Context</div>
                </Card>

                <Card variant="elevated" style={{ borderTop: `4px solid ${colors.violet}`, padding: '16px' }}>
                  <div style={{ color: colors.textSecondary, fontSize: font.sizes.sm }}>Citation Score</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: colors.violetLight }}>
                    {selectedRun.citation_score.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Reference hit rate</div>
                </Card>

                <Card variant="elevated" style={{ borderTop: `4px solid ${colors.rose}`, padding: '16px' }}>
                  <div style={{ color: colors.textSecondary, fontSize: font.sizes.sm }}>Hallucination Risk</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: selectedRun.hallucination_score >= 80 ? colors.emerald : colors.rose }}>
                    {(100 - selectedRun.hallucination_score).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Lower is better</div>
                </Card>

                <Card variant="elevated" style={{ borderTop: `4px solid ${colors.amber}`, padding: '16px' }}>
                  <div style={{ color: colors.textSecondary, fontSize: font.sizes.sm }}>Total Latency</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, margin: '8px 0', color: colors.amberLight }}>
                    {(selectedRun.latency_ms / 1000).toFixed(2)}s
                  </div>
                  <div style={{ fontSize: font.sizes.xs, color: colors.textMuted }}>Run aggregate time</div>
                </Card>
              </div>

              {/* Action bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colors.bgCard, padding: '12px 20px', borderRadius: radius.lg, border: `1px solid ${colors.glassBorder}` }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: font.sizes.lg }}>
                    Selected: {DATASET_LABELS[selectedRun.dataset_name] || selectedRun.dataset_name}
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginLeft: '12px' }}>
                    Version {selectedRun.evaluation_version} | Provider: {selectedRun.provider}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Download size={14} /> CSV
                  </Button>
                  <Button variant="secondary" onClick={handleExportJSON} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Download size={14} /> JSON
                  </Button>
                </div>
              </div>

              {/* Failure Analysis and Details tabs */}
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
                
                {/* Left panel: Failure Categories */}
                <Card variant="flat" style={{ padding: '16px', border: `1px solid ${colors.glassBorder}` }}>
                  <h4 style={{ fontSize: font.sizes.lg, fontWeight: 600, marginBottom: '16px', color: colors.textSecondary }}>
                    Failure Categories Breakdown
                  </h4>
                  {failedCount === 0 ? (
                    <div style={{ color: colors.emerald, display: 'flex', alignItems: 'center', gap: '6px', fontSize: font.sizes.md }}>
                      <CheckCircle2 size={16} /> 100% Quality Pass. No failures!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontSize: font.sizes.sm, color: colors.textSecondary }}>
                        Total failures: <span style={{ color: colors.rose, fontWeight: 600 }}>{failedCount} questions</span>
                      </div>
                      {failureRates.map((f) => (
                        <div key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: font.sizes.sm }}>
                            <span>{f.name}</span>
                            <span style={{ fontWeight: 600 }}>{f.count} ({f.pct}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: radius.full, overflow: 'hidden' }}>
                            <div style={{ width: `${f.pct}%`, height: '100%', background: f.pct > 50 ? colors.rose : colors.amber, borderRadius: radius.full }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Right panel: Tabbed questions list or expanded inspection */}
                <Card variant="flat" style={{ padding: '16px', border: `1px solid ${colors.glassBorder}` }}>
                  {selectedQuestion ? (
                    /* Detailed Question Inspection */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '12px' }}>
                        <h4 style={{ fontSize: font.sizes.lg, fontWeight: 600, color: colors.indigoLight }}>Question Inspection</h4>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedQuestion(null)}>Back to list</Button>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: '4px' }}>Question:</div>
                        <div style={{ fontSize: font.sizes.lg, fontWeight: 600, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: radius.md, border: `1px solid ${colors.glassBorder}` }}>
                          {selectedQuestion.question}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: radius.md, textAlign: 'center' }}>
                          <div style={{ fontSize: font.sizes.xs, color: colors.textSecondary }}>Retrieval</div>
                          <div style={{ fontSize: font.sizes.lg, fontWeight: 600, color: colors.blue }}>{selectedQuestion.retrieval_score}%</div>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: radius.md, textAlign: 'center' }}>
                          <div style={{ fontSize: font.sizes.xs, color: colors.textSecondary }}>Grounding</div>
                          <div style={{ fontSize: font.sizes.lg, fontWeight: 600, color: colors.emerald }}>{selectedQuestion.grounding_score}%</div>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: radius.md, textAlign: 'center' }}>
                          <div style={{ fontSize: font.sizes.xs, color: colors.textSecondary }}>Citation</div>
                          <div style={{ fontSize: font.sizes.lg, fontWeight: 600, color: colors.violet }}>{selectedQuestion.citation_score}%</div>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: radius.md, textAlign: 'center' }}>
                          <div style={{ fontSize: font.sizes.xs, color: colors.textSecondary }}>No Hallucination</div>
                          <div style={{ fontSize: font.sizes.lg, fontWeight: 600, color: colors.rose }}>{selectedQuestion.hallucination_score}%</div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: '4px' }}>Expected Answer (Golden):</div>
                          <div style={{ padding: '12px', background: 'rgba(16,185,129,0.03)', border: `1px solid rgba(16,185,129,0.15)`, borderRadius: radius.md, fontSize: font.sizes.md, maxHeight: '200px', overflowY: 'auto' }}>
                            {selectedQuestion.expected_answer || 'No expected answer loaded.'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: '4px' }}>Generated Answer:</div>
                          <div style={{ padding: '12px', background: 'rgba(99,102,241,0.03)', border: `1px solid rgba(99,102,241,0.15)`, borderRadius: radius.md, fontSize: font.sizes.md, maxHeight: '200px', overflowY: 'auto' }}>
                            {selectedQuestion.generated_answer || 'N/A (Heuristic Evaluation Mode)'}
                          </div>
                        </div>
                      </div>

                      {!selectedQuestion.passed && selectedQuestion.failure_reason && (
                        <div style={{
                          padding: '12px',
                          borderRadius: radius.md,
                          background: 'rgba(244,63,94,0.08)',
                          border: `1px solid ${colors.rose}33`,
                          color: colors.rose,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertTriangle size={16} /> Failure Flag: {selectedQuestion.failure_reason} (Overall Score: {((selectedQuestion.retrieval_score + selectedQuestion.grounding_score + selectedQuestion.citation_score + selectedQuestion.hallucination_score) / 4).toFixed(1)}%)
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Questions List */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: font.sizes.lg, fontWeight: 600 }}>Evaluated Questions List</h4>
                        <div style={{ position: 'relative', width: '220px' }}>
                          <input
                            type="text"
                            placeholder="Filter queries..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 12px 6px 30px',
                              background: 'rgba(255,255,255,0.03)',
                              border: `1px solid ${colors.glassBorder}`,
                              borderRadius: radius.md,
                              fontSize: font.sizes.sm,
                              color: colors.textPrimary
                            }}
                          />
                          <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: colors.textMuted }} />
                        </div>
                      </div>

                      {loadingDetails ? (
                        <div style={{ color: colors.textMuted }}>Loading question evaluations...</div>
                      ) : filteredQuestions.length === 0 ? (
                        <div style={{ color: colors.textMuted }}>No matching questions found.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
                          {filteredQuestions.map((q) => {
                            const overall = (q.retrieval_score + q.grounding_score + q.citation_score + q.hallucination_score) / 4
                            return (
                              <div
                                key={q.id}
                                onClick={() => setSelectedQuestion(q)}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: radius.md,
                                  background: 'rgba(255,255,255,0.01)',
                                  border: `1px solid ${colors.glassBorder}`,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: transition.base,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                                  e.currentTarget.style.borderColor = colors.indigo
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)'
                                  e.currentTarget.style.borderColor = colors.glassBorder
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                                  {q.passed ? (
                                    <CheckCircle2 size={16} style={{ color: colors.emerald, flexShrink: 0 }} />
                                  ) : (
                                    <XCircle size={16} style={{ color: colors.rose, flexShrink: 0 }} />
                                  )}
                                  <span style={{ fontSize: font.sizes.md, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginRight: '16px' }}>
                                    {q.question}
                                  </span>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  {q.failure_reason && (
                                    <Badge variant="danger" style={{ fontSize: font.sizes.xs }}>
                                      {q.failure_reason}
                                    </Badge>
                                  )}
                                  <span style={{ fontWeight: 600, fontSize: font.sizes.md, color: q.passed ? colors.emerald : colors.rose }}>
                                    {overall.toFixed(1)}%
                                  </span>
                                  <Eye size={14} style={{ color: colors.textMuted }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          ) : (
            <Card variant="elevated" style={{ padding: '48px', textAlign: 'center', color: colors.textSecondary }}>
              <BookOpen size={48} style={{ color: colors.textMuted, margin: '0 auto 16px' }} />
              <h3>Select a historical run from the sidebar to inspect detailed metrics, or click "Run All" above to trigger a new baseline test.</h3>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

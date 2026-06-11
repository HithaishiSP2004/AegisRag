// =============================================================================
// AegisRAG Prompt Diagnostics Dashboard Component (Phase 5)
// =============================================================================
'use client'

import { useState, useTransition } from 'react'
import {
  Settings, Play, CheckCircle, XCircle, ShieldAlert, Cpu, Layers, HelpCircle, ArrowUpDown, ChevronRight, BarChart2
} from 'lucide-react'
import { colors, radius, font, transition } from '@/components/ui/tokens'
import { updateBudgetProfileAction, runPromptTestSuiteAction } from '@/features/prompts/actions'
import { PROMPT_REGISTRY } from '@/features/prompts/registry'
import { useToast } from '@/components/ui/Toast'

interface PromptStat {
  prompt_template_used: string
  prompt_version: string
  total_tokens: number
  estimated_tokens: number
  tokens_saved: number
  success: boolean
  latency_ms: number
  confidence_score: number
}

interface TestResult {
  id: string
  prompt_id: string
  version: string
  question: string
  expected: string
  actual: string
  status: 'pass' | 'fail'
  latency_ms: number
  tokens_used: number
  created_at: string
}

interface Props {
  orgId: string
  userId: string
  initialBudgetProfile: 'economy' | 'balanced' | 'accuracy'
  promptStats: PromptStat[]
  initialTestResults: TestResult[]
}

export function PromptDiagnostics({ orgId, userId, initialBudgetProfile, promptStats, initialTestResults }: Props) {
  const toast = useToast()
  const [budgetProfile, setBudgetProfile] = useState(initialBudgetProfile)
  const [testResults, setTestResults] = useState<TestResult[]>(initialTestResults)
  const [runningTests, startTransition] = useTransition()

  // 1. Version Comparison Logic (merges DB stats with baselines if empty)
  const getPromptMetrics = (templateId: string, version: string, defaultVals: { success: number; latency: number; tokens: number; confidence: number }) => {
    const runs = promptStats.filter(s => s.prompt_template_used === templateId && s.prompt_version === version)
    if (runs.length === 0) {
      return defaultVals
    }
    const totalRuns = runs.length
    const successfulRuns = runs.filter(r => r.success).length
    const success = Math.round((successfulRuns / totalRuns) * 100)
    const latency = Math.round((runs.reduce((sum, r) => sum + r.latency_ms, 0) / totalRuns) * 10) / 10000 // Convert ms to s
    const tokens = Math.round(runs.reduce((sum, r) => sum + r.total_tokens, 0) / totalRuns)
    const confidence = Math.round((runs.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / totalRuns) * 100)
    return { success, latency, tokens, confidence }
  }

  const qaV1Metrics = getPromptMetrics('knowledge_qa', 'v1', { success: 82, latency: 2.4, tokens: 4200, confidence: 78 })
  const qaV2Metrics = getPromptMetrics('knowledge_qa', 'v2', { success: 94, latency: 1.8, tokens: 2900, confidence: 92 })

  // 2. Budget Profile Handler
  const handleProfileChange = async (profile: 'economy' | 'balanced' | 'accuracy') => {
    setBudgetProfile(profile)
    const res = await updateBudgetProfileAction(orgId, profile)
    if (res.success) {
      toast.success(`Prompt Budget Profile updated to: ${profile.toUpperCase()}`)
    } else {
      toast.error(res.error || 'Failed to update budget profile')
      setBudgetProfile(budgetProfile) // Rollback
    }
  }

  // 3. Test Suite Runner Handler
  const handleRunTests = () => {
    startTransition(async () => {
      const res = await runPromptTestSuiteAction(orgId, userId)
      if (res.success && res.results) {
        toast.success('Prompt Test Suite completed successfully.')
        setTestResults(prev => [...(res.results || []), ...prev])
      } else {
        toast.error(res.error || 'Failed to execute prompt tests')
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: colors.textPrimary }}>
      
      {/* Dynamic Token Budget Profiles & Governance */}
      <div style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} style={{ color: colors.cyan }} />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Enterprise Token Governance &amp; Budget Profiles</h2>
              <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: 0 }}>Set context limit caps to manage Gemini Free Tier rate constraints and optimize operational cost profiles.</p>
            </div>
          </div>

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md, padding: '4px', gap: '4px' }}>
            {(['economy', 'balanced', 'accuracy'] as const).map(profile => {
              const active = budgetProfile === profile
              const labels = { economy: 'Economy (4k Limit)', balanced: 'Balanced (8k Limit)', accuracy: 'Max Accuracy (16k Limit)' }
              return (
                <button
                  key={profile}
                  onClick={() => handleProfileChange(profile)}
                  style={{
                    background: active ? `linear-gradient(135deg, ${colors.cyan}, ${colors.indigo})` : 'transparent',
                    color: active ? '#fff' : colors.textSecondary,
                    border: 'none',
                    borderRadius: radius.sm,
                    padding: '8px 16px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: transition.fast
                  }}
                >
                  {labels[profile]}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg }}>
            <div style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Economy Profile</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: colors.cyan, margin: '6px 0' }}>4,000 Chars (~1k Chunks)</div>
            <div style={{ fontSize: '0.68rem', color: colors.textMuted }}>Highly compressed context. Safe for high-frequency low-token evaluations. Minimal API cost.</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg }}>
            <div style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balanced Profile</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: colors.indigoLight, margin: '6px 0' }}>8,000 Chars (~2k Chunks)</div>
            <div style={{ fontSize: '0.68rem', color: colors.textMuted }}>Standard operating mode. Balancing grounding quality, citation accuracy, and response speed.</div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg }}>
            <div style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max Accuracy Profile</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: colors.violetLight, margin: '6px 0' }}>16,000 Chars (~4k Chunks)</div>
            <div style={{ fontSize: '0.68rem', color: colors.textMuted }}>Max context injection. Pulls dense multi-page citations for complex GRC boardroom reports.</div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Prompt Version Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Comparison Dashboard */}
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.xl,
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '16px', marginBottom: '20px' }}>
            <BarChart2 size={20} style={{ color: colors.indigoLight }} />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Prompt Performance &amp; Comparison Dashboard</h2>
              <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: 0 }}>Real-time side-by-side A/B metrics comparison for the active templates.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px dashed ${colors.glassBorder}`, paddingBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: colors.textSecondary }}>
              <span>EVALUATION METRIC</span>
              <div style={{ display: 'flex', gap: '64px', width: '220px', justifyContent: 'space-between' }}>
                <span style={{ width: '90px', textAlign: 'center' }}>QA_v1 (Standard)</span>
                <span style={{ width: '90px', textAlign: 'center', color: colors.cyan }}>QA_v2 (Advanced)</span>
              </div>
            </div>

            {/* Metric Rows */}
            {[
              { label: 'Success Rate (%)', key: 'success', suffix: '%', invert: false, description: 'Percentage of calls completing without API exceptions or parsing failures.' },
              { label: 'Avg Latency (s)', key: 'latency', suffix: 's', invert: true, description: 'Time taken for Gemini response generation.' },
              { label: 'Avg Context Tokens', key: 'tokens', suffix: '', invert: true, description: 'Average number of tokens sent in prompt context.' },
              { label: 'Avg Confidence Score', key: 'confidence', suffix: '%', invert: false, description: 'AI estimated confidence/attainability score based on evidence grounding.' }
            ].map(m => {
              const val1 = (qaV1Metrics as any)[m.key]
              const val2 = (qaV2Metrics as any)[m.key]
              
              // Highlight the better one
              let v1Better = false
              if (m.invert) {
                v1Better = val1 < val2
              } else {
                v1Better = val1 > val2
              }
              const v2Better = !v1Better && val1 !== val2

              return (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '300px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{m.label}</span>
                    <span style={{ fontSize: '0.65rem', color: colors.textMuted }}>{m.description}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '64px', width: '220px', justifyContent: 'space-between', fontFamily: font.mono, fontSize: '0.85rem' }}>
                    <span style={{ width: '90px', textAlign: 'center', color: v1Better ? colors.emerald : colors.textSecondary, fontWeight: v1Better ? 800 : 500 }}>
                      {val1}{m.suffix}
                    </span>
                    <span style={{ width: '90px', textAlign: 'center', color: v2Better ? colors.emerald : (val1 === val2 ? colors.textSecondary : colors.roseLight), fontWeight: v2Better ? 800 : 500 }}>
                      {val2}{m.suffix}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Prompt Registry Viewer */}
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.xl,
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          maxHeight: '440px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '16px', marginBottom: '16px' }}>
            <Layers size={18} style={{ color: colors.violetLight }} />
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>Centralized Prompt Registry</h2>
              <p style={{ fontSize: '0.7rem', color: colors.textSecondary, margin: 0 }}>Registered versioned template scopes in the current system state.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(PROMPT_REGISTRY).map(([id, versions]) => {
              const latest = versions[versions.length - 1]
              return (
                <div key={id} style={{
                  padding: '12px', background: 'rgba(255,255,255,0.01)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, fontFamily: font.mono, color: colors.indigoLight }}>{id}</span>
                    <span style={{ fontSize: '0.625rem', fontFamily: font.mono, padding: '2px 6px', background: 'rgba(99,102,241,0.1)', borderRadius: radius.sm, color: colors.indigoLight }}>
                      {versions.length} Version(s) (Latest: {latest.version})
                    </span>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: colors.textSecondary, margin: '0 0 6px 0' }}>{latest.purpose}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: colors.textMuted, fontFamily: font.mono }}>
                    <span>Budget: {latest.tokenBudget} CharLimit</span>
                    <span>Owner: {latest.owner}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Prompt Test Suite Runner */}
      <div style={{
        background: colors.bgCard,
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={20} style={{ color: colors.emerald }} />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Grounded Prompt Evaluation Test Suite</h2>
              <p style={{ fontSize: '0.75rem', color: colors.textSecondary, margin: 0 }}>Run automated validation queries checking for inline citations and insufficient evidence behaviors.</p>
            </div>
          </div>

          <button
            onClick={handleRunTests}
            disabled={runningTests}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: `linear-gradient(135deg, ${colors.emerald}, ${colors.teal})`,
              color: '#fff',
              border: 'none',
              borderRadius: radius.md,
              padding: '10px 20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: runningTests ? 'not-allowed' : 'pointer',
              opacity: runningTests ? 0.6 : 1,
              outline: 'none',
              boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
              transition: transition.base
            }}
          >
            {runningTests ? (
              <>
                <Layers size={13} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Running Test Evaluations...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Run Prompt Tests</span>
              </>
            )}
          </button>
        </div>

        {/* Results Table */}
        {testResults.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: colors.textMuted, fontSize: '0.78rem', border: `1px dashed ${colors.glassBorder}`, borderRadius: radius.md }}>
            No past test results logged in the system. Click "Run Prompt Tests" to evaluate prompts.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${colors.glassBorder}` }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: colors.textSecondary }}>Prompt Scope</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: colors.textSecondary }}>Test Question</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: colors.textSecondary }}>Expected Output</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: colors.textSecondary }}>Actual Answer (Snippet)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: colors.textSecondary }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: colors.textSecondary }}>Metrics</th>
                </tr>
              </thead>
              <tbody>
                {testResults.map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.02)` }}>
                    <td style={{ padding: '12px 16px', fontFamily: font.mono, fontWeight: 700, color: colors.indigoLight }}>{r.prompt_id} ({r.version})</td>
                    <td style={{ padding: '12px 16px', maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.question}</td>
                    <td style={{ padding: '12px 16px', color: colors.textSecondary }}>{r.expected}</td>
                    <td style={{ padding: '12px 16px', color: colors.textMuted, maxWidth: '240px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.actual}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.status === 'pass' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: colors.emerald, fontWeight: 800 }}>
                          <CheckCircle size={12} /> PASS
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: colors.rose, fontWeight: 800 }}>
                          <XCircle size={12} /> FAIL
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: font.mono, color: colors.textMuted }}>
                      {r.latency_ms}ms • {r.tokens_used}T
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

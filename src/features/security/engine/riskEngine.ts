// =============================================================================
// Sprint 5B: Risk Engine
// src/features/security/engine/riskEngine.ts
//
// Pure-TypeScript organizational risk score calculator.
// Called by /api/security/risk-score to surface the DB-computed score
// and optionally run a supplementary client-side weighted model.
// =============================================================================

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

export interface RiskInputs {
  open_alerts:         number
  critical_alerts:     number
  unresolved_alerts:   number   // open + acknowledged
  hallucinations:      number
  retrieval_failures:  number
  failed_reviews:      number
  unauthorized_events: number
}

export interface RiskResult {
  score:      number        // 0 – 100
  level:      RiskLevel
  breakdown:  Record<string, number>  // per-signal contribution
  max_signal: string        // dominant contributing factor
}

const WEIGHTS = {
  critical_alerts:     8,
  open_alerts:         4,
  unauthorized_events: 4,
  hallucinations:      3,
  retrieval_failures:  2,
  failed_reviews:      2,
  unresolved_alerts:   2,
} as const

const CAPS: Record<keyof RiskInputs, number> = {
  critical_alerts:     6,
  open_alerts:         6,
  unresolved_alerts:   6,
  unauthorized_events: 5,
  hallucinations:      5,
  retrieval_failures:  5,
  failed_reviews:      5,
}

export function computeRiskScore(inputs: RiskInputs): RiskResult {
  const breakdown: Record<string, number> = {}
  let total = 0

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const raw  = inputs[key as keyof RiskInputs]
    const cap  = CAPS[key as keyof RiskInputs]
    const pts  = Math.min(raw, cap) * weight
    breakdown[key] = pts
    total += pts
  }

  const score = Math.min(100, Math.round(total))
  const level: RiskLevel =
    score >= 76 ? 'critical' :
    score >= 51 ? 'high' :
    score >= 26 ? 'moderate' : 'low'

  const max_signal = Object.entries(breakdown).reduce(
    (max, [k, v]) => (v > max[1] ? [k, v] : max), ['none', 0]
  )[0] as string

  return { score, level, breakdown, max_signal }
}

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return '#F43F5E'
    case 'high':     return '#FB923C'
    case 'moderate': return '#F59E0B'
    case 'low':      return '#10B981'
  }
}

export function riskLevelBg(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'rgba(244,63,94,0.10)'
    case 'high':     return 'rgba(251,146,60,0.10)'
    case 'moderate': return 'rgba(245,158,11,0.10)'
    case 'low':      return 'rgba(16,185,129,0.10)'
  }
}

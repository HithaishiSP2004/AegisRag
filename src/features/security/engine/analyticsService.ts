/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/server'


export interface TrendDataPoint {
  date: string
  value: number
}

// Helper to get date series
function getDateSeries(days: number): string[] {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

// 1. Get Risk Trend
export async function getRiskTrend(orgId: string, days: number): Promise<TrendDataPoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const dates = getDateSeries(days)
  const since = dates[0]

  // Try to query snapshots first
  const { data: snapshots } = await admin
    .from('executive_snapshots')
    .select('snapshot_date, risk_score')
    .eq('org_id', orgId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })

  const snapshotMap = new Map<string, number>()
  snapshots?.forEach((s: any) => {
    snapshotMap.set(s.snapshot_date, Number(s.risk_score))
  })

  // Build the result series, calculating on-the-fly for dates missing from snapshots
  const result: TrendDataPoint[] = []

  for (const date of dates) {
    if (snapshotMap.has(date)) {
      result.push({ date, value: snapshotMap.get(date)! })
    } else {
      // Calculate dynamic risk score for this historical date
      // We will look at events up to that date
      const dateLimit = `${date}T23:59:59.999Z`
      const thirtyDaysPrior = new Date(new Date(date).getTime() - 30 * 86_400_000).toISOString()

      const [
        alertsRes,
        evalsRes,
        eventsRes,
        reviewsRes
      ] = await Promise.all([
        admin
          .from('security_alerts')
          .select('id, severity, status, resolved_at')
          .eq('org_id', orgId)
          .lte('created_at', dateLimit),
        admin
          .from('retrieval_evals')
          .select('id, groundedness_score, hallucination_flag')
          .eq('org_id', orgId)
          .gte('created_at', thirtyDaysPrior)
          .lte('created_at', dateLimit),
        admin
          .from('security_events')
          .select('id, event_type')
          .eq('org_id', orgId)
          .eq('is_demo', false)
          .eq('event_type', 'unauthorized_access')
          .gte('created_at', thirtyDaysPrior)
          .lte('created_at', dateLimit),
        admin
          .from('control_reviews')
          .select('id, status')
          .lte('created_at', dateLimit)
      ])

      const activeAlerts = alertsRes.data?.filter((a: any) => {
        if (a.status === 'resolved' && a.resolved_at && a.resolved_at <= dateLimit) return false
        return true
      }) ?? []

      const openAlerts = activeAlerts.length
      const criticalAlerts = activeAlerts.filter((a: any) => a.severity === 'critical').length
      const hallucinations = evalsRes.data?.filter((e: any) => e.hallucination_flag).length ?? 0
      const retrievalFailures = evalsRes.data?.filter((e: any) => (e.groundedness_score ?? 1) < 0.3).length ?? 0
      const unauthorizedEvents = eventsRes.data?.length ?? 0
      const failedReviews = reviewsRes.data?.filter((r: any) => r.status === 'rejected').length ?? 0

      // Compute weighted risk score (0-100)
      const computedScore = Math.min(100,
        Math.min(openAlerts, 5) * 4 +
        Math.min(criticalAlerts, 4) * 8 +
        Math.min(hallucinations, 5) * 3 +
        Math.min(retrievalFailures, 5) * 2 +
        Math.min(failedReviews, 5) * 2 +
        Math.min(unauthorizedEvents, 5) * 2
      )

      result.push({ date, value: computedScore })

      // Auto-insert snapshot for today to build future cache
      if (date === new Date().toISOString().slice(0, 10)) {
        await admin.from('executive_snapshots').insert({
          org_id: orgId,
          tenant_id: orgId,
          risk_score: computedScore,
          snapshot_date: date
        })
      }
    }
  }

  return result
}

// 2. Get Compliance Trend
export async function getComplianceTrend(orgId: string, days: number): Promise<TrendDataPoint[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const dates = getDateSeries(days)
  const since = dates[0]

  const { data: snapshots } = await admin
    .from('executive_snapshots')
    .select('snapshot_date, compliance_coverage')
    .eq('org_id', orgId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })

  const snapshotMap = new Map<string, number>()
  snapshots?.forEach((s: any) => {
    if (s.compliance_coverage !== null) {
      snapshotMap.set(s.snapshot_date, Number(s.compliance_coverage))
    }
  })

  const result: TrendDataPoint[] = []

  for (const date of dates) {
    if (snapshotMap.has(date)) {
      result.push({ date, value: snapshotMap.get(date)! })
    } else {
      // Calculate dynamic compliance percentage
      // Formula: controls with evidence / total controls
      const dateLimit = `${date}T23:59:59.999Z`
      const [controlsRes, evidenceRes] = await Promise.all([
        admin
          .from('compliance_controls')
          .select('id')
          .lte('created_at', dateLimit),
        admin
          .from('control_evidence')
          .select('control_id')
          .lte('created_at', dateLimit)
      ])

      const totalControls = controlsRes.data?.length ?? 1
      const controlsWithEvidence = new Set(evidenceRes.data?.map((e: any) => e.control_id)).size
      const coverage = totalControls > 0 ? Math.round((controlsWithEvidence / totalControls) * 100) : 0

      result.push({ date, value: coverage })

      if (date === new Date().toISOString().slice(0, 10)) {
        await admin.from('executive_snapshots').update({
          compliance_coverage: coverage
        }).eq('org_id', orgId).eq('snapshot_date', date)
      }
    }
  }

  return result
}

// 3. Get Groundedness Trend
export async function getGroundednessTrend(orgId: string, days: number): Promise<TrendDataPoint[]> {
  const admin = createAdminClient()
  const dates = getDateSeries(days)
  const since = dates[0]

  // Directly aggregate from retrieval_evals table for maximum accuracy
  const { data: evals } = await admin
    .from('retrieval_evals')
    .select('created_at, groundedness_score')
    .eq('org_id', orgId)
    .gte('created_at', `${since}T00:00:00.000Z`)
    .order('created_at', { ascending: true })

  const dateScores = new Map<string, { sum: number; count: number }>()
  evals?.forEach(e => {
    if (e.groundedness_score !== null) {
      const d = e.created_at.slice(0, 10)
      const cur = dateScores.get(d) ?? { sum: 0, count: 0 }
      dateScores.set(d, { sum: cur.sum + Number(e.groundedness_score), count: cur.count + 1 })
    }
  })

  return dates.map(date => {
    const data = dateScores.get(date)
    return {
      date,
      value: data ? Number((data.sum / data.count).toFixed(3)) : 0.850 // baseline default
    }
  })
}

// 4. Get Hallucination Trend
export async function getHallucinationTrend(orgId: string, days: number): Promise<TrendDataPoint[]> {
  const admin = createAdminClient()
  const dates = getDateSeries(days)
  const since = dates[0]

  const { data: evals } = await admin
    .from('retrieval_evals')
    .select('created_at, hallucination_flag')
    .eq('org_id', orgId)
    .gte('created_at', `${since}T00:00:00.000Z`)

  const dateCounts = new Map<string, { total: number; hallucinated: number }>()
  evals?.forEach(e => {
    const d = e.created_at.slice(0, 10)
    const cur = dateCounts.get(d) ?? { total: 0, hallucinated: 0 }
    dateCounts.set(d, {
      total: cur.total + 1,
      hallucinated: cur.hallucinated + (e.hallucination_flag ? 1 : 0)
    })
  })

  return dates.map(date => {
    const data = dateCounts.get(date)
    return {
      date,
      value: data && data.total > 0 ? Number(((data.hallucinated / data.total) * 100).toFixed(1)) : 0.0
    }
  })
}

// 5. Get Governance Trend
export async function getGovernanceTrend(orgId: string, days: number): Promise<TrendDataPoint[]> {
  const admin = createAdminClient()
  const dates = getDateSeries(days)
  const since = dates[0]

  const { data: requests } = await admin
    .from('ai_requests')
    .select('created_at, total_tokens')
    .eq('org_id', orgId)
    .gte('created_at', `${since}T00:00:00.000Z`)

  const dateTokens = new Map<string, number>()
  requests?.forEach(r => {
    const d = r.created_at.slice(0, 10)
    dateTokens.set(d, (dateTokens.get(d) ?? 0) + (r.total_tokens || 0))
  })

  return dates.map(date => ({
    date,
    value: dateTokens.get(date) ?? 0
  }))
}

export async function generateDailySnapshot(orgId: string): Promise<any> {
  const admin = createAdminClient() as any
  const today = new Date().toISOString().slice(0, 10)

  // 1. Fetch risk trend (gets today's value)
  const riskTrend = await getRiskTrend(orgId, 1)
  const riskScore = riskTrend[0]?.value ?? 29

  // 2. Fetch compliance trend
  const compTrend = await getComplianceTrend(orgId, 1)
  const complianceCoverage = compTrend[0]?.value ?? 75

  // 3. Fetch audit readiness components
  const [compRes, reviewRes, alertsRes, evalsRes, evidenceRes] = await Promise.all([
    admin.rpc('get_compliance_stats', { p_org_id: orgId }),
    admin.from('control_reviews').select('id, status'),
    admin.from('security_alerts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'open'),
    admin.from('retrieval_evals').select('groundedness_score, hallucination_flag').eq('org_id', orgId).gte('created_at', `${today}T00:00:00.000Z`),
    admin.from('control_evidence').select('id, status')
  ])

  const compStats = compRes.data?.[0] ?? {}
  const total = compStats.total_controls ?? 1
  const withEvidence = compStats.controls_with_evidence ?? 0
  const coverage = total > 0 ? Math.round((withEvidence / total) * 100) : 0

  const reviews = reviewRes.data ?? []
  const approvedReviews = reviews.filter((r: any) => r.status === 'approved').length
  const totalReviews = reviews.length
  const reviewScore = totalReviews > 0 ? (approvedReviews / totalReviews) * 100 : 75

  // Audit Readiness Formula
  const auditReadiness = Math.round(
    (coverage * 0.40) +
    (reviewScore * 0.30) +
    (90.0 * 0.20) + // Review Freshness baseline
    (95.0 * 0.10)   // Reference Integrity baseline
  )

  // 4. Groundedness and Hallucinations today
  const evals = evalsRes.data ?? []
  const totalEvals = evals.length
  const avgGroundedness = totalEvals > 0 ? (evals.reduce((sum: number, e: any) => sum + (e.groundedness_score ?? 0), 0) / totalEvals) : 0.88
  const hallucinated = evals.filter((e: any) => e.hallucination_flag).length
  const hallucinationRate = totalEvals > 0 ? (hallucinated / totalEvals) * 100 : 1.5

  // 5. Evidence Health (percentage of evidence with 'verified' status or similar)
  const evidences = evidenceRes.data ?? []
  const verifiedEvidence = evidences.filter((e: any) => e.status !== 'rejected').length
  const evidenceHealth = evidences.length > 0 ? Math.round((verifiedEvidence / evidences.length) * 100) : 92

  // Insert or Update today's snapshot
  const snapshotData = {
    org_id: orgId,
    tenant_id: orgId,
    risk_score: riskScore,
    compliance_coverage: complianceCoverage,
    audit_readiness: auditReadiness,
    groundedness: avgGroundedness,
    hallucination_rate: hallucinationRate,
    evidence_health: evidenceHealth,
    security_alerts: alertsRes.count ?? 0,
    snapshot_date: today
  }

  // Check if today's snapshot exists
  const { data: existing } = await admin
    .from('executive_snapshots')
    .select('id')
    .eq('org_id', orgId)
    .eq('snapshot_date', today)
    .limit(1)

  let resultErr
  if (existing && existing.length > 0) {
    const { error } = await admin
      .from('executive_snapshots')
      .update(snapshotData)
      .eq('id', existing[0].id)
    resultErr = error
  } else {
    const { error } = await admin
      .from('executive_snapshots')
      .insert(snapshotData)
    resultErr = error
  }

  if (resultErr) {
    throw new Error(`Failed to write executive snapshot: ${resultErr.message}`)
  }

  return snapshotData
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runEvaluation } from '@/features/evaluation/evaluationRunner'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const datasetName = body.datasetName || 'nist80053'
    const evaluationName = body.evaluationName || `Run - ${new Date().toLocaleDateString()}`

    if (!['nist80053', 'nistcsf20', 'owasp_top10', 'all'].includes(datasetName)) {
      return NextResponse.json({ error: 'Invalid dataset name' }, { status: 400 })
    }

    const runs = []

    if (datasetName === 'all') {
      const targets = ['nist80053', 'nistcsf20', 'owasp_top10']
      for (const target of targets) {
        const result = await runEvaluation(profile.org_id, target, `${evaluationName} - ${target}`)
        runs.push(result)
      }
    } else {
      const result = await runEvaluation(profile.org_id, datasetName, evaluationName)
      runs.push(result)
    }

    return NextResponse.json({ success: true, runs })
  } catch (err: any) {
    console.error('[api/admin/evaluation] Evaluation POST failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const searchParams = req.nextUrl.searchParams
  const runId = searchParams.get('runId')

  try {
    if (runId) {
      // Fetch details of a single run plus its questions
      const { data: run, error: runErr } = await (supabase as any)
        .from('evaluation_runs')
        .select('*')
        .eq('id', runId)
        .eq('org_id', profile.org_id)
        .single()

      if (runErr || !run) {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 })
      }

      const { data: questions, error: qErr } = await (supabase as any)
        .from('rag_evaluations')
        .select('*')
        .eq('run_id', runId)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: true })

      return NextResponse.json({ success: true, run, questions: questions || [] })
    } else {
      // Fetch all historical runs
      const { data: runs, error: runsErr } = await (supabase as any)
        .from('evaluation_runs')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      if (runsErr) throw new Error(runsErr.message)

      return NextResponse.json({ success: true, runs: runs || [] })
    }
  } catch (err: any) {
    console.error('[api/admin/evaluation] Evaluation GET failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: Retrieve a specific workflow and its analysis details (reports, violations, downloads)
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    // 1. Get workflow
    const { data: workflow, error: wfErr } = await supabase
      .from('workflows')
      .select('*, documents(original_name, filename)')
      .eq('id', id)
      .eq('org_id', profile.org_id)
      .single()

    if (wfErr || !workflow) {
      return NextResponse.json({ error: 'Workflow not found or access denied' }, { status: 404 })
    }

    let report = null
    let violations: any[] = []
    let downloads: any[] = []

    // 2. If complete, load report and violations
    if (workflow.status === 'complete') {
      const { data: rRow } = await supabase
        .from('reports')
        .select('*')
        .eq('workflow_id', id)
        .eq('org_id', profile.org_id)
        .single()

      if (rRow) {
        report = rRow
        
        // Fetch violations
        const { data: viols } = await supabase
          .from('violations')
          .select('*')
          .eq('report_id', rRow.id)
          .eq('org_id', profile.org_id)

        violations = viols || []
      }

      // 3. Retrieve signed download records from generated_reports
      const { data: genReports } = await (supabase as any)
        .from('generated_reports')
        .select('*')
        .eq('tenant_id', profile.org_id)
        .eq('status', 'completed')

      if (genReports) {
        downloads = genReports.filter((r: any) => (r.metadata as any)?.workflow_id === id)
      }
    }

    return NextResponse.json({
      workflow,
      report,
      violations,
      downloads
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

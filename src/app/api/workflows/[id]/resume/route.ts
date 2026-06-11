import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { executeComplianceWorkflow } from '@/features/workflows/service'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
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

    // 1. Verify workflow exists, belongs to org, and is in failed status
    const { data: workflow, error: wfErr } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.org_id)
      .single()

    if (wfErr || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (workflow.status !== 'failed') {
      return NextResponse.json({ error: 'Only failed workflows can be resumed' }, { status: 400 })
    }

    // 2. Set status to pending/resuming before launching background execution
    const { error: updateErr } = await supabase
      .from('workflows')
      .update({
        status: 'retrieving',
        progress_pct: 10,
        current_step: 'Resuming workflow execution...',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateErr) {
      return NextResponse.json({ error: `Failed to update status: ${updateErr.message}` }, { status: 500 })
    }

    // 3. Asynchronously trigger execution (resume mode will be active due to metadata)
    executeComplianceWorkflow(id, profile.org_id, user.id, user.email ?? undefined).catch(err => {
      console.error(`[WorkflowsResumeAPI] Background resumption failed for ${id}:`, err)
    })

    return NextResponse.json({ success: true, message: 'Workflow resumption started successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

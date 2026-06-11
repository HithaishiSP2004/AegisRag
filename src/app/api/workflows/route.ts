import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createComplianceWorkflow, executeComplianceWorkflow } from '@/features/workflows/service'

export const dynamic = 'force-dynamic'

// GET: List all workflows in the organization
export async function GET(req: NextRequest) {
  try {
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

    const { data: workflows, error: dbErr } = await supabase
      .from('workflows')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ workflows: workflows || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// POST: Create and initiate a compliance review workflow
export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json()
    const { documentId, frameworks, name, templateId } = body

    if (!documentId || !frameworks || !Array.isArray(frameworks)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    if (frameworks.length > 3) {
      return NextResponse.json({ error: 'Maximum of 3 frameworks can be selected per compliance review' }, { status: 400 })
    }

    // 1. Create workflow row
    const workflow = await createComplianceWorkflow(
      { documentId, frameworks, name, templateId },
      user.id,
      profile.org_id
    )

    // 2. Asynchronously run execution pipeline (non-blocking)
    executeComplianceWorkflow(workflow.id, profile.org_id, user.id, user.email ?? undefined).catch(err => {
      console.error(`[WorkflowsAPI] Background execution failed for ${workflow.id}:`, err)
    })

    return NextResponse.json({ success: true, workflow })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

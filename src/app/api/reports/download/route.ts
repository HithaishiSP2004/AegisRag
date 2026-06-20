import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing report ID' }, { status: 400 })
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

    let storagePath = ''
    let isPredictive = false
    const isPdf = id.endsWith('_pdf')
    const isJson = id.endsWith('_json')
    const workflowId = id.replace('_pdf', '').replace('_json', '')

    if (isPdf) {
      storagePath = `${profile.org_id}/workflows/${workflowId}.pdf`
      isPredictive = true
    } else if (isJson) {
      storagePath = `${profile.org_id}/workflows/${workflowId}.json`
      isPredictive = true
    } else {
      // Get report path from DB, scoped to tenant
      const { data: report, error: dbErr } = await (supabase as any)
        .from('generated_reports')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', profile.org_id)
        .single()

      if (dbErr || !report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      if (report.status !== 'completed' || !report.storage_path) {
        return NextResponse.json({ error: 'Report file is not ready' }, { status: 400 })
      }
      storagePath = report.storage_path
    }

    // Generate signed download URL from reports bucket
    const admin = createAdminClient()
    let { data, error: storageErr } = await admin.storage
      .from('reports')
      .createSignedUrl(storagePath, 3600)

    // Fallback: If predictive URL failed (e.g. legacy workflow runs uploaded to old paths),
    // try to construct the legacy storage path using the workflow's creation date.
    if (isPredictive && (storageErr || !data?.signedUrl)) {
      const { data: workflow } = await supabase
        .from('workflows')
        .select('created_at, completed_at')
        .eq('id', workflowId)
        .single()

      if (workflow) {
        const date = new Date(workflow.completed_at || workflow.created_at)
        const year = date.getFullYear().toString()
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const dateStr = date.toISOString().slice(0, 10)
        const oldPath = isPdf
          ? `${profile.org_id}/${year}/${month}/${workflowId}-pdf-aegisrag-compliance-review-${workflowId}-${dateStr}.pdf`
          : `${profile.org_id}/${year}/${month}/${workflowId}-json-aegisrag-compliance-review-${workflowId}-${dateStr}.json`

        const fallbackResult = await admin.storage
          .from('reports')
          .createSignedUrl(oldPath, 3600)

        if (fallbackResult.data?.signedUrl) {
          data = fallbackResult.data
          storageErr = null
        }
      }
    }

    if (storageErr || !data?.signedUrl) {
      return NextResponse.json({ error: storageErr?.message || 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

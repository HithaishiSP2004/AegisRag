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

    // Generate signed download URL from reports bucket
    const admin = createAdminClient()
    const { data, error: storageErr } = await admin.storage
      .from('reports')
      .createSignedUrl(report.storage_path, 3600)

    if (storageErr || !data?.signedUrl) {
      return NextResponse.json({ error: storageErr?.message || 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

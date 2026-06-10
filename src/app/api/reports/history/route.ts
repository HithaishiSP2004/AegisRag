import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET: List all generated reports for the authenticated user's organization
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

    const { data, error } = await (supabase as any)
      .from('generated_reports')
      .select('*')
      .eq('tenant_id', profile.org_id)
      .order('generated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reports: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

// POST: Save metadata, upload to Supabase storage reports bucket, update row to completed
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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const reportType = formData.get('reportType') as string
    const format = formData.get('format') as string
    const fileName = formData.get('fileName') as string
    const days = formData.get('days') ? Number(formData.get('days')) : 30

    if (!file || !reportType || !format || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. Insert pending report metadata row
    const { data: reportRow, error: insertErr } = await (admin as any)
      .from('generated_reports')
      .insert({
        tenant_id: profile.org_id,
        org_id: profile.org_id,
        report_type: reportType,
        format,
        file_name: fileName,
        generated_by: user.id,
        status: 'pending',
        metadata: {
          range_days: days,
          mime_type: file.type
        }
      })
      .select()
      .single()

    if (insertErr || !reportRow) {
      return NextResponse.json({ error: `Database insert failed: ${insertErr?.message || 'unknown error'}` }, { status: 500 })
    }

    // 2. Upload to Supabase storage reports bucket
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const storagePath = `${profile.org_id}/${year}/${month}/${reportRow.id}-${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await admin.storage
      .from('reports')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadErr) {
      // Update DB row status to failed
      await (admin as any)
        .from('generated_reports')
        .update({
          status: 'failed',
          metadata: {
            ...((reportRow.metadata as Record<string, any>) || {}),
            error: uploadErr.message
          }
        })
        .eq('id', reportRow.id)

      return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // 3. Update report row status to completed, set file_size and storage_path
    const { data: finalRow, error: updateErr } = await (admin as any)
      .from('generated_reports')
      .update({
        status: 'completed',
        storage_path: storagePath,
        file_size: file.size
      })
      .eq('id', reportRow.id)
      .select()
      .single()

    if (updateErr || !finalRow) {
      return NextResponse.json({ error: `Failed to update status to completed: ${updateErr?.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, report: finalRow })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

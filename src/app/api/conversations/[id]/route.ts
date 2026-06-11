// =============================================================================
// Sprint 3A: /api/conversations/[id]
// GET    — fetch one conversation with messages
// PATCH  — rename conversation
// DELETE — delete conversation (cascades messages)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// ── GET: conversation + messages ──────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('id', id)
    .single()

  if (convErr || !conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: msgs } = await supabase
    .from('messages')
    .select('id, role, content, citations, retrieval_mode, created_at, reasoning_metadata')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ conversation: conv, messages: msgs ?? [] })
}

// ── PATCH: rename conversation ────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { title?: string } = {}
  try { body = await req.json() } catch { /* empty */ }

  const title = (body.title ?? '').trim().slice(0, 200)
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', id)
    .select('id, title, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversation: data })
}

// ── DELETE: delete conversation ───────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

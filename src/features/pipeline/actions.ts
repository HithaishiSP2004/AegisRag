'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/features/documents/audit'
import { chunkText, estimateTokens, generateEmbeddings } from './processor'
import { GoogleGenAI } from '@google/genai'
import { revalidatePath } from 'next/cache'

// Allowed roles for page-level CRUD
const ALLOWED_ROLES = ['super_admin', 'compliance_officer']

/**
 * Helper to authenticate user and check role
 */
async function authenticateAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    throw new Error('Not authenticated')
  }

  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    throw new Error('User profile not found')
  }

  if (!ALLOWED_ROLES.includes(profile.role)) {
    throw new Error('Insufficient permissions: admin access required')
  }

  return { user, profile }
}

/**
 * Delete a single page and its associated chunks and embeddings (via cascade).
 */
export async function deletePageAction(
  documentId: string,
  pageNumber: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, profile } = await authenticateAdmin()
    const admin = createAdminClient()

    // 1. Get the page record to confirm existence and fetch page ID
    const { data: page, error: pageErr } = await admin
      .from('pages')
      .select('id')
      .eq('document_id', documentId)
      .eq('page_number', pageNumber)
      .single()

    if (pageErr || !page) {
      return { success: false, error: 'Page not found' }
    }

    // 2. Delete the page (cascades to chunks & embeddings)
    const { error: delErr } = await admin
      .from('pages')
      .delete()
      .eq('id', page.id)

    if (delErr) {
      return { success: false, error: `Failed to delete page: ${delErr.message}` }
    }

    // 3. Decrement document's page_count
    const { data: doc } = await admin
      .from('documents')
      .select('page_count')
      .eq('id', documentId)
      .single()

    if (doc) {
      await admin
        .from('documents')
        .update({ page_count: Math.max(0, doc.page_count - 1) })
        .eq('id', documentId)
    }

    // 4. Log audit event
    await logAuditEvent({
      orgId: profile.org_id,
      userId: user.id,
      action: 'PAGE_DELETED',
      resourceType: 'document',
      resourceId: documentId,
      newValue: { page_number: pageNumber, page_id: page.id }
    })

    revalidatePath('/dashboard/diagnostics')
    revalidatePath('/knowledge-vault')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred' }
  }
}

/**
 * Reprocess a single page: delete its old chunks and regenerate chunk/vector embeddings.
 */
export async function reprocessPageAction(
  documentId: string,
  pageNumber: number
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, profile } = await authenticateAdmin()
    const admin = createAdminClient()

    // 1. Get the page text
    const { data: page, error: pageErr } = await admin
      .from('pages')
      .select('id, raw_text')
      .eq('document_id', documentId)
      .eq('page_number', pageNumber)
      .single()

    if (pageErr || !page) {
      return { success: false, error: 'Page not found' }
    }

    const text = page.raw_text || ''

    // 2. Delete existing chunks (cascades to embeddings)
    await admin
      .from('chunks')
      .delete()
      .eq('page_id', page.id)

    // 3. Chunk text
    const textChunks = chunkText(text)
    if (textChunks.length === 0) {
      await admin
        .from('pages')
        .update({ status: 'chunked' })
        .eq('id', page.id)
      return { success: true, error: null }
    }

    // 4. Create chunk rows
    const chunkRows = textChunks.map((content, i) => ({
      document_id: documentId,
      page_id:     page.id,
      org_id:      profile.org_id,
      chunk_index: pageNumber * 10000 + i,
      content,
      token_count: estimateTokens(content),
      metadata: {
        page_number:          pageNumber,
        document_id:          documentId,
        org_id:               profile.org_id,
        chunk_in_page:        i,
        total_chunks_in_page: textChunks.length,
      }
    }))

    // 5. Insert chunks
    const { data: insertedChunks, error: chunkErr } = await admin
      .from('chunks')
      .insert(chunkRows)
      .select('id, content')

    if (chunkErr || !insertedChunks) {
      throw new Error(`Failed to insert chunks: ${chunkErr?.message}`)
    }

    // 6. Generate embeddings
    // H1 FIX: guard missing API key — skip embeddings rather than crashing
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[reprocessPageAction] GEMINI_API_KEY not set — page marked chunked, embeddings skipped')
      await admin
        .from('pages')
        .update({ status: 'chunked', updated_at: new Date().toISOString() })
        .eq('id', page.id)
      revalidatePath('/dashboard/diagnostics')
      return { success: true, error: null }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const embeddingRows = await generateEmbeddings(
      ai,
      profile.org_id,
      insertedChunks
    )

    // 7. Insert embeddings
    if (embeddingRows.length > 0) {
      const { error: embErr } = await admin.from('embeddings').insert(embeddingRows)
      if (embErr) {
        throw new Error(`Failed to insert embeddings: ${embErr.message}`)
      }
      
      // Update page status to embedded
      await admin
        .from('pages')
        .update({ status: 'embedded', updated_at: new Date().toISOString() })
        .eq('id', page.id)
    } else {
      await admin
        .from('pages')
        .update({ status: 'chunked', updated_at: new Date().toISOString() })
        .eq('id', page.id)
    }

    // 8. Log audit event
    await logAuditEvent({
      orgId: profile.org_id,
      userId: user.id,
      action: 'PAGE_UPDATED',
      resourceType: 'document',
      resourceId: documentId,
      newValue: { page_number: pageNumber, page_id: page.id }
    })

    revalidatePath('/dashboard/diagnostics')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred' }
  }
}

/**
 * Replace a single page's text, clear its old chunks, and re-embed.
 */
export async function replacePageAction(
  documentId: string,
  pageNumber: number,
  newText: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { user, profile } = await authenticateAdmin()
    const admin = createAdminClient()

    // 1. Find or create the page record
    const { data: page } = await admin
      .from('pages')
      .select('id')
      .eq('document_id', documentId)
      .eq('page_number', pageNumber)
      .single()

    let pageId = page?.id

    if (!pageId) {
      // Create new page record
      const { data: newPage, error: pageErr } = await admin
        .from('pages')
        .insert({
          document_id: documentId,
          org_id:      profile.org_id,
          page_number: pageNumber,
          raw_text:    newText,
          word_count:  newText.split(/\s+/).filter(Boolean).length,
          status:      'pending'
        })
        .select('id')
        .single()

      if (pageErr || !newPage) {
        return { success: false, error: `Failed to create page record: ${pageErr?.message}` }
      }
      pageId = newPage.id

      // Increment document page count
      const { data: doc } = await admin
        .from('documents')
        .select('page_count')
        .eq('id', documentId)
        .single()

      if (doc) {
        await admin
          .from('documents')
          .update({ page_count: doc.page_count + 1 })
          .eq('id', documentId)
      }
    } else {
      // Update text on existing page record
      await admin
        .from('pages')
        .update({
          raw_text:    newText,
          word_count:  newText.split(/\s+/).filter(Boolean).length,
          status:      'pending',
          updated_at:  new Date().toISOString()
        })
        .eq('id', pageId)
    }

    // 2. Delete existing chunks (cascades to embeddings)
    await admin
      .from('chunks')
      .delete()
      .eq('page_id', pageId)

    // 3. Chunk new text
    const textChunks = chunkText(newText)
    if (textChunks.length === 0) {
      await admin
        .from('pages')
        .update({ status: 'chunked' })
        .eq('id', pageId)
      return { success: true, error: null }
    }

    // 4. Create chunk rows
    const chunkRows = textChunks.map((content, i) => ({
      document_id: documentId,
      page_id:     pageId,
      org_id:      profile.org_id,
      chunk_index: pageNumber * 10000 + i,
      content,
      token_count: estimateTokens(content),
      metadata: {
        page_number:          pageNumber,
        document_id:          documentId,
        org_id:               profile.org_id,
        chunk_in_page:        i,
        total_chunks_in_page: textChunks.length,
      }
    }))

    // 5. Insert chunks
    const { data: insertedChunks, error: chunkErr } = await admin
      .from('chunks')
      .insert(chunkRows)
      .select('id, content')

    if (chunkErr || !insertedChunks) {
      throw new Error(`Failed to insert chunks: ${chunkErr?.message}`)
    }

    // 6. Generate embeddings
    // H1 FIX: guard missing API key — skip embeddings rather than crashing
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[replacePageAction] GEMINI_API_KEY not set — page marked chunked, embeddings skipped')
      await admin
        .from('pages')
        .update({ status: 'chunked', updated_at: new Date().toISOString() })
        .eq('id', pageId)
      revalidatePath('/dashboard/diagnostics')
      return { success: true, error: null }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const embeddingRows = await generateEmbeddings(
      ai,
      profile.org_id,
      insertedChunks
    )

    // 7. Insert embeddings
    if (embeddingRows.length > 0) {
      const { error: embErr } = await admin.from('embeddings').insert(embeddingRows)
      if (embErr) {
        throw new Error(`Failed to insert embeddings: ${embErr.message}`)
      }
      
      // Update page status to embedded
      await admin
        .from('pages')
        .update({ status: 'embedded', updated_at: new Date().toISOString() })
        .eq('id', pageId)
    } else {
      await admin
        .from('pages')
        .update({ status: 'chunked', updated_at: new Date().toISOString() })
        .eq('id', pageId)
    }

    // 8. Log audit event
    await logAuditEvent({
      orgId: profile.org_id,
      userId: user.id,
      action: 'PAGE_UPDATED',
      resourceType: 'document',
      resourceId: documentId,
      newValue: { page_number: pageNumber, page_id: pageId, replaced: true }
    })

    revalidatePath('/dashboard/diagnostics')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred' }
  }
}

/**
 * Fetch detailed page metadata and chunk counts for a document.
 */
export async function fetchDocumentPagesAction(documentId: string) {
  try {
    await authenticateAdmin()
    const admin = createAdminClient()
    
    // Fetch pages for document
    const { data: pages, error: pageErr } = await admin
      .from('pages')
      .select('id, page_number, word_count, status, error_message, raw_text')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true })

    if (pageErr) throw new Error(pageErr.message)

    // Fetch chunk counts per page
    const { data: chunkCounts, error: chunkErr } = await admin
      .from('chunks')
      .select('page_id')
      .eq('document_id', documentId)

    if (chunkErr) throw new Error(chunkErr.message)

    // Map chunk counts
    const chunkMap = new Map<string, number>()
    chunkCounts?.forEach(c => {
      chunkMap.set(c.page_id, (chunkMap.get(c.page_id) || 0) + 1)
    })

    const result = pages?.map(p => ({
      id: p.id,
      page_number: p.page_number,
      word_count: p.word_count,
      status: p.status,
      error_message: p.error_message,
      raw_text: p.raw_text,
      chunk_count: chunkMap.get(p.id) || 0
    })) || []

    return { success: true, pages: result, error: null }
  } catch (err: any) {
    return { success: false, pages: [], error: err.message || 'Failed to fetch pages' }
  }
}


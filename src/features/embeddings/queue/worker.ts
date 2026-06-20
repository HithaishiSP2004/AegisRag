import { createAdminClient } from '@/lib/supabase/server';
import { queueService } from './queueService';
import { generateEmbeddings } from '@/features/pipeline/processor';

// ── Rate Limit Detection ──────────────────────────────────────────────────────
// Checks if an error is a Gemini quota/rate limit error.
function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status ?? (err as any)?.statusCode;
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.toLowerCase().includes('resource_exhausted') ||
    msg.toLowerCase().includes('rate limit') ||
    msg.toLowerCase().includes('quota')
  );
}

// Extracts a retry delay from a rate limit error.
// Falls back to 60 seconds with ±15 second jitter if not specified.
function extractRetryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry[_ ](?:after|delay)[:\s]+(\d+)/i);
  if (match) return parseInt(match[1], 10) * 1000;
  return 60_000 + Math.floor(Math.random() * 15_000);
}

export class BackgroundWorker {
  private static instance: BackgroundWorker;
  private isProcessing = false;

  static getInstance(): BackgroundWorker {
    if (!this.instance) {
      this.instance = new BackgroundWorker();
    }
    return this.instance;
  }

  /**
   * Triggers the background queue worker loop. Fire-and-forget.
   */
  startWorker(): void {
    if (this.isProcessing) {
      console.log('[embedding-queue] Worker loop is already running.');
      return;
    }
    this.isProcessing = true;
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    const admin = createAdminClient();
    console.log('[embedding-queue] Background worker started checking queue...');

    try {
      while (true) {
        // 1. Lease the next available job atomically via PostgreSQL row locking
        const { data, error } = await (admin as any).rpc('dequeue_next_embedding_job');

        if (error) {
          console.error('[embedding-queue] Database error while dequeuing next job:', error.message);
          break;
        }

        const leasedJob = data?.[0];

        if (!leasedJob) {
          console.log('[embedding-queue] No queued jobs. Worker going idle.');
          break;
        }

        const jobId = leasedJob.job_id;
        const documentId = leasedJob.doc_id;
        const orgId = leasedJob.organization_id;
        const totalChunks = leasedJob.tot_chunks;
        const lastChunkCheckpoint = leasedJob.last_chunk;

        // ── Worker guard: skip jobs for deleted documents ──────────────────────
        // The SQL dequeue function already filters these out, but this is a
        // belt-and-suspenders check at the application layer. If a document was
        // soft-deleted between the dequeue RPC and this point, we abort cleanly
        // without marking the job as failed (it will already be 'cancelled').
        const { data: docCheck } = await admin
          .from('documents')
          .select('status')
          .eq('id', documentId)
          .single();

        if (!docCheck || docCheck.status === 'deleted') {
          console.warn(
            `[embedding-queue] job=${jobId} skipped — document=${documentId} is deleted. Job should already be cancelled.`
          );
          continue;
        }

        console.log(`[embedding-queue] Leased job=${jobId} for document=${documentId}. Resuming from checkpoint=${lastChunkCheckpoint}/${totalChunks}`);

        await this.processJob(jobId, documentId, orgId, totalChunks, lastChunkCheckpoint);
      }
    } catch (err) {
      console.error('[embedding-queue] Critical error in worker processing loop:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(
    jobId: string,
    documentId: string,
    orgId: string,
    totalChunks: number,
    lastChunkCheckpoint: number
  ): Promise<void> {
    const admin = createAdminClient();

    try {
      const chunks: Array<{ id: string; page_id: string; content: string }> = [];
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data: batch, error: chunksErr } = await admin
          .from('chunks')
          .select('id, page_id, content')
          .eq('document_id', documentId)
          .order('chunk_index', { ascending: true })
          .range(offset, offset + limit - 1);

        if (chunksErr) {
          throw new Error(chunksErr.message);
        }
        if (!batch || batch.length === 0) {
          break;
        }
        chunks.push(...batch);
        if (batch.length < limit) {
          break;
        }
        offset += limit;
      }

      if (chunks.length === 0) {
        throw new Error('No chunks found in database for document');
      }

      // 2. Slice starting at the checkpoint (number of chunks already processed)
      const remainingChunks = chunks.slice(lastChunkCheckpoint);
      console.log(`[embedding-queue] job=${jobId} Total chunks=${totalChunks}. Remaining to process=${remainingChunks.length}`);

      const BATCH_SIZE = 50;
      let processedCount = lastChunkCheckpoint;

      // 3. Process remaining chunks in batches of 50
      for (let i = 0; i < remainingChunks.length; i += BATCH_SIZE) {
        const batch = remainingChunks.slice(i, i + BATCH_SIZE);

        console.log(`[embedding-queue] job=${jobId} Generating vectors for batch of ${batch.length} chunks...`);

        // generateEmbeddings will throw if any chunk has a failed or mismatched embedding.
        // If the provider hits a rate limit, it will throw a rate limit error.
        const embeddingRows = await generateEmbeddings(orgId, batch as any);

        if (embeddingRows.length > 0) {
          // ── Count-Validated Bulk Upsert ──────────────────────────────────────
          // Select the upserted IDs to verify that all rows were written.
          const { data: upserted, error: insertErr } = await admin
            .from('embeddings')
            .upsert(embeddingRows, { onConflict: 'chunk_id' })
            .select('id');

          if (insertErr) {
            throw new Error(`Failed to bulk insert/upsert embeddings: ${insertErr.message}`);
          }

          if (!upserted || upserted.length !== embeddingRows.length) {
            throw new Error(
              `[embedding-queue] DB ingestion count mismatch: expected ${embeddingRows.length} rows, upserted ${upserted?.length ?? 0}. Refusing to advance checkpoint.`
            );
          }
        }

        processedCount += batch.length;

        // Save progress to the database checkpoint only after confirmed insert.
        await queueService.updateProgress(jobId, processedCount);
        console.log(`[embedding-queue] job=${jobId} status=processing progress=${processedCount}/${totalChunks}`);
      }

      // 4. Update page statuses to 'embedded' for pages of this document
      const pageIds = [...new Set(chunks.map(c => c.page_id))].filter(Boolean);
      if (pageIds.length > 0) {
        await admin
          .from('pages')
          .update({ status: 'embedded', updated_at: new Date().toISOString() })
          .in('id', pageIds);
      }

      // 5. Update job and document to completed / indexed
      await queueService.completeJob(jobId);
      await admin
        .from('documents')
        .update({
          status: 'indexed',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      // 6. Log success audit event
      await this.auditLog(admin, orgId, 'document.embedding_worker_completed', documentId, {
        job_id: jobId,
        total_chunks: totalChunks
      });

      console.log(`[embedding-queue] job=${jobId} completed successfully!`);

    } catch (err: any) {
      const errMsg = err.message || String(err);

      // ── Rate Limit: Suspend with auto-resume ──────────────────────────────
      if (isRateLimitError(err)) {
        const retryDelayMs = extractRetryDelayMs(err);
        const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();

        console.warn(
          `[embedding-queue] job=${jobId} hit Gemini rate limit. Suspending job. next_retry_at=${nextRetryAt}`
        );

        await queueService.suspendJob(jobId, retryDelayMs, errMsg);
        await admin
          .from('documents')
          .update({
            status: 'waiting_provider',
            error_message: `Provider quota exhausted. Auto-resuming at ${nextRetryAt}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);

        await this.auditLog(admin, orgId, 'document.embedding_worker_suspended', documentId, {
          job_id: jobId,
          error: errMsg,
          retry_delay_ms: retryDelayMs,
        });

        return; // Release worker — do NOT mark as failed
      }

      // ── Non-rate-limit failure ────────────────────────────────────────────
      console.error(`[embedding-queue] job=${jobId} Failed to process:`, errMsg);

      await queueService.failJob(jobId, errMsg);
      await admin
        .from('documents')
        .update({
          status: 'embedding_failed',
          error_message: errMsg,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      await this.auditLog(admin, orgId, 'document.embedding_worker_failed', documentId, {
        job_id: jobId,
        error: errMsg
      });
    }
  }

  private async auditLog(
    admin: any,
    orgId: string,
    action: string,
    resourceId: string,
    newValue: Record<string, unknown>
  ) {
    try {
      await admin.rpc('log_audit_event', {
        p_org_id:        orgId,
        p_user_id:       '00000000-0000-0000-0000-000000000000', // System service ID
        p_action:        action,
        p_resource_type: 'document',
        p_resource_id:   resourceId,
        p_old_value:     null,
        p_new_value:     newValue,
        p_ip_address:    null,
        p_user_agent:    null,
      });
    } catch (e) {
      console.error('[embedding-queue] Audit log failed (non-fatal):', e);
    }
  }
}

export const backgroundWorker = BackgroundWorker.getInstance();

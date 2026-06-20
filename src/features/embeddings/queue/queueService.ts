import { createAdminClient } from '@/lib/supabase/server';
import type { EmbeddingJob, JobStatus } from './types';

export class QueueService {
  private static instance: QueueService;

  static getInstance(): QueueService {
    if (!this.instance) {
      this.instance = new QueueService();
    }
    return this.instance;
  }

  async createJob(documentId: string, orgId: string, totalChunks: number, priority = 100): Promise<string> {
    const admin = createAdminClient();
    try {
      const { data, error } = await (admin as any)
        .from('embedding_jobs')
        .insert({
          document_id: documentId,
          org_id: orgId,
          status: 'queued',
          priority,
          total_chunks: totalChunks,
          processed_chunks: 0,
          last_processed_chunk: 0
        })
        .select('id')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'No data returned');
      }

      return data.id;
    } catch (err) {
      console.error(`[queueService] Failed to create job for document ${documentId}:`, err);
      throw err;
    }
  }

  async updateProgress(jobId: string, processedChunks: number): Promise<void> {
    const admin = createAdminClient();
    try {
      const { error } = await (admin as any)
        .from('embedding_jobs')
        .update({
          processed_chunks: processedChunks,
          last_processed_chunk: processedChunks
        })
        .eq('id', jobId);

      if (error) {
        console.error(`[queueService] Failed to update progress for job ${jobId}:`, error.message);
      }
    } catch (err) {
      console.error(`[queueService] Exception updating progress for job ${jobId}:`, err);
    }
  }

  async completeJob(jobId: string): Promise<void> {
    const admin = createAdminClient();
    try {
      const { error } = await (admin as any)
        .from('embedding_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error(`[queueService] Failed to complete job ${jobId}:`, error.message);
      }
    } catch (err) {
      console.error(`[queueService] Exception completing job ${jobId}:`, err);
    }
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const admin = createAdminClient();
    try {
      const { error } = await (admin as any)
        .from('embedding_jobs')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error(`[queueService] Failed to fail job ${jobId}:`, error.message);
      }
    } catch (err) {
      console.error(`[queueService] Exception failing job ${jobId}:`, err);
    }
  }

  async suspendJob(jobId: string, retryDelayMs: number, errorMessage: string): Promise<void> {
    const admin = createAdminClient();
    const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();
    try {
      const { error } = await (admin as any)
        .from('embedding_jobs')
        .update({
          status: 'waiting_provider',
          error_message: errorMessage,
          next_retry_at: nextRetryAt,
        })
        .eq('id', jobId);

      if (error) {
        console.error(`[queueService] Failed to suspend job ${jobId}:`, error.message);
      } else {
        console.log(`[queueService] Job ${jobId} suspended. next_retry_at=${nextRetryAt}`);
      }
    } catch (err) {
      console.error(`[queueService] Exception suspending job ${jobId}:`, err);
    }
  }

  async getLatestJobForDocument(documentId: string): Promise<EmbeddingJob | null> {
    const admin = createAdminClient();
    try {
      const { data, error } = await (admin as any)
        .from('embedding_jobs')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(`[queueService] Failed to fetch latest job for document ${documentId}:`, error.message);
        return null;
      }

      return data as EmbeddingJob | null;
    } catch (err) {
      console.error(`[queueService] Exception getting latest job for document ${documentId}:`, err);
      return null;
    }
  }
}

export const queueService = QueueService.getInstance();

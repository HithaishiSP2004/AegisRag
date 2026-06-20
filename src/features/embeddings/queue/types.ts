export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'waiting_provider';

export interface EmbeddingJob {
  id: string;
  document_id: string;
  org_id: string;
  status: JobStatus;
  priority: number;
  total_chunks: number;
  processed_chunks: number;
  last_processed_chunk: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  next_retry_at: string | null;
}

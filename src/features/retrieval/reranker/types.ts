import type { SearchResult } from '../types';

export interface RerankerProvider {
  rerank(
    question: string,
    candidates: SearchResult[],
    limit?: number
  ): Promise<SearchResult[]>;
  getProviderName(): string;
  getModelName(): string;
  getHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
}

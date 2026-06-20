import type { SearchResult } from '../types';
import type { RerankerProvider } from './types';

export class BGERerankerProvider implements RerankerProvider {
  private url = process.env.BGE_RERANKER_URL || 'http://localhost:8002/rerank';
  private modelName = process.env.BGE_RERANKER_MODEL_NAME || 'BAAI/bge-reranker-base';
  private timeoutMs = 15000; // 15 seconds timeout

  getProviderName(): string {
    return 'bge';
  }

  getModelName(): string {
    return this.modelName;
  }

  /**
   * Helper to compute sigmoid for normalizing logits to 0-1 range
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  async rerank(
    question: string,
    candidates: SearchResult[],
    limit = 5
  ): Promise<SearchResult[]> {
    if (candidates.length === 0) {
      const emptyResults = [] as SearchResult[];
      Object.defineProperty(emptyResults, 'telemetry', {
        value: {
          preRerankScore: null,
          postRerankScore: null,
          rerankerLift: null
        },
        enumerable: false,
        writable: true
      });
      return emptyResults;
    }
    const targetLimit = Math.max(1, Math.min(candidates.length, limit));

    console.log(`[BGERerankerProvider] Reranking ${candidates.length} candidates using local sidecar...`);
    const passages = candidates.map(c => {
      const docName = c.document?.originalName || c.metadata?.document_title || 'Unknown Document';
      const pageNum = c.metadata?.page_number || '?';
      return `Document Title: ${docName}\nPage: ${pageNum}\n\nChunk:\n${c.content}`;
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: question,
          passages: passages
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Reranker sidecar returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json() as {
        results: { index: number; score: number }[];
        scores: number[];
      };

      if (!data || !Array.isArray(data.results)) {
        throw new Error('Malformed response from reranker sidecar');
      }

      // Map candidates to new scores and return them
      const allRerankedMapped = data.results.map((item) => {
        const candidate = candidates[item.index];
        if (!candidate) {
          throw new Error(`Reranker returned out of bounds index: ${item.index}`);
        }
        // Normalize the score using sigmoid to fit 0.0 - 1.0 range
        const normalizedScore = this.sigmoid(item.score);
        return {
          ...candidate,
          score: normalizedScore
        };
      });

      // Compute preRerankScore: average of initial top-K candidates' cross-encoder scores
      const initialTopK = candidates.slice(0, targetLimit);
      let preSum = 0;
      for (const initialCand of initialTopK) {
        const matched = allRerankedMapped.find(c => c.chunkId === initialCand.chunkId);
        if (matched) {
          preSum += matched.score;
        }
      }
      const preRerankScore = initialTopK.length > 0 ? preSum / initialTopK.length : 0;

      // Compute postRerankScore: average of reranked top-K candidates' cross-encoder scores
      const finalTopK = allRerankedMapped.slice(0, targetLimit);
      const postSum = finalTopK.reduce((acc, c) => acc + c.score, 0);
      const postRerankScore = finalTopK.length > 0 ? postSum / finalTopK.length : 0;

      const rerankerLift = postRerankScore - preRerankScore;

      // Slice to targetLimit for the final return
      const slicedResults = allRerankedMapped.slice(0, targetLimit);
      
      // Attach telemetry property to the array
      Object.defineProperty(slicedResults, 'telemetry', {
        value: {
          preRerankScore,
          postRerankScore,
          rerankerLift
        },
        enumerable: false,
        writable: true
      });

      return slicedResults;
    } catch (error: any) {
      clearTimeout(timeout);
      const isAbort = error.name === 'AbortError';
      const detail = isAbort ? `Request timed out after ${this.timeoutMs / 1000} seconds` : (error.message || String(error));
      console.error(`[BGERerankerProvider] Reranking failed: ${detail}`);
      throw new Error(`BGE reranker request failed: ${detail}`);
    }
  }

  async getHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    const healthUrl = this.url.replace(/\/rerank$/, '/health');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s health check timeout

    try {
      const response = await fetch(healthUrl, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Health endpoint returned status ${response.status}`);
      }

      const data = await response.json() as { status?: string };
      if (data.status !== 'healthy') {
        throw new Error(`Reranker reported status: ${data.status}`);
      }

      return {
        healthy: true,
        latencyMs: Date.now() - startTime
      };
    } catch (error: any) {
      clearTimeout(timeout);
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error.message || String(error)
      };
    }
  }
}

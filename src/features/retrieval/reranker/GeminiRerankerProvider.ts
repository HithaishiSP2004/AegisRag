import { GoogleGenAI } from '@google/genai';
import { AI_MODELS } from '@/config/ai';
import type { SearchResult } from '../types';
import type { RerankerProvider } from './types';

export class GeminiRerankerProvider implements RerankerProvider {
  private isRerankerDegraded = false;
  private degradedTime = 0;
  private rerankInputK = 30;

  getProviderName(): string {
    return 'gemini';
  }

  getModelName(): string {
    return AI_MODELS.GENERATION_FALLBACK_1;
  }

  private isRerankDegraded(): boolean {
    if (this.isRerankerDegraded) {
      if (Date.now() - this.degradedTime > 60000) {
        this.isRerankerDegraded = false;
        return false;
      }
      return true;
    }
    return false;
  }

  private activateDegradedMode(): void {
    console.warn('[GeminiRerankerProvider] degraded mode activated');
    this.isRerankerDegraded = true;
    this.degradedTime = Date.now();
  }

  private withTelemetry(results: SearchResult[]): SearchResult[] {
    Object.defineProperty(results, 'telemetry', {
      value: {
        preRerankScore: null,
        postRerankScore: null,
        rerankerLift: null
      },
      enumerable: false,
      writable: true
    });
    return results;
  }

  async rerank(
    question: string,
    candidates: SearchResult[],
    limit = 5
  ): Promise<SearchResult[]> {
    const topInput = candidates.slice(0, this.rerankInputK);
    const targetTopK = Math.max(1, Math.min(10, limit));

    if (this.isRerankDegraded()) {
      console.warn('[GeminiRerankerProvider] skipping Gemini reranker — reason: degraded mode active');
      return this.withTelemetry(topInput.slice(0, targetTopK));
    }

    if (topInput.length === 0) return this.withTelemetry([]);
    if (topInput.length <= targetTopK) {
      console.log(`[GeminiRerankerProvider] only ${topInput.length} candidates — skipping reranker`);
      return this.withTelemetry(topInput.slice(0, targetTopK));
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn('[GeminiRerankerProvider] GEMINI_API_KEY missing — using fused order fallback');
      return this.withTelemetry(topInput.slice(0, targetTopK));
    }

    const chunkSummaries = topInput
      .map((r, i) => {
        const docName = r.document?.originalName || r.metadata?.document_title || 'Unknown Document';
        const pageNum = r.metadata?.page_number || '?';
        return `ID: ${r.chunkId}\nDocument Title: ${docName}\nPage: ${pageNum}\n\nChunk:\n${r.content.slice(0, 400)}`;
      })
      .join('\n\n---\n\n');

    const prompt = `You are a relevance ranking assistant. Given a user question and a set of document chunks (each with a unique ID), return ONLY the IDs of the ${targetTopK} most relevant chunks for answering the question.

Return a JSON array of exactly ${targetTopK} chunk IDs (strings), ordered from most to least relevant.
If fewer than ${targetTopK} chunks are relevant, return as many as are relevant.
Return ONLY valid JSON — no explanation, no markdown, no code fences.

QUESTION: ${question}

CHUNKS:
${chunkSummaries}

RESPONSE FORMAT: ["chunk_id_1", "chunk_id_2", ...]`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const rerankPromise = ai.models.generateContent({
        model: this.getModelName(),
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 3000)
      );

      const res = await Promise.race([rerankPromise, timeoutPromise]);
      const raw = res.text?.trim() ?? '';

      let ids: unknown = null;
      try {
        ids = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          ids = JSON.parse(jsonMatch[0]);
        }
      }

      if (ids && typeof ids === 'object' && !Array.isArray(ids)) {
        const keys = Object.keys(ids);
        for (const key of keys) {
          const val = (ids as Record<string, unknown>)[key];
          if (Array.isArray(val)) {
            ids = val;
            break;
          }
        }
      }

      if (!ids || !Array.isArray(ids)) {
        console.warn('[GeminiRerankerProvider] response is not an array — using fused order fallback');
        return this.withTelemetry(topInput.slice(0, targetTopK));
      }

      const candidateMap = new Map(topInput.map((r) => [r.chunkId, r]));
      const validIds = (ids as unknown[])
        .filter((id): id is string => typeof id === 'string' && candidateMap.has(id))
        .slice(0, targetTopK);

      if (validIds.length === 0) {
        console.warn('[GeminiRerankerProvider] no valid IDs in response — using fused order fallback');
        return this.withTelemetry(topInput.slice(0, targetTopK));
      }

      return this.withTelemetry(validIds.map((id) => candidateMap.get(id)!));

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const status = err?.status || err?.statusCode;
      const shouldDegrade =
        status === 429 ||
        status === 503 ||
        errMsg.includes('429') ||
        errMsg.includes('503') ||
        errMsg.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
        errMsg.toUpperCase().includes('UNAVAILABLE') ||
        errMsg.includes('TIMEOUT_EXCEEDED');

      if (shouldDegrade) {
        this.activateDegradedMode();
      } else {
        console.error('[GeminiRerankerProvider] Gemini reranker error — using fused order fallback:', err);
      }
      return this.withTelemetry(topInput.slice(0, targetTopK));
    }
  }

  async getHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY env var is missing');
      }
      // Simple health check: verify API key is set and degraded mode is not active
      if (this.isRerankDegraded()) {
        throw new Error('Gemini reranker provider is currently degraded');
      }
      return {
        healthy: true,
        latencyMs: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error.message || String(error)
      };
    }
  }
}

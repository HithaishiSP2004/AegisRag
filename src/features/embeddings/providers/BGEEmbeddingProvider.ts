import type { EmbeddingProvider, ProviderHealth } from '../types';

export class BGEEmbeddingProvider implements EmbeddingProvider {
  private modelName = process.env.BGE_MODEL_NAME || 'BAAI/bge-base-en-v1.5';
  private dimensions = 768;
  private sidecarUrl = process.env.BGE_EMBEDDING_URL || 'http://localhost:8001/embed';
  private timeoutMs = 120000; // 120 seconds timeout

  getProviderName(): string {
    return 'bge';
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Performs deep configuration validation:
   * 1. Verifies sidecarUrl is defined.
   * 2. Requests GET /health from sidecar.
   * 3. Confirms service status is healthy and dimensions are 768.
   */
  async validateConfiguration(): Promise<void> {
    if (!this.sidecarUrl) {
      throw new Error('BGE provider configuration error: BGE_EMBEDDING_URL is not defined');
    }

    const healthUrl = this.sidecarUrl.replace(/\/embed$/, '/health');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s validation timeout

    try {
      const response = await fetch(healthUrl, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Health endpoint returned status ${response.status}`);
      }

      const data = await response.json() as {
        status?: string;
        dimensions?: number;
        device?: string;
      };

      if (data.status !== 'healthy') {
        throw new Error(`Service reported status: ${data.status}`);
      }

      if (data.dimensions !== this.dimensions) {
        throw new Error(`Dimension mismatch: sidecar reported ${data.dimensions}, expected ${this.dimensions}`);
      }
      
      console.log(`[BGEEmbeddingProvider] Configuration validated successfully. Remote device: ${data.device}`);
    } catch (error: any) {
      clearTimeout(timeout);
      const isAbort = error.name === 'AbortError';
      const detail = isAbort ? 'Request timed out after 10 seconds' : (error.message || String(error));
      throw new Error(`BGE sidecar validation failed at ${healthUrl}: ${detail}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    const embedding = results[0];
    if (!embedding) {
      throw new Error('Failed to generate embedding for text');
    }
    return embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];

    const BATCH_SIZE = 100;
    const results: (number[] | null)[] = [];

    console.log(`[BGEEmbeddingProvider] Requesting ${texts.length} embeddings from sidecar in batches of ${BATCH_SIZE}...`);
    const startTime = Date.now();

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(this.sidecarUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ texts: batch }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`BGE sidecar returned error status ${response.status}: ${errorText}`);
        }

        const data = await response.json() as {
          embeddings?: number[][];
          dimensions?: number;
        };

        if (!data || !Array.isArray(data.embeddings)) {
          throw new Error('Malformed response from BGE sidecar: embeddings array is missing or invalid');
        }

        if (data.embeddings.length !== batch.length) {
          throw new Error(`Malformed response: expected ${batch.length} embeddings, got ${data.embeddings.length}`);
        }

        for (let index = 0; index < data.embeddings.length; index++) {
          const embedding = data.embeddings[index];
          if (!embedding || !Array.isArray(embedding)) {
            console.error(`[BGEEmbeddingProvider] Embedding at index ${i + index} is missing or not an array`);
            results.push(null);
          } else if (embedding.length !== this.dimensions) {
            throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${embedding.length} from sidecar`);
          } else {
            results.push(embedding);
          }
        }
      } catch (error: any) {
        clearTimeout(timeout);
        const isAbort = error.name === 'AbortError';
        const detail = isAbort ? `Request timed out after ${this.timeoutMs / 1000} seconds` : (error.message || String(error));
        console.error(`[BGEEmbeddingProvider] Failed to generate embeddings for batch ${Math.floor(i / BATCH_SIZE)}: ${detail}`);
        throw new Error(`BGE sidecar request failed: ${detail}`);
      }
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[BGEEmbeddingProvider] Successfully generated ${texts.length} embeddings in ${latencyMs}ms`);
    return results;
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      await this.validateConfiguration();
      await this.generateEmbedding('health_check');
      const latencyMs = Date.now() - startTime;
      return {
        healthy: true,
        latencyMs,
        provider: this.getProviderName(),
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: 0,
        provider: this.getProviderName(),
        error: err.message || String(err),
      };
    }
  }
}

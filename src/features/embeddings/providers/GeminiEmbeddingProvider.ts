import { GoogleGenAI } from '@google/genai';
import { AI_MODELS } from '@/config/ai';
import type { EmbeddingProvider, ProviderHealth } from '../types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private ai: GoogleGenAI | null = null;
  private modelName = AI_MODELS.EMBEDDING;
  private dimensions = 768;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn('[GeminiEmbeddingProvider] GEMINI_API_KEY environment variable is not set');
    }
  }

  getProviderName(): string {
    return 'gemini';
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.ai) {
      throw new Error('Gemini API key is missing');
    }

    const result = await this.ai.models.embedContent({
      model: this.modelName,
      contents: text,
      config: { outputDimensionality: this.dimensions },
    });

    const values = result.embeddings?.[0]?.values;
    if (!values || values.length === 0) {
      throw new Error('No values returned in embedding');
    }

    return values;
  }

  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.ai) {
      throw new Error('Gemini API key is missing');
    }

    const retries = 5;
    const delay = 1000;
    const BATCH_SIZE = 16;
    const results: (number[] | null)[] = new Array(texts.length).fill(null);

    // Process in batches of 16 as required/established in processor.ts
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batchIndices: number[] = [];
      const batchTexts: string[] = [];

      for (let j = i; j < Math.min(i + BATCH_SIZE, texts.length); j++) {
        batchIndices.push(j);
        batchTexts.push(texts[j]);
      }

      try {
        // Try embedding the batch items concurrently
        const promises = batchTexts.map(async (text, indexInBatch) => {
          const absoluteIndex = batchIndices[indexInBatch];
          for (let attempt = 1; attempt <= retries; attempt++) {
            try {
              const result = await this.ai!.models.embedContent({
                model: this.modelName,
                contents: text,
                config: { outputDimensionality: this.dimensions },
              });
              const values = result.embeddings?.[0]?.values;
              if (!values) {
                throw new Error('No values returned in embedding');
              }
              results[absoluteIndex] = values;
              return;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              const isRateLimit =
                msg.includes('429') ||
                msg.toLowerCase().includes('resource_exhausted') ||
                msg.toLowerCase().includes('rate limit');

              if (isRateLimit && attempt < retries) {
                const backoff = delay * Math.pow(2, attempt - 1) + Math.random() * 500;
                console.warn(
                  `[GeminiEmbeddingProvider] Gemini rate limit hit (429/Resource Exhausted). Retrying chunk in ${Math.round(
                    backoff
                  )}ms (attempt ${attempt}/${retries})...`
                );
                await sleep(backoff);
              } else {
                throw err;
              }
            }
          }
          throw new Error('Retries exhausted');
        });

        await Promise.all(promises);
      } catch (batchErr: unknown) {
        const batchMsg = batchErr instanceof Error ? batchErr.message : String(batchErr);
        console.warn(
          `[GeminiEmbeddingProvider] Batch embedding failed, falling back to individual chunk processing. Error: ${batchMsg}`
        )

        // Fallback: process chunks in this batch individually
        for (const index of batchIndices) {
          try {
            const text = texts[index];
            let values: number[] | null = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const result = await this.ai!.models.embedContent({
                  model: this.modelName,
                  contents: text,
                  config: { outputDimensionality: this.dimensions },
                });
                const vals = result.embeddings?.[0]?.values;
                if (!vals) {
                  throw new Error('No values returned in embedding');
                }
                values = vals;
                break;
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                const isRateLimit =
                  msg.includes('429') ||
                  msg.toLowerCase().includes('resource_exhausted') ||
                  msg.toLowerCase().includes('rate limit');

                if (isRateLimit && attempt < 3) {
                  const backoff = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500;
                  console.warn(
                    `[GeminiEmbeddingProvider] Gemini rate limit hit during fallback retry in ${Math.round(
                      backoff
                    )}ms (attempt ${attempt}/3)...`
                  );
                  await sleep(backoff);
                } else {
                  throw err;
                }
              }
            }

            if (values) {
              results[index] = values;
            } else {
              throw new Error('Failed to generate embedding individually');
            }
          } catch (individualErr: unknown) {
            const individualMsg =
              individualErr instanceof Error ? individualErr.message : String(individualErr);
            console.error(
              `[GeminiEmbeddingProvider] Fallback embedding failed for index ${index}: ${individualMsg}`
            );
          }
        }
      }
    }

    return results;
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      if (!this.ai) {
        return {
          healthy: false,
          latencyMs: 0,
          provider: this.getProviderName(),
          error: 'Gemini API key is missing or not set',
        };
      }
      // Generate a small mock embedding to test health
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

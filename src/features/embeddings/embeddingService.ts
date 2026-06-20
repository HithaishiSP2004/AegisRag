import { providerFactory } from './providerFactory';
import { normalizeText, computeSHA256 } from './cache/contentHash';
import { cacheService } from './cache/cacheService';
import type { CacheEntry } from './cache/cacheService';
import { GeminiEmbeddingProvider } from './providers/GeminiEmbeddingProvider';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private provider = providerFactory.getProvider();
  
  // Track statistics for ingestion telemetry
  private hits = 0;
  private misses = 0;

  static getInstance(): EmbeddingService {
    if (!this.instance) {
      this.instance = new EmbeddingService();
    }
    return this.instance;
  }

  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }

  incrementHits() {
    this.hits++;
  }

  incrementMisses() {
    this.misses++;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? Math.round((this.hits / total) * 100) : 0;
    return { hits: this.hits, misses: this.misses, hitRate };
  }

  getProviderName(): string {
    return this.provider.getProviderName();
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  getDimensions(): number {
    return this.provider.getDimensions();
  }

  validateConfiguration(): void {
    this.provider.validateConfiguration();
  }

  async getHealth() {
    return this.provider.getHealth();
  }

  async generateEmbedding(text: string, options?: { bypassCache?: boolean }): Promise<number[]> {
    const providerName = this.provider.getProviderName();
    const modelName = this.provider.getModelName();
    const expectedDimensions = this.provider.getDimensions();
    const version = '2026-06';

    try {
      if (options?.bypassCache) {
        console.log(`[embedding-cache] BYPASS`);
        let embedding: number[];
        let actualProvider = providerName;
        let actualModel = modelName;
        let actualDimensions = expectedDimensions;

        try {
          embedding = await this.provider.generateEmbedding(text);
        } catch (err: any) {
          if (providerName === 'bge') {
            console.warn('[embedding-fallback] BGE failed');
            console.warn('[embedding-fallback] Gemini fallback activated');
            try {
              const fallbackProvider = new GeminiEmbeddingProvider();
              fallbackProvider.validateConfiguration();
              embedding = await fallbackProvider.generateEmbedding(text);
              actualProvider = fallbackProvider.getProviderName();
              actualModel = fallbackProvider.getModelName();
              actualDimensions = fallbackProvider.getDimensions();
              console.log('[embedding-fallback] batch processed successfully');
            } catch (fallbackErr: any) {
              console.error('[embedding-fallback] Gemini fallback failed:', fallbackErr);
              throw err;
            }
          } else {
            throw err;
          }
        }

        if (embedding.length !== actualDimensions) {
          throw new Error(`Dimension mismatch: expected ${actualDimensions}, got ${embedding.length}`);
        }
        return embedding;
      }

      const normalized = normalizeText(text);
      const hash = computeSHA256(normalized);

      // 1. Check cache first
      const cached = await cacheService.getCachedEmbedding(hash, providerName, modelName);
      if (cached) {
        if (cached.length === expectedDimensions) {
          console.log(`[embedding-cache] HIT hash=${hash}`);
          this.incrementHits();
          void cacheService.updateAccessStats(hash);
          return cached;
        } else {
          console.warn(`[embedding-cache] DIMENSION_MISMATCH hash=${hash} expected=${expectedDimensions} actual=${cached.length}`);
        }
      }

      console.log(`[embedding-cache] MISS hash=${hash}`);
      this.incrementMisses();

      // 2. Generate if cache miss
      let embedding: number[];
      let actualProvider = providerName;
      let actualModel = modelName;
      let actualDimensions = expectedDimensions;

      try {
        embedding = await this.provider.generateEmbedding(text);
      } catch (err: any) {
        if (providerName === 'bge') {
          console.warn('[embedding-fallback] BGE failed');
          console.warn('[embedding-fallback] Gemini fallback activated');
          try {
            const fallbackProvider = new GeminiEmbeddingProvider();
            fallbackProvider.validateConfiguration();
            embedding = await fallbackProvider.generateEmbedding(text);
            actualProvider = fallbackProvider.getProviderName();
            actualModel = fallbackProvider.getModelName();
            actualDimensions = fallbackProvider.getDimensions();
            console.log('[embedding-fallback] batch processed successfully');
          } catch (fallbackErr: any) {
            console.error('[embedding-fallback] Gemini fallback failed:', fallbackErr);
            throw err;
          }
        } else {
          throw err;
        }
      }
      
      // 3. Validate dimensions
      if (embedding.length !== actualDimensions) {
        console.error(`[embedding-error]\nprovider=${actualProvider}\nexpected=${actualDimensions}\nactual=${embedding.length}`);
        throw new Error(`Dimension mismatch: expected ${actualDimensions}, got ${embedding.length}`);
      }

      // 4. Save to cache
      await cacheService.storeEmbedding(hash, embedding, actualProvider, actualModel, actualDimensions, version);
      console.log(`[embedding-cache] STORED hash=${hash}`);

      console.log(`[embedding-provider] provider=${actualProvider} dimensions=${embedding.length} text_length=${text.length}`);
      return embedding;
    } catch (err: any) {
      const reason = err.message || String(err);
      console.error(`[embedding-error]\nprovider=${providerName}\nexpected=${expectedDimensions}\nactual=${reason}`);
      throw err;
    }
  }

  async generateEmbeddings(texts: string[], options?: { bypassCache?: boolean }): Promise<(number[] | null)[]> {
    const providerName = this.provider.getProviderName();
    const modelName = this.provider.getModelName();
    const expectedDimensions = this.provider.getDimensions();
    const version = '2026-06';

    try {
      if (options?.bypassCache) {
        console.log(`[embedding-cache] BYPASS`);
        let generated: (number[] | null)[];
        let actualProvider = providerName;
        let actualModel = modelName;
        let actualDimensions = expectedDimensions;

        try {
          generated = await this.provider.generateEmbeddings(texts);
        } catch (err: any) {
          if (providerName === 'bge') {
            console.warn('[embedding-fallback] BGE failed');
            console.warn('[embedding-fallback] Gemini fallback activated');
            try {
              const fallbackProvider = new GeminiEmbeddingProvider();
              fallbackProvider.validateConfiguration();
              generated = await fallbackProvider.generateEmbeddings(texts);
              actualProvider = fallbackProvider.getProviderName();
              actualModel = fallbackProvider.getModelName();
              actualDimensions = fallbackProvider.getDimensions();
              console.log('[embedding-fallback] batch processed successfully');
            } catch (fallbackErr: any) {
              console.error('[embedding-fallback] Gemini fallback failed:', fallbackErr);
              throw err;
            }
          } else {
            throw err;
          }
        }

        for (let i = 0; i < generated.length; i++) {
          const emb = generated[i];
          if (emb && emb.length !== actualDimensions) {
            throw new Error(`Dimension mismatch at index ${i}: expected ${actualDimensions}, got ${emb.length}`);
          }
        }
        return generated;
      }

      const results: (number[] | null)[] = new Array(texts.length).fill(null);
      const hashes = texts.map(t => computeSHA256(normalizeText(t)));

      // 1. Bulk check cache
      const cachedMap = await cacheService.getCachedEmbeddings(hashes, providerName, modelName);

      const missIndices: number[] = [];
      const missTexts: string[] = [];
      const missHashes: string[] = [];

      for (let i = 0; i < texts.length; i++) {
        const hash = hashes[i];
        const cached = cachedMap.get(hash);
        if (cached) {
          if (cached.length === expectedDimensions) {
            console.log(`[embedding-cache] HIT hash=${hash}`);
            this.incrementHits();
            void cacheService.updateAccessStats(hash);
            results[i] = cached;
          } else {
            console.warn(`[embedding-cache] DIMENSION_MISMATCH hash=${hash} expected=${expectedDimensions} actual=${cached.length}`);
            this.incrementMisses();
            missIndices.push(i);
            missTexts.push(texts[i]);
            missHashes.push(hash);
          }
        } else {
          console.log(`[embedding-cache] MISS hash=${hash}`);
          this.incrementMisses();
          missIndices.push(i);
          missTexts.push(texts[i]);
          missHashes.push(hash);
        }
      }

      // 2. Generate for cache misses
      if (missTexts.length > 0) {
        let generated: (number[] | null)[];
        let actualProvider = providerName;
        let actualModel = modelName;
        let actualDimensions = expectedDimensions;

        try {
          generated = await this.provider.generateEmbeddings(missTexts);
        } catch (err: any) {
          if (providerName === 'bge') {
            console.warn('[embedding-fallback] BGE failed');
            console.warn('[embedding-fallback] Gemini fallback activated');
            try {
              const fallbackProvider = new GeminiEmbeddingProvider();
              fallbackProvider.validateConfiguration();
              generated = await fallbackProvider.generateEmbeddings(missTexts);
              actualProvider = fallbackProvider.getProviderName();
              actualModel = fallbackProvider.getModelName();
              actualDimensions = fallbackProvider.getDimensions();
              console.log('[embedding-fallback] batch processed successfully');
            } catch (fallbackErr: any) {
              console.error('[embedding-fallback] Gemini fallback failed:', fallbackErr);
              throw err;
            }
          } else {
            throw err;
          }
        }

        const entriesToStore: CacheEntry[] = [];

        for (let j = 0; j < missTexts.length; j++) {
          const originalIndex = missIndices[j];
          const emb = generated[j];
          const hash = missHashes[j];

          if (emb) {
            if (emb.length !== actualDimensions) {
              console.error(`[embedding-error]\nprovider=${actualProvider}\nexpected=${actualDimensions}\nactual=${emb.length}`);
              throw new Error(`Dimension mismatch at index ${originalIndex}: expected ${actualDimensions}, got ${emb.length}`);
            }
            results[originalIndex] = emb;

            entriesToStore.push({
              content_hash: hash,
              provider: actualProvider,
              model_name: actualModel,
              embedding_dimensions: actualDimensions,
              provider_version: version,
              embedding: emb
            });
            console.log(`[embedding-cache] STORED hash=${hash}`);
          }
        }

        // Bulk store misses
        if (entriesToStore.length > 0) {
          await cacheService.storeEmbeddings(entriesToStore);
        }
      }

      const totalLength = texts.reduce((sum, t) => sum + t.length, 0);
      console.log(`[embedding-provider] provider=${providerName} dimensions=${expectedDimensions} text_length=${totalLength}`);
      return results;
    } catch (err: any) {
      const reason = err.message || String(err);
      console.error(`[embedding-error]\nprovider=${providerName}\nexpected=${expectedDimensions}\nactual=${reason}`);
      throw err;
    }
  }
}

export const embeddingService = EmbeddingService.getInstance();

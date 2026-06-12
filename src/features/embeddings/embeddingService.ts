import { providerFactory } from './providerFactory';
import { NoOpCache } from './cache/NoOpCache';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private provider = providerFactory.getProvider();
  private cache = new NoOpCache();

  static getInstance(): EmbeddingService {
    if (!this.instance) {
      this.instance = new EmbeddingService();
    }
    return this.instance;
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

  async getHealth() {
    return this.provider.getHealth();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const providerName = this.provider.getProviderName();
    const expectedDimensions = this.provider.getDimensions();

    try {
      // 1. Check cache first
      const cached = await this.cache.get(text);
      if (cached) {
        if (cached.length === expectedDimensions) {
          return cached;
        }
      }

      // 2. Generate if cache miss
      const embedding = await this.provider.generateEmbedding(text);
      
      // 3. Validate dimensions
      if (embedding.length !== expectedDimensions) {
        console.error(`[embedding-error]\nprovider=${providerName}\nexpected=${expectedDimensions}\nactual=${embedding.length}`);
        throw new Error(`Dimension mismatch: expected ${expectedDimensions}, got ${embedding.length}`);
      }

      // 4. Save to cache
      await this.cache.set(text, embedding);

      console.log(`[embedding-provider] provider=${providerName} dimensions=${embedding.length} text_length=${text.length}`);
      return embedding;
    } catch (err: any) {
      const reason = err.message || String(err);
      console.error(`[embedding-error]\nprovider=${providerName}\nexpected=${expectedDimensions}\nactual=${reason}`);
      throw err;
    }
  }

  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    const providerName = this.provider.getProviderName();
    const expectedDimensions = this.provider.getDimensions();

    try {
      // 1. Resolve cache hits and misses
      const results: (number[] | null)[] = new Array(texts.length).fill(null);
      const missIndices: number[] = [];
      const missTexts: string[] = [];

      for (let i = 0; i < texts.length; i++) {
        const cached = await this.cache.get(texts[i]);
        if (cached && cached.length === expectedDimensions) {
          results[i] = cached;
        } else {
          missIndices.push(i);
          missTexts.push(texts[i]);
        }
      }

      // 2. Generate for cache misses
      if (missTexts.length > 0) {
        const generated = await this.provider.generateEmbeddings(missTexts);

        for (let j = 0; j < missTexts.length; j++) {
          const originalIndex = missIndices[j];
          const emb = generated[j];

          if (emb) {
            // Validate dimensions
            if (emb.length !== expectedDimensions) {
              console.error(`[embedding-error]\nprovider=${providerName}\nexpected=${expectedDimensions}\nactual=${emb.length}`);
              throw new Error(`Dimension mismatch at index ${originalIndex}: expected ${expectedDimensions}, got ${emb.length}`);
            }
            results[originalIndex] = emb;
            await this.cache.set(missTexts[j], emb);
          }
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

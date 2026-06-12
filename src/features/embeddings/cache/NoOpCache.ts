import type { EmbeddingCache } from './types';

export class NoOpCache implements EmbeddingCache {
  async get(text: string): Promise<number[] | null> {
    return null;
  }

  async set(text: string, vector: number[]): Promise<void> {
    // No-op
  }
}

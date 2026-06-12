export interface EmbeddingCache {
  get(text: string): Promise<number[] | null>;
  set(text: string, vector: number[]): Promise<void>;
}

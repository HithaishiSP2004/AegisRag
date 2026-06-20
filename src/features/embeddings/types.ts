export interface ProviderHealth {
  healthy: boolean;
  latencyMs: number;
  provider: string;
  error?: string;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<(number[] | null)[]>;
  getProviderName(): string;
  getModelName(): string;
  getDimensions(): number;
  getHealth(): Promise<ProviderHealth>;
  validateConfiguration(): void;
}

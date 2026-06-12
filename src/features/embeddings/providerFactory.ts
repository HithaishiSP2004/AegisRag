import { GeminiEmbeddingProvider } from './providers/GeminiEmbeddingProvider';
import type { EmbeddingProvider } from './types';

export class ProviderFactory {
  private static instance: ProviderFactory;
  private provider: EmbeddingProvider;

  private constructor() {
    const providerEnv = process.env.EMBEDDING_PROVIDER || 'gemini';
    switch (providerEnv.toLowerCase()) {
      case 'gemini':
        this.provider = new GeminiEmbeddingProvider();
        break;
      default:
        throw new Error(`Unsupported embedding provider: ${providerEnv}`);
    }
  }

  static getInstance(): ProviderFactory {
    if (!this.instance) {
      this.instance = new ProviderFactory();
    }
    return this.instance;
  }

  getProvider(): EmbeddingProvider {
    return this.provider;
  }
}

export const providerFactory = ProviderFactory.getInstance();

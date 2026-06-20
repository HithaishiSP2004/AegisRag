import type { RerankerProvider } from './types';
import { BGERerankerProvider } from './BGERerankerProvider';
import { GeminiRerankerProvider } from './GeminiRerankerProvider';

export class RerankerProviderFactory {
  private static instance: RerankerProviderFactory;
  private provider: RerankerProvider;
  private fallbackProvider: RerankerProvider;

  private constructor() {
    const providerType = (process.env.RERANKER_PROVIDER || 'gemini').toLowerCase();
    
    console.log(`[RerankerProviderFactory] Initializing with type: ${providerType}`);
    
    this.fallbackProvider = new GeminiRerankerProvider();

    if (providerType === 'bge') {
      this.provider = new BGERerankerProvider();
    } else {
      // Default fallback is Gemini
      this.provider = this.fallbackProvider;
    }
  }

  static getInstance(): RerankerProviderFactory {
    if (!this.instance) {
      this.instance = new RerankerProviderFactory();
    }
    return this.instance;
  }

  getProvider(): RerankerProvider {
    return this.provider;
  }

  getFallbackProvider(): RerankerProvider {
    return this.fallbackProvider;
  }
}

export const rerankerProviderFactory = RerankerProviderFactory.getInstance();

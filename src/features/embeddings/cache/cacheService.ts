import { createAdminClient } from '@/lib/supabase/server';

export interface CacheEntry {
  content_hash: string;
  provider: string;
  model_name: string;
  embedding_dimensions: number;
  provider_version: string;
  embedding: number[];
}

export class CacheService {
  private static instance: CacheService;

  static getInstance(): CacheService {
    if (!this.instance) {
      this.instance = new CacheService();
    }
    return this.instance;
  }

  async getCachedEmbedding(hash: string, provider: string, modelName: string): Promise<number[] | null> {
    const admin = createAdminClient();
    try {
      const { data, error } = await (admin as any)
        .from('embedding_cache')
        .select('embedding')
        .eq('content_hash', hash)
        .eq('provider', provider)
        .eq('model_name', modelName)
        .maybeSingle();

      if (error) {
        console.error(`[cacheService] Error fetching cached embedding for ${hash}:`, error.message);
        return null;
      }

      if (data) {
        let vector = (data as any).embedding;
        if (typeof vector === 'string') {
          vector = JSON.parse(vector);
        }
        return vector;
      }
    } catch (err) {
      console.error(`[cacheService] Failed to get cached embedding for ${hash}:`, err);
    }
    return null;
  }

  async getCachedEmbeddings(hashes: string[], provider: string, modelName: string): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    if (hashes.length === 0) return map;

    const admin = createAdminClient();
    try {
      const { data, error } = await (admin as any)
        .from('embedding_cache')
        .select('content_hash, embedding')
        .in('content_hash', hashes)
        .eq('provider', provider)
        .eq('model_name', modelName);

      if (error) {
        console.error('[cacheService] Error bulk fetching cached embeddings:', error.message);
        return map;
      }

      if (data) {
        for (const row of data) {
          let vector = (row as any).embedding;
          if (typeof vector === 'string') {
            vector = JSON.parse(vector);
          }
          map.set(row.content_hash, vector);
        }
      }
    } catch (err) {
      console.error('[cacheService] Failed to bulk get cached embeddings:', err);
    }
    return map;
  }

  async storeEmbedding(
    hash: string,
    embedding: number[],
    provider: string,
    modelName: string,
    dimensions: number,
    version: string
  ): Promise<void> {
    const admin = createAdminClient();
    try {
      const { error } = await (admin as any).from('embedding_cache').upsert(
        {
          content_hash: hash,
          provider,
          model_name: modelName,
          embedding_dimensions: dimensions,
          provider_version: version,
          embedding,
          last_accessed_at: new Date().toISOString(),
          hit_count: 0
        },
        { onConflict: 'content_hash,provider,model_name' }
      );

      if (error) {
        console.error(`[cacheService] Error storing embedding for ${hash}:`, error.message);
      }
    } catch (err) {
      console.error(`[cacheService] Failed to store embedding for ${hash}:`, err);
    }
  }

  async storeEmbeddings(entries: CacheEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const admin = createAdminClient();
    const BATCH_SIZE = 100;
    
    try {
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const rows = batch.map(entry => ({
          content_hash: entry.content_hash,
          provider: entry.provider,
          model_name: entry.model_name,
          embedding_dimensions: entry.embedding_dimensions,
          provider_version: entry.provider_version,
          embedding: entry.embedding,
          last_accessed_at: new Date().toISOString(),
          hit_count: 0
        }));

        const { error } = await (admin as any)
          .from('embedding_cache')
          .upsert(rows, { onConflict: 'content_hash,provider,model_name' });

        if (error) {
          console.error(`[cacheService] Error bulk storing embeddings for batch ${Math.floor(i / BATCH_SIZE)}:`, error.message);
        }
      }
    } catch (err) {
      console.error('[cacheService] Failed to bulk store embeddings:', err);
    }
  }

  async updateAccessStats(hash: string): Promise<void> {
    const admin = createAdminClient();
    void (async () => {
      try {
        const { data } = await (admin as any)
          .from('embedding_cache')
          .select('hit_count')
          .eq('content_hash', hash)
          .maybeSingle();

        const currentCount = (data as any)?.hit_count ?? 0;
        await (admin as any)
          .from('embedding_cache')
          .update({
            hit_count: currentCount + 1,
            last_accessed_at: new Date().toISOString()
          })
          .eq('content_hash', hash);
      } catch (err) {
        console.warn(`[cacheService] Failed to update access stats for ${hash}:`, err);
      }
    })();
  }
}

export const cacheService = CacheService.getInstance();

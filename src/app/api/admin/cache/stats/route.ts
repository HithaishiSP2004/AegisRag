import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { embeddingService } from '@/features/embeddings/embeddingService';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const;

export async function GET() {
  // 1. Authenticate user and verify admin roles
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  }

  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // 2. Fetch cache stats from PostgreSQL using the service-role admin client
  const admin = createAdminClient();
  try {
    const { data, error } = await (admin as any).rpc('get_cache_stats');

    if (error) {
      console.error('[api/admin/cache/stats] RPC error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = data?.[0] || { total_entries: 0, total_hits: 0 };
    const totalEntries = Number(row.total_entries || 0);
    const hits = Number(row.total_hits || 0);
    
    // Calculate cumulative hit rate
    const totalRequests = totalEntries + hits;
    const rawHitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
    const hitRate = Math.round(rawHitRate * 10) / 10; // 1 decimal place

    const provider = embeddingService.getProviderName();
    const model = embeddingService.getModelName();
    const dimensions = embeddingService.getDimensions();

    return NextResponse.json({
      provider,
      model,
      dimensions,
      cache_entries: totalEntries,
      cache_hit_rate: hitRate,
      // Keep old fields for backward compatibility
      total_entries: totalEntries,
      hits,
      hit_rate: hitRate
    });
  } catch (err: any) {
    console.error('[api/admin/cache/stats] Failed to fetch cache stats:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

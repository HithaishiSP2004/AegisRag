import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

  try {
    const health = await embeddingService.getHealth();
    let configured = true;
    try {
      embeddingService.validateConfiguration();
    } catch {
      configured = false;
    }

    return NextResponse.json({
      provider: embeddingService.getProviderName(),
      model: embeddingService.getModelName(),
      dimensions: embeddingService.getDimensions(),
      configured,
      healthy: health.healthy,
      latency_ms: health.latencyMs
    });
  } catch (err: any) {
    console.error('[api/admin/embeddings/health] Health check failed:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

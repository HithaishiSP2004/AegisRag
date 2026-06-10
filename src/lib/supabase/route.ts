// =============================================================================
// Supabase client for API Route Handlers (Next.js App Router)
// API routes use NextRequest/NextResponse, not next/headers cookies.
// This is a separate factory from server.ts which uses next/headers.
// =============================================================================

import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Create a Supabase client scoped to an API route handler.
 * Reads/writes cookies via NextRequest/NextResponse.
 */
export function createRouteClient(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}

/**
 * Service-role client for API routes — bypasses RLS.
 * NEVER expose this client or the service key to the browser.
 */
export function createRouteAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    }
  )
}

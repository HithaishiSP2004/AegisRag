import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie mutation ignored (middleware handles session refresh)
          }
        },
      },
    }
  )
}

// Service role client — bypasses RLS unconditionally.
//
// Uses the plain @supabase/supabase-js client (NOT @supabase/ssr).
// Reason: createServerClient from @supabase/ssr reads the request cookie store
// and forwards the active user JWT as a Bearer token in every PostgREST request,
// even when the service-role key is supplied. PostgREST then runs the session as
// role=authenticated and evaluates RLS — defeating the entire purpose.
//
// The plain client sends ONLY the service-role key. PostgREST runs the session
// as role=service_role, which bypasses RLS entirely.
//
// ⚠️  NEVER expose to the browser. NEVER import in client components.
// ⚠️  The service-role key has FULL database access with NO RLS restrictions.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  )
}

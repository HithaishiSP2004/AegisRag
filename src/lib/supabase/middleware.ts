import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ROUTES } from '@/config/constants'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — MUST call getUser() to keep session alive
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public paths that don't require auth
  const publicPaths = [ROUTES.HOME, ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.AUTH_CALLBACK]
  const isPublicPath = publicPaths.some((p) => pathname === p || pathname.startsWith(p))

  // Protected: redirect to login if no session
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = ROUTES.LOGIN
    return NextResponse.redirect(url)
  }

  // Authenticated: redirect away from auth pages
  if (user && (pathname === ROUTES.LOGIN || pathname === ROUTES.SIGNUP)) {
    const url = request.nextUrl.clone()
    url.pathname = ROUTES.COMMAND_HUB
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

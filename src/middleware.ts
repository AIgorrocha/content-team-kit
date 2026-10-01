import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase not configured: block in production, allow in dev
  if (!supabaseUrl || !supabaseKey) {
    if (process.env.NODE_ENV === 'production') {
      const { pathname } = request.nextUrl
      if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/health') || pathname.startsWith('/api/public') || pathname.startsWith('/api/cron') || pathname.startsWith('/api/publish') || pathname.startsWith('/api/sala/eventos/ingest') || pathname.startsWith('/login') || pathname.startsWith('/_next')) {
        return supabaseResponse
      }
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (
    !user &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/api/auth') &&
    !pathname.startsWith('/api/public') &&
    !pathname.startsWith('/api/health') &&
    !pathname.startsWith('/api/webhook') &&
    !pathname.startsWith('/api/cron') &&
    !pathname.startsWith('/api/publish') &&
    !pathname.startsWith('/api/sala/eventos/ingest') &&
    !pathname.startsWith('/_next')
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

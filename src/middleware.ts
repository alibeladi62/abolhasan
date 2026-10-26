import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'abol_session';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // `/login?logout=1` باید از مسیر Node برود تا نشست دیتابیس هم بسته شود
  if (pathname === '/login' && searchParams.get('logout') === '1') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/logout';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // بررسی نقش (admin/operator) در layout پنل انجام می‌شود؛ آنجا به دیتابیس دسترسی داریم.
  // middleware روی Edge runtime است و node:sqlite نمی‌تواند استفاده کند.
  if (pathname.startsWith('/admin') && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};

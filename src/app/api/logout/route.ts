import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, endSession } from '@/server/auth';

// نشست هم در دیتابیس و هم در کوکی پاک می‌شود؛ پاسخ با redirect به صفحه ورود.
export async function GET(request: NextRequest) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await endSession(token);

  const url = new URL('/login', request.nextUrl.origin);
  url.searchParams.set('logged_out', '1');
  return NextResponse.redirect(url);
}

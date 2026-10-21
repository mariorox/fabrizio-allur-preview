import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, AUTH_MAX_AGE, sitePassword, tokenFor } from '@/lib/site-auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const attempt = typeof body?.password === 'string' ? body.password : '';
  const password = sitePassword();

  if (!password || attempt !== password) {
    // atraso curto para desencorajar tentativa em massa
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await tokenFor(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}

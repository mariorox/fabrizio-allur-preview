import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, sitePassword, tokenFor } from '@/lib/site-auth';

const PUBLIC_PATHS = ['/entrar', '/api/entrar'];

export async function proxy(request: NextRequest) {
  const password = sitePassword();
  if (!password) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await tokenFor(password))) return NextResponse.next();

  // API: responde 401 em vez de redirecionar (fetch do cliente)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/entrar';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Assets estáticos ficam livres (a tela de senha usa o fundo/ícones)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|ateliers/|garments/|hero-alfaiataria.jpg).*)'],
};

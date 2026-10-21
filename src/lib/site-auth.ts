/**
 * Senha única de acesso ao sistema (sem usuário).
 *
 * Setup:
 *   SITE_PASSWORD=...   ← sem ela o sistema fica aberto (ex.: dev local)
 *
 * O cookie guarda um hash da senha, nunca a senha. Trocar a senha no
 * servidor invalida todos os acessos já liberados.
 */
export const AUTH_COOKIE = 'pv_acesso';
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export function sitePassword(): string {
  return process.env.SITE_PASSWORD ?? '';
}

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`virtual-preview:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Só aceita caminhos internos — evita redirecionar para outro site. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

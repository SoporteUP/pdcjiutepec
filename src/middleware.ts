import { defineMiddleware } from 'astro:middleware';

const COOKIE_NAME = 'pdc_admin';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals, redirect } = context;

  if (!url.pathname.startsWith('/admin')) {
    return next();
  }

  if (url.pathname === '/admin/login' || url.pathname === '/api/admin-login') {
    return next();
  }

  const env = locals.runtime.env;
  const expected = await hashPassword(env.ADMIN_PASSWORD);
  const token = cookies.get(COOKIE_NAME)?.value;

  if (token !== expected) {
    return redirect('/admin/login');
  }

  return next();
});

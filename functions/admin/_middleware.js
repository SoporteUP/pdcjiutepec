import { ADMIN_COOKIE_NAME, getCookie, hashPassword } from '../_utils/auth.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);

  if (url.pathname === '/admin/login') {
    return next();
  }

  const expected = await hashPassword(env.ADMIN_PASSWORD);
  const token = getCookie(request, ADMIN_COOKIE_NAME);

  if (token !== expected) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/admin/login' },
    });
  }

  return next();
}

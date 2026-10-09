import { ADMIN_COOKIE_NAME, getCookie, hashPassword } from '../_utils/auth.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);

  if (url.pathname === '/admin/login') {
    return next();
  }

  const expected = await hashPassword(env.ADMIN_PASSWORD);
  const token = getCookie(request, ADMIN_COOKIE_NAME);

  if (token !== expected) {
    const destino = url.pathname.startsWith('/admin/api/') ? '' : `?next=${encodeURIComponent(url.pathname)}`;
    return new Response(null, {
      status: 303,
      headers: { Location: `/admin/login${destino}` },
    });
  }

  // Las acciones que modifican datos solo se aceptan desde nuestro propio sitio.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origen = request.headers.get('Origin');
    if (origen && new URL(origen).host !== url.host) {
      return new Response('Origen no permitido', { status: 403 });
    }
  }

  return next();
}

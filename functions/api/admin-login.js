import { ADMIN_COOKIE_NAME, hashPassword } from '../_utils/auth.js';

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const password = String(form.get('password') || '');

  if (password && password === env.ADMIN_PASSWORD) {
    const token = await hashPassword(env.ADMIN_PASSWORD);
    return new Response(null, {
      status: 303,
      headers: {
        Location: '/admin/contactos',
        'Set-Cookie': `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
      },
    });
  }

  return new Response(null, {
    status: 303,
    headers: { Location: '/admin/login?error=1' },
  });
}

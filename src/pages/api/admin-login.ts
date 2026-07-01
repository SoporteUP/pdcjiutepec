import type { APIRoute } from 'astro';
import { hashPassword } from '../../middleware';

export const prerender = false;

const COOKIE_NAME = 'pdc_admin';

export const POST: APIRoute = async ({ request, locals, cookies, redirect }) => {
  const env = locals.runtime.env;
  const form = await request.formData();
  const password = String(form.get('password') || '');

  if (password && password === env.ADMIN_PASSWORD) {
    const token = await hashPassword(env.ADMIN_PASSWORD);
    cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return redirect('/admin/contactos');
  }

  return redirect('/admin/login?error=1');
};

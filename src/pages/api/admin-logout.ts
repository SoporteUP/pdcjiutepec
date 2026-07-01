import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('pdc_admin', { path: '/' });
  return redirect('/admin/login');
};

import { ADMIN_COOKIE_NAME } from '../_utils/auth.js';

export async function onRequestPost() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin/login',
      'Set-Cookie': `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

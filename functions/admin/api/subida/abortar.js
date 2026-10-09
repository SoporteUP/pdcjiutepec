import { CLAVE_VALIDA, json } from '../../../_utils/sermones.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false }, 400);
  }
  const { key, uploadId } = body ?? {};
  if (!CLAVE_VALIDA.test(key ?? '') || !uploadId) return json({ ok: false }, 400);

  try {
    await env.AUDIOS.resumeMultipartUpload(key, uploadId).abort();
  } catch {
    // ya estaba cancelada o terminada: no hay nada más que hacer
  }
  return json({ ok: true });
}

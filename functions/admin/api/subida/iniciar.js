import { json, leerDatos, slug } from '../../../_utils/sermones.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }

  const datos = leerDatos(body);
  if (datos.error) return json({ ok: false, error: datos.error }, 400);

  // Nombre de archivo único: AAAA-MM-DD-titulo.mp3 (con -2, -3... si ya existe).
  const base = `${datos.fecha}-${slug(datos.titulo) || 'audio'}`;
  let key = null;
  for (let n = 1; n <= 30 && !key; n++) {
    const candidato = n === 1 ? `${base}.mp3` : `${base}-${n}.mp3`;
    const enBase = await env.DB.prepare('SELECT 1 FROM sermones WHERE archivo = ?1')
      .bind(candidato)
      .first();
    if (!enBase && !(await env.AUDIOS.head(candidato))) key = candidato;
  }
  if (!key) return json({ ok: false, error: 'No se pudo generar un nombre de archivo único.' }, 409);

  const subida = await env.AUDIOS.createMultipartUpload(key, {
    httpMetadata: { contentType: 'audio/mpeg' },
  });

  return json({ ok: true, key, uploadId: subida.uploadId });
}

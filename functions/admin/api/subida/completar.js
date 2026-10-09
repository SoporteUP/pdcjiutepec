import { CLAVE_VALIDA, json, leerDatos } from '../../../_utils/sermones.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }

  const { key, uploadId, parts } = body ?? {};
  const datos = leerDatos(body);
  if (datos.error) return json({ ok: false, error: datos.error }, 400);

  const partesOk =
    Array.isArray(parts) &&
    parts.length > 0 &&
    parts.every((p) => Number.isInteger(p?.partNumber) && typeof p?.etag === 'string');
  if (!CLAVE_VALIDA.test(key ?? '') || !uploadId || !partesOk) {
    return json({ ok: false, error: 'Parámetros inválidos.' }, 400);
  }

  try {
    const subida = env.AUDIOS.resumeMultipartUpload(key, uploadId);
    await subida.complete(parts);
  } catch {
    return json({ ok: false, error: 'No se pudo terminar de guardar el audio.' }, 500);
  }

  try {
    const r = await env.DB.prepare(
      'INSERT INTO sermones (titulo, fecha, descripcion, archivo) VALUES (?1, ?2, ?3, ?4)'
    )
      .bind(datos.titulo, datos.fecha, datos.descripcion || null, key)
      .run();
    return json({ ok: true, id: r.meta.last_row_id, archivo: key });
  } catch {
    await env.AUDIOS.delete(key); // no dejar un audio huérfano si falla el registro
    return json({ ok: false, error: 'El audio se subió pero no se pudo registrar.' }, 500);
  }
}

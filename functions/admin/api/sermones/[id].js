import { json, leerDatos } from '../../../_utils/sermones.js';

export async function onRequestPatch({ request, env, params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: 'Id inválido.' }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }
  const datos = leerDatos(body);
  if (datos.error) return json({ ok: false, error: datos.error }, 400);

  const r = await env.DB.prepare(
    'UPDATE sermones SET titulo = ?1, fecha = ?2, descripcion = ?3 WHERE id = ?4'
  )
    .bind(datos.titulo, datos.fecha, datos.descripcion || null, id)
    .run();

  if (!r.meta.changes) return json({ ok: false, error: 'No existe ese audio.' }, 404);
  return json({ ok: true });
}

export async function onRequestDelete({ env, params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: 'Id inválido.' }, 400);

  const fila = await env.DB.prepare('SELECT archivo FROM sermones WHERE id = ?1').bind(id).first();
  if (!fila) return json({ ok: false, error: 'No existe ese audio.' }, 404);

  await env.AUDIOS.delete(fila.archivo);
  await env.DB.prepare('DELETE FROM sermones WHERE id = ?1').bind(id).run();
  return json({ ok: true });
}

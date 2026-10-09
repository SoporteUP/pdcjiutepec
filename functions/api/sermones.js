import { json } from '../_utils/sermones.js';

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, titulo, fecha, descripcion, archivo, version FROM sermones ORDER BY fecha DESC, id DESC'
    ).all();
    return json(results);
  } catch {
    // La tabla aún no existe (falta aplicar la migración): la página muestra "próximamente".
    return json([]);
  }
}

import { CATEGORIAS, json } from '../_utils/sermones.js';

// GET /api/sermones            -> todos
// GET /api/sermones?categoria= -> solo 'predicacion' o 'alabanza'
export async function onRequestGet({ request, env }) {
  const categoria = new URL(request.url).searchParams.get('categoria');
  const filtrar = CATEGORIAS.includes(categoria);

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, titulo, fecha, descripcion, archivo, version, categoria FROM sermones ${
        filtrar ? 'WHERE categoria = ?1' : ''
      } ORDER BY fecha DESC, id DESC`
    )
      .bind(...(filtrar ? [categoria] : []))
      .all();
    return json(results);
  } catch {
    // Aún no se aplicó la migración de categorías: todo cuenta como predicación.
    try {
      const { results } = await env.DB.prepare(
        'SELECT id, titulo, fecha, descripcion, archivo, version FROM sermones ORDER BY fecha DESC, id DESC'
      ).all();
      const todos = results.map((r) => ({ ...r, categoria: 'predicacion' }));
      return json(filtrar ? todos.filter((r) => r.categoria === categoria) : todos);
    } catch {
      // La tabla tampoco existe: la página muestra "próximamente".
      return json([]);
    }
  }
}

export const CLAVE_VALIDA = /^[a-z0-9][a-z0-9._-]{0,120}\.mp3$/;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function limpiarTexto(valor, max) {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

export function fechaValida(f) {
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const d = new Date(`${f}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

export function slug(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

export function leerDatos(body) {
  const titulo = limpiarTexto(body?.titulo, 120);
  const fecha = typeof body?.fecha === 'string' ? body.fecha : '';
  const descripcion = limpiarTexto(body?.descripcion, 500);
  if (!titulo) return { error: 'El título es obligatorio.' };
  if (!fechaValida(fecha)) return { error: 'La fecha no es válida.' };
  return { titulo, fecha, descripcion };
}

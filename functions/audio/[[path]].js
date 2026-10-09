// Sirve los audios guardados en R2 (bucket pdc-audios, binding AUDIOS).
// Soporta Range para que el reproductor pueda adelantar/retroceder sin
// descargar todo el archivo.

const TIPOS = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
};

export async function onRequestGet({ request, env, params }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const ext = key?.split('.').pop()?.toLowerCase();

  if (!key || key.includes('..') || !TIPOS[ext]) {
    return new Response('No encontrado', { status: 404 });
  }

  const range = parseRange(request.headers.get('Range'));
  const objeto = await env.AUDIOS.get(key, range ? { range } : undefined);

  if (!objeto) {
    return new Response('No encontrado', { status: 404 });
  }

  const headers = new Headers({
    'Content-Type': TIPOS[ext],
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    ETag: objeto.httpEtag,
  });

  if (range && objeto.range) {
    const { offset, length } = objeto.range;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${objeto.size}`);
    headers.set('Content-Length', String(length));
    return new Response(objeto.body, { status: 206, headers });
  }

  headers.set('Content-Length', String(objeto.size));
  return new Response(objeto.body, { status: 200, headers });
}

function parseRange(header) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null;

  if (m[1] === '') return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  if (m[2] === '') return { offset };
  const fin = Number(m[2]);
  if (fin < offset) return null;
  return { offset, length: fin - offset + 1 };
}

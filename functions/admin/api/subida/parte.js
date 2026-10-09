import { CLAVE_VALIDA, json } from '../../../_utils/sermones.js';

const MAX_PARTE = 50 * 1024 * 1024;

export async function onRequestPut({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  const uploadId = url.searchParams.get('uploadId') ?? '';
  const n = Number(url.searchParams.get('n'));

  if (!CLAVE_VALIDA.test(key) || !uploadId || !Number.isInteger(n) || n < 1 || n > 10000) {
    return json({ ok: false, error: 'Parámetros inválidos.' }, 400);
  }

  const datos = await request.arrayBuffer();
  if (datos.byteLength === 0 || datos.byteLength > MAX_PARTE) {
    return json({ ok: false, error: 'Tamaño de parte inválido.' }, 400);
  }

  try {
    const subida = env.AUDIOS.resumeMultipartUpload(key, uploadId);
    const parte = await subida.uploadPart(n, datos);
    return json({ ok: true, partNumber: parte.partNumber, etag: parte.etag });
  } catch {
    return json({ ok: false, error: 'No se pudo guardar la parte.' }, 500);
  }
}

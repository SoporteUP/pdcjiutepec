export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }

  // Honeypot anti-spam: campo oculto que solo un bot llenaría.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true });
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 200) : '';
  const celular = typeof body.celular === 'string' ? body.celular.trim().slice(0, 30) : '';
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim().slice(0, 2000) : '';
  const interes = typeof body.interes === 'string' ? body.interes.trim().slice(0, 200) : '';

  if (!nombre || !celular) {
    return json({ ok: false, error: 'Nombre y celular son obligatorios.' }, 400);
  }

  await env.DB.prepare(
    'INSERT INTO contactos (nombre, celular, mensaje, interes) VALUES (?1, ?2, ?3, ?4)'
  )
    .bind(nombre, celular, mensaje || null, interes || null)
    .run();

  await enviarCorreoNotificacion(env, { nombre, celular, mensaje, interes });

  return json({ ok: true });
}

async function enviarCorreoNotificacion(env, datos) {
  if (!env.RESEND_API_KEY) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Puerta del Cielo <notificaciones@pdcjiutepec.org>',
        to: 'dancalvillo@hotmail.com',
        subject: `Nuevo contacto: ${datos.nombre}`,
        text: `Nombre: ${datos.nombre}\nCelular: ${datos.celular}\nInterés: ${datos.interes || '(sin especificar)'}\nMensaje: ${datos.mensaje || '(sin mensaje)'}`,
      }),
    });
  } catch {
    // El registro ya se guardó en D1; si el correo falla no se pierde el dato.
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, nombre, celular, mensaje, interes, creado_en FROM contactos ORDER BY id DESC'
  ).all();

  const rows = results.length
    ? results
        .map(
          (c) => `
        <div class="card">
          <div class="card-top">
            <h2>${escapeHtml(c.nombre)}</h2>
            <span class="date">${escapeHtml(c.creado_en)}</span>
          </div>
          <p class="celular">${escapeHtml(c.celular)}</p>
          ${c.interes ? `<p class="interes">${escapeHtml(c.interes)}</p>` : ''}
          ${c.mensaje ? `<p class="mensaje">${escapeHtml(c.mensaje)}</p>` : ''}
        </div>`
        )
        .join('')
    : '<p class="empty">Todavía no hay contactos registrados.</p>';

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>Contactos | Puerta del Cielo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0a0f; color: #fff; font-family: 'Inter', sans-serif;
    padding: 48px 24px; }
  .wrap { max-width: 900px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; flex-wrap: wrap; gap: 16px; }
  h1 { font-family: 'Anton', sans-serif; text-transform: uppercase; font-size: 32px; margin: 0; }
  button { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7);
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 18px;
    border-radius: 999px; cursor: pointer; font-family: inherit; }
  button:hover { border-color: #e879f9; color: #e879f9; }
  .card { background: #13131a; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 20px; margin-bottom: 16px; }
  .card-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .card-top h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .date { font-size: 12px; color: rgba(255,255,255,0.4); }
  .celular { font-size: 14px; color: #22d3ee; margin: 0 0 8px; }
  .interes { font-size: 12px; color: #e879f9; text-transform: uppercase; letter-spacing: 0.03em; margin: 0 0 8px; }
  .mensaje { font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.6; margin: 0; }
  .empty { color: rgba(255,255,255,0.4); font-size: 14px; font-style: italic; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Contactos Recibidos</h1>
      <form method="POST" action="/api/admin-logout">
        <button type="submit">Cerrar sesión</button>
      </form>
    </div>
    ${rows}
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

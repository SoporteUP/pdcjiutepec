export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const showError = url.searchParams.get('error') === '1';

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>Admin | Puerta del Cielo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0a0a0f; color: #fff; font-family: 'Inter', sans-serif; padding: 24px; }
  form { background: #13131a; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 32px; width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 20px; }
  h1 { font-family: 'Anton', sans-serif; text-transform: uppercase; text-align: center; margin: 0 0 8px; font-size: 24px; }
  label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 12px 16px; font-size: 14px; color: #fff; font-family: inherit; }
  input:focus { outline: none; border-color: #22d3ee; }
  button { background: linear-gradient(to right, #e879f9, #a855f7); font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; font-size: 14px; padding: 14px 32px; border-radius: 999px; border: none;
    color: #fff; cursor: pointer; font-family: inherit; }
  button:hover { transform: scale(1.05); }
  .error { color: #e879f9; font-size: 14px; text-align: center; margin: 0; }
</style>
</head>
<body>
  <form method="POST" action="/api/admin-login">
    <h1>Acceso Admin</h1>
    ${showError ? '<p class="error">Contraseña incorrecta.</p>' : ''}
    <div>
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" required>
    </div>
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

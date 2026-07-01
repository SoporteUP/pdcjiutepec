CREATE TABLE IF NOT EXISTS contactos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  celular TEXT NOT NULL,
  mensaje TEXT,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

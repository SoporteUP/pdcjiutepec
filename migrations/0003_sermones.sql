CREATE TABLE IF NOT EXISTS sermones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  fecha TEXT NOT NULL,
  descripcion TEXT,
  archivo TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audio que ya estaba publicado antes de existir el panel.
INSERT OR IGNORE INTO sermones (titulo, fecha, descripcion, archivo, version)
VALUES (
  'Servicio del domingo',
  '2026-10-04',
  'Reunión general del domingo 4 de octubre de 2026.',
  'servicio-2026-10-04.mp3',
  2
);

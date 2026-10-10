-- Separa las predicaciones de la alabanza. Lo que ya existía queda como predicación.
ALTER TABLE sermones ADD COLUMN categoria TEXT NOT NULL DEFAULT 'predicacion';

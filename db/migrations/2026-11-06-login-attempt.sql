-- Freno de fuerza bruta en el formulario de acceso.
-- Correr en Turso ANTES de desplegar, o al menos el mismo día:
-- el código deja pasar si la tabla no existe, así que no rompe nada,
-- pero mientras tanto no hay freno.
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  "key"         text    PRIMARY KEY NOT NULL,
  "failures"    integer NOT NULL DEFAULT 0,
  "windowStart" text    NOT NULL,
  "lockedUntil" text
);

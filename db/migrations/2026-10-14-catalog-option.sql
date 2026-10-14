-- ============================================================
-- CatalogOption: materiales y tipos de joya editables desde el admin
-- ============================================================
-- En este proyecto `astro db push` no se usa: el esquema de produccion se
-- aplica a mano en el editor SQL de Turso. Corre este archivo COMPLETO una
-- sola vez contra la base de produccion.
--
-- Es aditivo: crea una tabla nueva y no toca ninguna existente.
-- ============================================================

CREATE TABLE IF NOT EXISTS "CatalogOption" (
  "id"        text PRIMARY KEY,
  "kind"      text    NOT NULL,              -- 'material' | 'jewelryType'
  "name"      text    NOT NULL,
  "swatch"    text,                          -- color de muestra (solo materiales)
  "sortOrder" integer NOT NULL DEFAULT 0,
  "isActive"  integer NOT NULL DEFAULT 1,
  "createdAt" text    NOT NULL DEFAULT '2026-10-14T00:00:00.000Z'
);

-- Un mismo nombre no puede repetirse dentro del mismo tipo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_kind_name
  ON "CatalogOption"("kind", "name");

-- Lecturas: siempre se filtra por kind + isActive y se ordena por sortOrder.
CREATE INDEX IF NOT EXISTS idx_catalog_kind_active
  ON "CatalogOption"("kind", "isActive", "sortOrder");

-- ------------------------------------------------------------
-- Materiales (alimentan Product.category)
-- Es la UNION de las tres listas que estaban quemadas en el codigo.
-- Los "Oro 10k cadenas/anillos/arracadas" venian de validCategories y no
-- existian en ningun select: se incluyen para no dejar huerfano ningun
-- producto que ya los use. Si no se usan, se desactivan desde el admin.
-- ------------------------------------------------------------
INSERT OR IGNORE INTO "CatalogOption" ("id","kind","name","swatch","sortOrder","isActive","createdAt") VALUES
  ('mat-titanio',          'material','Titanio',           '#b9bec6',                                        10,1,'2026-10-14T00:00:00.000Z'),
  ('mat-acero-quirurgico', 'material','Acero Quirúrgico',  '#c6ccd4',                                        20,1,'2026-10-14T00:00:00.000Z'),
  ('mat-acero-inoxidable', 'material','Acero Inoxidable',  '#bcc2ca',                                        30,1,'2026-10-14T00:00:00.000Z'),
  ('mat-plata',            'material','Plata',             '#d2d7dc',                                        40,1,'2026-10-14T00:00:00.000Z'),
  ('mat-plata-925',        'material','Plata .925',        '#dce1e6',                                        50,1,'2026-10-14T00:00:00.000Z'),
  ('mat-rodio',            'material','Rodio',             '#e2e6ea',                                        60,1,'2026-10-14T00:00:00.000Z'),
  ('mat-oro-10k',          'material','Oro 10k',           '#d7b471',                                        70,1,'2026-10-14T00:00:00.000Z'),
  ('mat-oro-10k-cadenas',  'material','Oro 10k cadenas',   '#d7b471',                                        80,1,'2026-10-14T00:00:00.000Z'),
  ('mat-oro-10k-anillos',  'material','Oro 10k anillos',   '#d7b471',                                        90,1,'2026-10-14T00:00:00.000Z'),
  ('mat-oro-10k-arracadas','material','Oro 10k arracadas', '#d7b471',                                       100,1,'2026-10-14T00:00:00.000Z'),
  ('mat-oro-14k',          'material','Oro 14k',           '#dcb45e',                                       110,1,'2026-10-14T00:00:00.000Z'),
  ('mat-oro-18k',          'material','Oro 18k',           '#e3bb48',                                       120,1,'2026-10-14T00:00:00.000Z'),
  ('mat-chapa-14k',        'material','Chapa de Oro 14K',  'linear-gradient(135deg,#dcb45e 50%,#c9ced6 50%)',130,1,'2026-10-14T00:00:00.000Z'),
  ('mat-chapa-18k',        'material','Chapa de Oro 18K',  'linear-gradient(135deg,#e3bb48 50%,#c9ced6 50%)',140,1,'2026-10-14T00:00:00.000Z'),
  ('mat-plastico',         'material','Plástico',          '#e9e4dd',                                       150,1,'2026-10-14T00:00:00.000Z'),
  ('mat-otros',            'material','Otros',             '#cfcac3',                                       160,1,'2026-10-14T00:00:00.000Z');

-- ------------------------------------------------------------
-- Tipos de joya (alimentan Product.type)
-- "Joyería personalizada" es nuevo, pedido por la clienta.
-- ------------------------------------------------------------
INSERT OR IGNORE INTO "CatalogOption" ("id","kind","name","swatch","sortOrder","isActive","createdAt") VALUES
  ('tipo-anillos',       'jewelryType','Anillos',               NULL,10,1,'2026-10-14T00:00:00.000Z'),
  ('tipo-broqueles',     'jewelryType','Broqueles',             NULL,20,1,'2026-10-14T00:00:00.000Z'),
  ('tipo-pulseras',      'jewelryType','Pulseras',              NULL,30,1,'2026-10-14T00:00:00.000Z'),
  ('tipo-cadenas',       'jewelryType','Cadenas',               NULL,40,1,'2026-10-14T00:00:00.000Z'),
  ('tipo-personalizada', 'jewelryType','Joyería personalizada', NULL,50,1,'2026-10-14T00:00:00.000Z'),
  ('tipo-otros',         'jewelryType','Otros',                 NULL,60,1,'2026-10-14T00:00:00.000Z');

-- ------------------------------------------------------------
-- Comprobacion: deben salir 16 materiales y 6 tipos.
-- ------------------------------------------------------------
SELECT kind, COUNT(*) AS total FROM "CatalogOption" GROUP BY kind;

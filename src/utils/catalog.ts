// ============================================================
// src/utils/catalog.ts  —  SOLO SERVIDOR
// ============================================================
// Lectura de las opciones editables (materiales y tipos de joya) con cache
// en memoria.
//
// Por que el cache: estas listas se leen en CADA request del catalogo y del
// admin, y son practicamente inmutables (la clienta las toca una vez cada
// varios meses). Sin cache, cada visita a /products sumaria una consulta mas
// a Turso, que se cobra por filas leidas.
//
// El cache vive en el modulo, asi que es por instancia de la funcion
// serverless. Se invalida de dos formas:
//   - por TTL, para que una instancia tibia no se quede con datos viejos
//   - explicitamente con invalidateCatalogCache(), que llaman las actions
//     del admin al escribir (surte efecto inmediato en la instancia que
//     atendio la escritura; en las demas, al vencer el TTL)
//
// NO importar desde codigo de cliente: usa astro:db.
// ============================================================

import { db, CatalogOption, and, eq, asc } from 'astro:db';

export type CatalogKind = 'material' | 'jewelryType';

export interface CatalogOptionRow {
  id: string;
  kind: string;
  name: string;
  swatch: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Si la tabla aun no existe en la base (migracion sin correr), se usa esto. */
const FALLBACK: Record<CatalogKind, string[]> = {
  material: [
    'Titanio', 'Acero Quirúrgico', 'Acero Inoxidable', 'Plata', 'Plata .925',
    'Rodio', 'Oro 10k', 'Oro 10k cadenas', 'Oro 10k anillos',
    'Oro 10k arracadas', 'Oro 14k', 'Oro 18k', 'Chapa de Oro 14K',
    'Chapa de Oro 18K', 'Plástico', 'Otros',
  ],
  jewelryType: ['Anillos', 'Broqueles', 'Pulseras', 'Cadenas', 'Joyería personalizada', 'Otros'],
};

const TTL_MS = 5 * 60 * 1000; // 5 minutos

interface CacheEntry {
  rows: CatalogOptionRow[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Tira el cache. Las actions del admin la llaman despues de cada escritura. */
export function invalidateCatalogCache(): void {
  cache.clear();
}

/**
 * Opciones de un tipo, ordenadas.
 * @param includeInactive true solo para el admin, que necesita ver y poder
 *        reactivar las desactivadas. El resto del sitio nunca las pide.
 */
export async function getCatalogOptions(
  kind: CatalogKind,
  includeInactive = false
): Promise<CatalogOptionRow[]> {
  const key = `${kind}:${includeInactive}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.rows;

  try {
    const where = includeInactive
      ? eq(CatalogOption.kind, kind)
      : and(eq(CatalogOption.kind, kind), eq(CatalogOption.isActive, true));

    const rows = await db
      .select({
        id: CatalogOption.id,
        kind: CatalogOption.kind,
        name: CatalogOption.name,
        swatch: CatalogOption.swatch,
        sortOrder: CatalogOption.sortOrder,
        isActive: CatalogOption.isActive,
      })
      .from(CatalogOption)
      .where(where)
      .orderBy(asc(CatalogOption.sortOrder), asc(CatalogOption.name));

    const result: CatalogOptionRow[] = rows.map(r => ({
      ...r,
      swatch: r.swatch ?? null,
      isActive: Boolean(r.isActive),
    }));

    cache.set(key, { rows: result, expiresAt: Date.now() + TTL_MS });
    return result;
  } catch (error) {
    // Si la migracion todavia no se corrio en Turso, la tabla no existe.
    // Mejor seguir con la lista vieja que tumbar el catalogo entero.
    console.error(`[catalog] No se pudo leer CatalogOption (${kind}):`, error);
    return FALLBACK[kind].map((name, i) => ({
      id: `fallback-${i}`,
      kind,
      name,
      swatch: null,
      sortOrder: (i + 1) * 10,
      isActive: true,
    }));
  }
}

/** Solo los nombres. Es lo que usan los selects y la validacion de filtros. */
export async function getCatalogNames(
  kind: CatalogKind,
  includeInactive = false
): Promise<string[]> {
  const rows = await getCatalogOptions(kind, includeInactive);
  return rows.map(r => r.name);
}

export const getMaterialNames = () => getCatalogNames('material');
export const getJewelryTypeNames = () => getCatalogNames('jewelryType');

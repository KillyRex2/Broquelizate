// ============================================================
// src/actions/admin/catalog.action.ts
//
// CRUD de las opciones editables del catalogo: materiales y tipos de joya.
// Alimentan Product.category y Product.type respectivamente.
// ============================================================

import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { db, CatalogOption, Product, and, eq, sql, count, asc } from 'astro:db';
import { assertAdmin } from '../_guard';
import { invalidateCatalogCache, type CatalogKind } from '@/utils/catalog';
import { normalizeSearch } from '@/utils/search';

const kindSchema = z.enum(['material', 'jewelryType']);

/** La columna de Product que alimenta cada tipo de opcion. */
const columnFor = (kind: CatalogKind) =>
  kind === 'material' ? Product.category : Product.type;

/** Id estable y legible a partir del nombre: "Oro 14k" -> "mat-oro-14k". */
function buildId(kind: CatalogKind, name: string): string {
  const prefix = kind === 'material' ? 'mat' : 'tipo';
  const slug = normalizeSearch(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'opcion';
  return `${prefix}-${slug}-${Date.now().toString(36).slice(-4)}`;
}

/** Cuantos productos vivos usan cada valor de la columna. */
async function countByValue(kind: CatalogKind): Promise<Map<string, number>> {
  const col = columnFor(kind);
  const rows = await db
    .select({ value: col, total: count() })
    .from(Product)
    .where(sql`(${Product.isDeleted} = 0 OR ${Product.isDeleted} IS NULL)`)
    .groupBy(col);
  return new Map(rows.map(r => [r.value ?? '', Number(r.total)]));
}

// ------------------------------------------------------------
// Listar (admin): incluye inactivas y el conteo de productos
// ------------------------------------------------------------
export const listCatalogOptions = defineAction({
  accept: 'json',
  // kind opcional DENTRO del objeto: la pagina llama con {} para pedir los
  // dos tipos a la vez. Con z.object({kind}).optional(), {} no es undefined
  // y la validacion reventaba pidiendo kind.
  input: z.object({ kind: kindSchema.optional() }).optional(),
  handler: async (input, context) => {
    assertAdmin(context);

    const kinds: CatalogKind[] = input?.kind ? [input.kind] : ['material', 'jewelryType'];
    const result: Record<string, Array<{
      id: string; name: string; swatch: string | null;
      sortOrder: number; isActive: boolean; productCount: number;
    }>> = {};

    for (const kind of kinds) {
      const [rows, counts] = await Promise.all([
        db.select().from(CatalogOption)
          .where(eq(CatalogOption.kind, kind))
          .orderBy(asc(CatalogOption.sortOrder), asc(CatalogOption.name)),
        countByValue(kind),
      ]);

      result[kind] = rows.map(r => ({
        id: r.id,
        name: r.name,
        swatch: r.swatch ?? null,
        sortOrder: r.sortOrder,
        isActive: Boolean(r.isActive),
        productCount: counts.get(r.name) ?? 0,
      }));
    }

    return result;
  },
});

// ------------------------------------------------------------
// Crear
// ------------------------------------------------------------
export const createCatalogOption = defineAction({
  accept: 'json',
  input: z.object({
    kind: kindSchema,
    name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(60),
    swatch: z.string().trim().max(120).optional(),
  }),
  handler: async ({ kind, name, swatch }, context) => {
    assertAdmin(context);

    const [dup] = await db.select({ id: CatalogOption.id })
      .from(CatalogOption)
      .where(and(eq(CatalogOption.kind, kind), eq(CatalogOption.name, name)));
    if (dup) {
      throw new ActionError({ code: 'CONFLICT', message: `"${name}" ya existe.` });
    }

    const [last] = await db.select({ max: sql<number>`COALESCE(MAX(${CatalogOption.sortOrder}), 0)` })
      .from(CatalogOption)
      .where(eq(CatalogOption.kind, kind));

    const row = {
      id: buildId(kind, name),
      kind,
      name,
      swatch: swatch || null,
      sortOrder: Number(last?.max ?? 0) + 10,
      isActive: true,
      createdAt: new Date(),
    };

    await db.insert(CatalogOption).values(row);
    invalidateCatalogCache();
    return { ok: true, id: row.id };
  },
});

// ------------------------------------------------------------
// Actualizar nombre y/o color.
// Renombrar PROPAGA el cambio a los productos que usaban el nombre viejo:
// Product.category / Product.type guardan el texto, no un id, asi que sin
// esto los productos quedarian apuntando a una opcion inexistente y
// desaparecerian de los filtros.
// ------------------------------------------------------------
export const updateCatalogOption = defineAction({
  accept: 'json',
  input: z.object({
    id: z.string(),
    name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(60),
    swatch: z.string().trim().max(120).optional(),
  }),
  handler: async ({ id, name, swatch }, context) => {
    assertAdmin(context);

    const [current] = await db.select().from(CatalogOption).where(eq(CatalogOption.id, id));
    if (!current) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'La opción ya no existe.' });
    }

    const kind = current.kind as CatalogKind;

    if (name !== current.name) {
      const [dup] = await db.select({ id: CatalogOption.id })
        .from(CatalogOption)
        .where(and(eq(CatalogOption.kind, kind), eq(CatalogOption.name, name)));
      if (dup) {
        throw new ActionError({ code: 'CONFLICT', message: `"${name}" ya existe.` });
      }
    }

    await db.update(CatalogOption)
      .set({ name, swatch: swatch || null })
      .where(eq(CatalogOption.id, id));

    let updatedProducts = 0;
    if (name !== current.name) {
      const col = columnFor(kind);
      const affected = await db.select({ total: count() })
        .from(Product)
        .where(eq(col, current.name));
      updatedProducts = Number(affected[0]?.total ?? 0);

      if (updatedProducts > 0) {
        await db.update(Product)
          .set(kind === 'material' ? { category: name } : { type: name })
          .where(eq(col, current.name));
      }
    }

    invalidateCatalogCache();
    return { ok: true, updatedProducts };
  },
});

// ------------------------------------------------------------
// Activar / desactivar.
// Una opcion desactivada deja de ofrecerse en los selects y en el filtro
// publico, pero los productos que ya la tienen no se tocan.
// ------------------------------------------------------------
export const toggleCatalogOption = defineAction({
  accept: 'json',
  input: z.object({ id: z.string(), isActive: z.boolean() }),
  handler: async ({ id, isActive }, context) => {
    assertAdmin(context);
    await db.update(CatalogOption).set({ isActive }).where(eq(CatalogOption.id, id));
    invalidateCatalogCache();
    return { ok: true };
  },
});

// ------------------------------------------------------------
// Borrar. Solo si ningun producto la usa; si la usan, se sugiere desactivar.
// ------------------------------------------------------------
export const deleteCatalogOption = defineAction({
  accept: 'json',
  input: z.object({ id: z.string() }),
  handler: async ({ id }, context) => {
    assertAdmin(context);

    const [current] = await db.select().from(CatalogOption).where(eq(CatalogOption.id, id));
    if (!current) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'La opción ya no existe.' });
    }

    const kind = current.kind as CatalogKind;
    const [used] = await db.select({ total: count() })
      .from(Product)
      .where(and(
        eq(columnFor(kind), current.name),
        sql`(${Product.isDeleted} = 0 OR ${Product.isDeleted} IS NULL)`
      ));

    const total = Number(used?.total ?? 0);
    if (total > 0) {
      throw new ActionError({
        code: 'CONFLICT',
        message: `No se puede eliminar: ${total} producto${total === 1 ? '' : 's'} usa${total === 1 ? '' : 'n'} "${current.name}". Desactívala en su lugar y dejará de aparecer en los filtros sin tocar esos productos.`,
      });
    }

    await db.delete(CatalogOption).where(eq(CatalogOption.id, id));
    invalidateCatalogCache();
    return { ok: true };
  },
});

// ------------------------------------------------------------
// Reordenar: recibe los ids en el orden deseado.
// ------------------------------------------------------------
export const reorderCatalogOptions = defineAction({
  accept: 'json',
  input: z.object({ ids: z.array(z.string()).min(1) }),
  handler: async ({ ids }, context) => {
    assertAdmin(context);
    await Promise.all(
      ids.map((id, i) =>
        db.update(CatalogOption).set({ sortOrder: (i + 1) * 10 }).where(eq(CatalogOption.id, id))
      )
    );
    invalidateCatalogCache();
    return { ok: true };
  },
});

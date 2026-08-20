// ============================================================
// src/actions/admin/collections.action.ts
//
// CRUD de colecciones del home. Cada action se exporta por
// separado, igual que el resto de tus actions.
// ============================================================

import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import {
  db, eq, asc, desc, inArray, sql,
  Product, ProductImage, Collection, CollectionProduct,
} from 'astro:db';
import { assertAdmin } from '../_guard';

const modeEnum = z.enum(['auto', 'manual']);
const filterFieldEnum = z.enum(['category', 'type', 'allowsEngraving', 'isFeatured']);

/** Lista completa para la tabla del admin (incluye inactivas) */
export const listCollections = defineAction({
  handler: async (_input, context) => {
    await assertAdmin(context);
    const rows = await db.select().from(Collection).orderBy(asc(Collection.sortOrder));

    // Cuantos productos tiene cada coleccion manual, en UNA sola query
    const manualIds = rows.filter(r => r.mode === 'manual').map(r => r.id);
    let counts = new Map<string, number>();
    if (manualIds.length > 0) {
      const c = await db
        .select({ collectionId: CollectionProduct.collectionId, n: sql<number>`count(*)` })
        .from(CollectionProduct)
        .where(inArray(CollectionProduct.collectionId, manualIds))
        .groupBy(CollectionProduct.collectionId);
      counts = new Map(c.map(x => [x.collectionId, Number(x.n)]));
    }

    return rows.map(r => ({ ...r, manualCount: counts.get(r.id) ?? 0 }));
  },
});

export const createCollection = defineAction({
  input: z.object({
    title: z.string().min(2, 'El título es obligatorio'),
    linkText: z.string().default('Ver todo'),
    href: z.string().optional(),
    badge: z.string().optional(),
    mode: modeEnum.default('auto'),
    filterField: filterFieldEnum.optional(),
    filterValue: z.string().optional(),
    limit: z.number().int().min(2).max(24).default(10),
    isActive: z.boolean().default(true),
  }),
  handler: async (input, context) => {
    await assertAdmin(context);

    if (input.mode === 'auto' && !input.filterField) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: 'Una colección automática necesita un filtro.',
      });
    }

    // Se agrega al final del home
    const [last] = await db
      .select({ sortOrder: Collection.sortOrder })
      .from(Collection)
      .orderBy(desc(Collection.sortOrder))
      .limit(1);

    const id = crypto.randomUUID();
    await db.insert(Collection).values({
      id,
      title: input.title,
      linkText: input.linkText,
      href: input.href || null,
      badge: input.badge || null,
      mode: input.mode,
      filterField: input.filterField || null,
      filterValue: input.filterValue || null,
      limit: input.limit,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      isActive: input.isActive,
      createdAt: new Date(),
    } as any);

    return { id };
  },
});

export const updateCollection = defineAction({
  input: z.object({
    id: z.string(),
    title: z.string().min(2).optional(),
    linkText: z.string().optional(),
    href: z.string().nullable().optional(),
    badge: z.string().nullable().optional(),
    mode: modeEnum.optional(),
    filterField: filterFieldEnum.nullable().optional(),
    filterValue: z.string().nullable().optional(),
    limit: z.number().int().min(2).max(24).optional(),
    isActive: z.boolean().optional(),
  }),
  handler: async ({ id, ...changes }, context) => {
    await assertAdmin(context);
    const clean = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) return { ok: true };
    await db.update(Collection).set(clean as any).where(eq(Collection.id, id));
    return { ok: true };
  },
});

/** Interruptor rapido desde la tabla del admin */
export const toggleCollection = defineAction({
  input: z.object({ id: z.string(), isActive: z.boolean() }),
  handler: async ({ id, isActive }, context) => {
    await assertAdmin(context);
    await db.update(Collection).set({ isActive } as any).where(eq(Collection.id, id));
    return { ok: true };
  },
});

export const deleteCollection = defineAction({
  input: z.object({ id: z.string() }),
  handler: async ({ id }, context) => {
    await assertAdmin(context);
    // Primero los hijos: no hay ON DELETE CASCADE definido
    await db.delete(CollectionProduct).where(eq(CollectionProduct.collectionId, id));
    await db.delete(Collection).where(eq(Collection.id, id));
    return { ok: true };
  },
});

/** Reordena el home. Recibe los ids ya en el orden deseado. */
export const reorderCollections = defineAction({
  input: z.object({ ids: z.array(z.string()).min(1) }),
  handler: async ({ ids }, context) => {
    await assertAdmin(context);
    // En paralelo: son writes independientes, una por fila
    await Promise.all(
      ids.map((id, i) =>
        db.update(Collection).set({ sortOrder: i } as any).where(eq(Collection.id, id))
      )
    );
    return { ok: true };
  },
});

/** Productos de una coleccion manual (para pintar el selector) */
export const getCollectionProducts = defineAction({
  input: z.object({ collectionId: z.string() }),
  handler: async ({ collectionId }, context) => {
    await assertAdmin(context);
    return await db
      .select()
      .from(CollectionProduct)
      .where(eq(CollectionProduct.collectionId, collectionId))
      .orderBy(asc(CollectionProduct.position));
  },
});

/**
 * Reemplaza por completo los productos de una coleccion manual.
 * Es un "set", no un "add": el admin manda la lista final y su orden.
 */
export const setCollectionProducts = defineAction({
  input: z.object({
    collectionId: z.string(),
    productIds: z.array(z.string()),
  }),
  handler: async ({ collectionId, productIds }, context) => {
    await assertAdmin(context);

    await db.delete(CollectionProduct).where(eq(CollectionProduct.collectionId, collectionId));

    if (productIds.length > 0) {
      // Un solo INSERT con todas las filas: un viaje, no N
      await db.insert(CollectionProduct).values(
        productIds.map((productId, i) => ({
          id: crypto.randomUUID(),
          collectionId,
          productId,
          position: i,
        })) as any
      );
    }

    return { ok: true, count: productIds.length };
  },
});

/** Buscador de productos para el modo manual */
export const searchAdminProducts = defineAction({
  input: z.object({
    query: z.string().default(''),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  handler: async ({ query, limit }, context) => {
    await assertAdmin(context);

    const q = query.trim();
    const rows = await db
      .select({
        id: Product.id,
        name: Product.name,
        price: Product.price,
        slug: Product.slug,
        stock: Product.stock,
        category: Product.category,
        type: Product.type,
        coverImageId: Product.coverImageId,
      })
      .from(Product)
      .where(
        q
          ? sql`${Product.isDeleted} = 0 AND ${Product.name} LIKE ${'%' + q + '%'}`
          : eq(Product.isDeleted, false)
      )
      .limit(limit);

    if (rows.length === 0) return [];

    const imgs = await db
      .select({ id: ProductImage.id, productId: ProductImage.productId, image: ProductImage.image })
      .from(ProductImage)
      .where(inArray(ProductImage.productId, rows.map(r => r.id)));

    return rows.map(r => {
      const own = imgs.filter(i => i.productId === r.id);
      const cover = r.coverImageId ? own.find(i => i.id === r.coverImageId) : null;
      return { ...r, image: (cover || own[0])?.image ?? null };
    });
  },
});

/** Recupera productos por id (para rearmar una coleccion manual guardada) */
export const getProductsByIds = defineAction({
  input: z.object({ ids: z.array(z.string()) }),
  handler: async ({ ids }, context) => {
    await assertAdmin(context);
    if (ids.length === 0) return [];

    const [rows, imgs] = await Promise.all([
      db
        .select({
          id: Product.id,
          name: Product.name,
          price: Product.price,
          slug: Product.slug,
          stock: Product.stock,
          category: Product.category,
          coverImageId: Product.coverImageId,
        })
        .from(Product)
        .where(inArray(Product.id, ids)),
      db
        .select({ id: ProductImage.id, productId: ProductImage.productId, image: ProductImage.image })
        .from(ProductImage)
        .where(inArray(ProductImage.productId, ids)),
    ]);

    return rows.map(r => {
      const own = imgs.filter(i => i.productId === r.id);
      const cover = r.coverImageId ? own.find(i => i.id === r.coverImageId) : null;
      return { ...r, image: (cover || own[0])?.image ?? null };
    });
  },
});

/** Valores existentes de category y type, para los desplegables del admin */
export const getFilterOptions = defineAction({
  handler: async (_input, context) => {
    await assertAdmin(context);
    const [cats, types] = await Promise.all([
      db.selectDistinct({ v: Product.category }).from(Product).where(eq(Product.isDeleted, false)),
      db.selectDistinct({ v: Product.type }).from(Product).where(eq(Product.isDeleted, false)),
    ]);
    return {
      categories: cats.map(c => c.v).filter(Boolean).sort(),
      types: types.map(t => t.v).filter(Boolean).sort(),
    };
  },
});
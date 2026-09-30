// ============================================================
// src/utils/stock.ts
//
// Política de inventario:
//
//   ONLINE  → nunca negativo. Si no hay piezas, la venta se
//             detiene ANTES de cobrar. Vender algo que no
//             existe significa devolver dinero y perder al
//             cliente.
//
//   POS     → puede quedar negativo. En mostrador la pieza ya
//             está en la mano del cliente: bloquear la venta
//             porque el sistema dice 0 sería absurdo. El
//             negativo queda como señal de que el inventario
//             está desfasado y hay que ajustarlo.
// ============================================================

import { db, eq, inArray, sql, Product, ProductVariantCombination } from 'astro:db';

export interface StockItem {
  productId: string;
  quantity: number;
  combinationId?: string | null;
}

export class InsufficientStockError extends Error {
  constructor(public readonly details: Array<{ name: string; requested: number; available: number }>) {
    const list = details.map(d => `${d.name} (pediste ${d.requested}, hay ${d.available})`).join('; ');
    super(`Sin existencias suficientes: ${list}`);
    this.name = 'InsufficientStockError';
  }
}

/**
 * Verifica disponibilidad ANTES de cobrar. Solo para ventas online.
 * Lanza InsufficientStockError con el detalle de qué falta.
 */
export async function assertAvailable(items: StockItem[]): Promise<void> {
  if (items.length === 0) return;

  const productIds = [...new Set(items.map(i => i.productId))];
  const comboIds = [...new Set(items.map(i => i.combinationId).filter(Boolean))] as string[];

  const [products, combos] = await Promise.all([
    db
      .select({ id: Product.id, name: Product.name, stock: Product.stock, hasVariants: Product.hasVariants })
      .from(Product)
      .where(inArray(Product.id, productIds)),
    comboIds.length
      ? db
          .select({
            id: ProductVariantCombination.id,
            stock: ProductVariantCombination.stock,
            name: ProductVariantCombination.combinationName,
          })
          .from(ProductVariantCombination)
          .where(inArray(ProductVariantCombination.id, comboIds))
      : Promise.resolve([] as any[]),
  ]);

  const productById = new Map(products.map(p => [p.id, p]));
  const comboById = new Map(combos.map((c: any) => [c.id, c]));

  // Varias líneas pueden apuntar al mismo producto: se suman
  // antes de comparar, o dos líneas de 3 pasarían con stock 4.
  const needed = new Map<string, { key: string; name: string; qty: number; available: number }>();

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);

    const combo = item.combinationId ? comboById.get(item.combinationId) : null;
    const key = combo ? `c:${combo.id}` : `p:${product.id}`;
    const name = combo ? `${product.name} (${combo.name})` : product.name;
    const available = combo ? combo.stock : product.stock;

    const acc = needed.get(key);
    if (acc) acc.qty += item.quantity;
    else needed.set(key, { key, name, qty: item.quantity, available });
  }

  const faltantes = [...needed.values()]
    .filter(n => n.qty > n.available)
    .map(n => ({ name: n.name, requested: n.qty, available: Math.max(0, n.available) }));

  if (faltantes.length > 0) throw new InsufficientStockError(faltantes);
}

/**
 * Descuenta inventario.
 *
 * allowNegative:
 *   false (online) → se detiene si algo no alcanza
 *   true  (POS)    → descuenta igual y el stock puede quedar negativo
 */
export async function decrementStock(
  items: StockItem[],
  { allowNegative = false }: { allowNegative?: boolean } = {}
): Promise<void> {
  if (items.length === 0) return;

  if (!allowNegative) {
    await assertAvailable(items);
  }

  await Promise.all(
    items.map(async item => {
      const qty = item.quantity;

      await db
        .update(Product)
        .set({ stock: sql`${Product.stock} - ${qty}` } as any)
        .where(eq(Product.id, item.productId));

      if (item.combinationId) {
        await db
          .update(ProductVariantCombination)
          .set({ stock: sql`${ProductVariantCombination.stock} - ${qty}` } as any)
          .where(eq(ProductVariantCombination.id, item.combinationId));
      }
    })
  );
}

/** Devuelve inventario (cancelaciones, devoluciones) */
export async function incrementStock(items: StockItem[]): Promise<void> {
  if (items.length === 0) return;

  await Promise.all(
    items.map(async item => {
      await db
        .update(Product)
        .set({ stock: sql`${Product.stock} + ${item.quantity}` } as any)
        .where(eq(Product.id, item.productId));

      if (item.combinationId) {
        await db
          .update(ProductVariantCombination)
          .set({ stock: sql`${ProductVariantCombination.stock} + ${item.quantity}` } as any)
          .where(eq(ProductVariantCombination.id, item.combinationId));
      }
    })
  );
}

/** Productos con inventario negativo — para un aviso en el panel */
export async function getNegativeStock() {
  return await db
    .select({ id: Product.id, name: Product.name, stock: Product.stock, slug: Product.slug })
    .from(Product)
    .where(sql`${Product.stock} < 0 AND ${Product.isDeleted} = 0`);
}
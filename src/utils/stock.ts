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
// ============================================================
// Devolver (o volver a tomar) el inventario de un pedido
// ============================================================

/** Estados en los que el pedido YA descontó inventario. */
const ESTADOS_CON_STOCK_TOMADO = ['paid', 'completed', 'processing', 'shipped'];

export const tomoStock = (estado: string | null | undefined): boolean =>
  ESTADOS_CON_STOCK_TOMADO.includes(String(estado));

export interface RenglonSinResolver {
  producto: string;
  detalle: string | null;
  cantidad: number;
  motivo: string;
}

export interface ResultadoStockPedido {
  /** Cuántos renglones se pudieron aplicar. */
  aplicados: number;
  /** Los que no, con el motivo, para poder decírselo al admin. */
  sinResolver: RenglonSinResolver[];
}

/**
 * Suma o resta el inventario de un pedido completo.
 *
 * `signo` es +1 al cancelar (devolver las piezas al almacén) y -1 al
 * revivir un pedido cancelado (volver a sacarlas).
 *
 * Por qué no basta con llamar a incrementStock:
 *
 *   El inventario de un producto con variantes NO vive en Product.stock,
 *   vive en sus hijos; Product.stock es la suma. Sumarle al padre sin tocar
 *   al hijo deja los dos números peleados, y la siguiente venta en mostrador
 *   recalcula el padre desde los hijos y borra la devolución en silencio.
 *   Así que hay que devolverle la pieza al mismo cajón del que salió y
 *   volver a cuadrar el padre.
 *
 * Qué pasa cuando no se puede saber el cajón:
 *
 *   order_items guarda variantCombinationId para las combinaciones, pero de
 *   las variantes sueltas solo guarda su descripción en texto ("Color:
 *   Dorado"). Si esa variante se renombró o se borró, no hay forma honesta
 *   de adivinar a cuál volvía. Esos renglones NO se tocan y se devuelven en
 *   `sinResolver` para que el panel los enseñe: mejor que el admin ajuste
 *   tres piezas a mano sabiendo cuáles, a que el sistema invente un número.
 */
export async function aplicarStockDePedido(
  orderId: string,
  signo: 1 | -1
): Promise<ResultadoStockPedido> {
  const { order_items, ProductVariant } = await import('astro:db');

  const items = await db
    .select({
      productId: order_items.productId,
      productName: order_items.productName,
      quantity: order_items.quantity,
      variantCombinationId: order_items.variantCombinationId,
      variantDescription: order_items.variantDescription,
    })
    .from(order_items)
    .where(eq(order_items.orderId, orderId));

  if (items.length === 0) return { aplicados: 0, sinResolver: [] };

  const productIds = Array.from(new Set(items.map(i => i.productId).filter(Boolean)));

  const [combinaciones, variantes] = await Promise.all([
    db
      .select({ id: ProductVariantCombination.id, productId: ProductVariantCombination.productId })
      .from(ProductVariantCombination)
      .where(inArray(ProductVariantCombination.productId, productIds)),
    db
      .select({
        id: ProductVariant.id,
        productId: ProductVariant.productId,
        variantName: ProductVariant.variantName,
        variantValue: ProductVariant.variantValue,
      })
      .from(ProductVariant)
      .where(inArray(ProductVariant.productId, productIds)),
  ]);

  const comboPorId = new Map(combinaciones.map(c => [c.id, c]));
  const porProducto = <T extends { productId: string }>(filas: T[]) => {
    const m = new Map<string, T[]>();
    for (const f of filas) {
      if (!m.has(f.productId)) m.set(f.productId, []);
      m.get(f.productId)!.push(f);
    }
    return m;
  };
  const combosDe = porProducto(combinaciones);
  const variantesDe = porProducto(variantes);

  const norm = (s: string) => s.trim().toLowerCase();

  const ops: any[] = [];
  const sinResolver: RenglonSinResolver[] = [];
  const cuadrarPorCombo = new Set<string>();
  const cuadrarPorVariante = new Set<string>();

  for (const it of items) {
    const cantidad = Number(it.quantity) || 0;
    if (cantidad <= 0) continue;
    const delta = signo * cantidad;

    // 1. Combinación: es el único caso que el pedido identifica sin ambigüedad.
    if (it.variantCombinationId && comboPorId.has(it.variantCombinationId)) {
      ops.push(
        db
          .update(ProductVariantCombination)
          .set({ stock: sql`${ProductVariantCombination.stock} + ${delta}` } as any)
          .where(eq(ProductVariantCombination.id, it.variantCombinationId)),
      );
      cuadrarPorCombo.add(it.variantCombinationId ? comboPorId.get(it.variantCombinationId)!.productId : it.productId);
      continue;
    }

    const desc = (it.variantDescription || '').trim();
    const hijosVariante = variantesDe.get(it.productId) ?? [];
    const hijosCombo = combosDe.get(it.productId) ?? [];

    // 2. Variante suelta: se busca por su descripción, que es lo único que
    //    quedó guardado. Tiene que coincidir UNA sola.
    if (desc) {
      const candidatas = hijosVariante.filter(
        v =>
          norm(`${v.variantName}: ${v.variantValue}`) === norm(desc) ||
          norm(v.variantValue) === norm(desc),
      );

      if (candidatas.length === 1) {
        ops.push(
          db
            .update(ProductVariant)
            .set({ stock: sql`${ProductVariant.stock} + ${delta}` } as any)
            .where(eq(ProductVariant.id, candidatas[0].id)),
        );
        cuadrarPorVariante.add(it.productId);
        continue;
      }

      sinResolver.push({
        producto: it.productName,
        detalle: desc,
        cantidad,
        motivo: candidatas.length > 1
          ? 'hay varias variantes con ese mismo nombre'
          : 'esa variante ya no existe o se renombró',
      });
      continue;
    }

    // 3. Producto con hijos pero sin detalle guardado: no se puede adivinar.
    if (hijosCombo.length > 0 || hijosVariante.length > 0) {
      sinResolver.push({
        producto: it.productName,
        detalle: null,
        cantidad,
        motivo: 'el pedido no guardó qué variante se vendió',
      });
      continue;
    }

    // 4. Producto simple: su inventario sí vive en Product.stock.
    ops.push(
      db
        .update(Product)
        .set({ stock: sql`${Product.stock} + ${delta}` } as any)
        .where(eq(Product.id, it.productId)),
    );
  }

  // Cuadrar el padre con sus hijos. Va al final a propósito: el batch se
  // ejecuta en orden, así que estas sumas ya leen el stock corregido.
  for (const productId of cuadrarPorCombo) {
    ops.push(
      db
        .update(Product)
        .set({
          stock: sql`(SELECT COALESCE(SUM(${ProductVariantCombination.stock}), 0) FROM ${ProductVariantCombination} WHERE ${ProductVariantCombination.productId} = ${productId})`,
        } as any)
        .where(eq(Product.id, productId)),
    );
  }
  for (const productId of cuadrarPorVariante) {
    if (cuadrarPorCombo.has(productId)) continue;
    ops.push(
      db
        .update(Product)
        .set({
          stock: sql`(SELECT COALESCE(SUM(${ProductVariant.stock}), 0) FROM ${ProductVariant} WHERE ${ProductVariant.productId} = ${productId})`,
        } as any)
        .where(eq(Product.id, productId)),
    );
  }

  if (ops.length > 0) await db.batch(ops as any);

  return { aplicados: ops.length, sinResolver };
}

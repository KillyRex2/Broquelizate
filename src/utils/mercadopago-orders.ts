// ============================================================
// src/utils/mercadopago-orders.ts
//
// El pedido se crea ANTES de mandar al cliente a pagar, con
// status 'pending' y el externalReference guardado. Después,
// quien confirme (webhook o página de retorno) solo lo marca
// como pagado.
//
// Por qué así:
//   · OXXO y SPEI se pagan horas o días después. Con el modelo
//     anterior (crear el pedido al volver), ese dinero entraba
//     sin pedido asociado.
//   · Si el cliente cierra la pestaña tras pagar, igual queda.
//   · La confirmación es idempotente: webhook y retorno pueden
//     llegar los dos y no se duplica nada.
// ============================================================

import { db, eq, inArray, sql, Product, ProductVariantCombination, orders, order_items } from 'astro:db';

export interface IncomingItem {
  productId: string;
  quantity: number;
  combinationId?: string | null;
  variantCombination?: unknown;
  variantSku?: string | null;
  customizationData?: unknown;
}

export interface PricedItem extends IncomingItem {
  name: string;
  unitPrice: number;
  lineTotal: number;
}

/**
 * libSQL (Turso) solo acepta string | number | bigint | boolean | null | Uint8Array.
 * Un `undefined` o un objeto suelto revientan con "Unsupported type of value",
 * y el error no dice qué columna fue. Por eso todo pasa por aquí antes de insertar.
 */
const toText = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
};

const toNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Recalcula precios desde la base. NUNCA se confía en el precio
 * que manda el navegador: es lo primero que se manipula.
 */
export async function priceItems(items: IncomingItem[]): Promise<PricedItem[]> {
  if (!Array.isArray(items) || items.length === 0) throw new Error('El carrito está vacío');

  const productIds = [...new Set(items.map(i => i.productId).filter(Boolean))];
  if (productIds.length === 0) throw new Error('Los productos del carrito no son válidos');

  const comboIds = [...new Set(items.map(i => i.combinationId).filter(Boolean))] as string[];

  const [products, combos] = await Promise.all([
    db.select().from(Product).where(inArray(Product.id, productIds)),
    comboIds.length
      ? db.select().from(ProductVariantCombination).where(inArray(ProductVariantCombination.id, comboIds))
      : Promise.resolve([] as any[]),
  ]);

  const productById = new Map(products.map(p => [p.id, p]));
  const comboById = new Map(combos.map((c: any) => [c.id, c]));

  return items.map(item => {
    const product = productById.get(item.productId);
    if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);
    if ((product as any).isDeleted) throw new Error(`Producto no disponible: ${product.name}`);

    const qty = Math.max(1, Math.floor(toNum(item.quantity, 1)));

    // Con variantes el precio lo manda la combinación, no el producto.
    const combo = item.combinationId ? comboById.get(item.combinationId) : null;
    const unitPrice = toNum(combo ? combo.price : product.price);

    // 💡 Cuando entre el sistema de ofertas, el descuento se aplica aquí:
    //    const { price: unitPrice } = getPrice({ price: basePrice, ...product });
    //    y todo el sitio (tienda, POS, MP) lo hereda sin más cambios.

    if (unitPrice <= 0) throw new Error(`Precio inválido para ${product.name}`);

    return {
      ...item,
      quantity: qty,
      name: product.name,
      unitPrice,
      lineTotal: unitPrice * qty,
    };
  });
}

function makeOrderNumber(): string {
  // ⚠️ Ajusta el formato al que ya uses en /api/create-order
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MP-${stamp}-${rand}`;
}

interface CreatePendingArgs {
  externalReference: string;
  items: PricedItem[];
  shippingCost: number;
  customerEmail: string;
  customerName: string;
  shippingAddress: Record<string, unknown>;
  shippingInfo: Record<string, unknown> | null;
  clientId?: number | null;
  /** 'online' (tienda) | 'pos' (mostrador) */
  channel?: 'online' | 'pos';
}

/** Crea el pedido en estado pendiente y devuelve sus totales */
export async function createPendingOrder(args: CreatePendingArgs) {
  const subtotal = args.items.reduce((s, i) => s + i.lineTotal, 0);
  const shippingCost = Math.max(0, toNum(args.shippingCost));
  const total = subtotal + shippingCost;

  const orderId = crypto.randomUUID();
  const orderNumber = makeOrderNumber();

  const orderRow = {
    id: orderId,
    orderNumber,
    customerEmail: String(args.customerEmail),
    shippingAddress: JSON.stringify(args.shippingAddress ?? {}),
    subtotal: toNum(subtotal),
    tax: 0,
    total: toNum(total),
    paymentMethod: args.channel === 'pos' ? 'mercadopago-pos' : 'mercadopago',
    status: 'pending',
    createdAt: new Date(),
    clientId: args.clientId != null ? toNum(args.clientId) : null,
    shippingCost: toNum(shippingCost),
    externalReference: String(args.externalReference),
  };

  try {
    await db.insert(orders).values(orderRow as any);
  } catch (e) {
    console.error('❌ INSERT orders falló. Fila:', orderRow);
    throw e;
  }

  const itemRows = args.items.map(i => ({
    id: crypto.randomUUID(),
    orderId,
    productId: String(i.productId),
    productName: String(i.name),
    quantity: toNum(i.quantity, 1),
    price: toNum(i.unitPrice),
    subtotal: toNum(i.lineTotal),
    variantCombinationId: i.combinationId ? String(i.combinationId) : null,
    variantDescription: toText(i.variantCombination),
    customizationData: toText(i.customizationData),
  }));

  try {
    await db.insert(order_items).values(itemRows as any);
  } catch (e) {
    console.error('❌ INSERT order_items falló. Filas:', itemRows);
    // El pedido ya se insertó: sin items queda huérfano, así que se limpia.
    await db.delete(orders).where(eq(orders.id, orderId)).catch(() => {});
    throw e;
  }

  return { orderId, orderNumber, subtotal, shippingCost, total };
}

/**
 * Marca el pedido como pagado y descuenta stock. Idempotente:
 * si ya estaba pagado, no vuelve a tocar el inventario.
 * Puede llamarla el webhook y la página de retorno sin coordinarse.
 */
export async function confirmOrderByReference(externalReference: string, paymentId?: string | number) {
  const [order] = await db.select().from(orders).where(eq(orders.externalReference, externalReference));
  if (!order) return { ok: false, reason: 'not_found' as const };

  // Ya confirmado por el otro camino: no hacer nada más.
  if (order.status === 'paid') {
    return { ok: true, alreadyPaid: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  await db
    .update(orders)
    .set({ status: 'paid', labelId: paymentId != null ? String(paymentId) : order.labelId } as any)
    .where(eq(orders.id, order.id));

  // Stock: solo en la transición pending → paid
  const items = await db.select().from(order_items).where(eq(order_items.orderId, order.id));

  const { decrementStock } = await import('@/utils/stock');
  await decrementStock(
    items.map((it: any) => ({
      productId: it.productId,
      quantity: it.quantity,
      combinationId: it.variantCombinationId ?? null,
    })),
    // El POS puede dejar el inventario negativo; la tienda online no.
    { allowNegative: order.paymentMethod === 'mercadopago-pos' }
  );

  return { ok: true, alreadyPaid: false, orderId: order.id, orderNumber: order.orderNumber };
}

/** Para pagos rechazados o cancelados */
export async function failOrderByReference(externalReference: string, status: 'rejected' | 'cancelled') {
  const [order] = await db.select().from(orders).where(eq(orders.externalReference, externalReference));
  if (!order || order.status === 'paid') return; // nunca degradar un pedido ya pagado
  await db.update(orders).set({ status } as any).where(eq(orders.id, order.id));
}

/** Consulta de estado, para que el POS haga polling */
export async function getOrderStatusByReference(externalReference: string) {
  const [order] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.total })
    .from(orders)
    .where(eq(orders.externalReference, externalReference));
  return order ?? null;
}
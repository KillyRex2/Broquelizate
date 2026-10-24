// src/pages/api/create-order.ts
//
// Dos caminos:
//
//   POS (admin, mostrador) → precios desde la base, descuento/cargos del
//     admin, sin envío. El stock, el saldo a crédito y la orden se guardan
//     aquí, en una sola transacción. Lleva llave de idempotencia para que un
//     doble clic no registre la venta dos veces.
//
//   Tienda online → SOLO con un pago verificado con el proveedor
//     (Stripe o PayPal). Antes cualquiera podía crear un pedido
//     "completed" sin pagar. Ahora:
//       · el total se calcula aquí (priceCheckout) y se compara con lo cobrado
//       · un mismo pago no puede registrar dos pedidos
//       · el stock se descuenta aquí (antes lo hacía el navegador)
import { db, orders, order_items, Product, ProductVariantCombination, ProductVariant, eq, inArray, sql } from 'astro:db';
import { v4 as uuidv4 } from 'uuid';
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getSession } from 'auth-astro/server';
import {
  CheckoutError, priceCheckout, toIncomingItems, findOrderByPaymentId, AMOUNT_TOLERANCE,
} from '@/utils/checkout';
import { getPaypalPayment } from '@/actions/admin/paypal';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const toText = (v: unknown): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return null; }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const session = await getSession(request);
    const data = await request.json();

    // El POS lo usa solo un admin y no manda channel: 'online'.
    const isPos = !!(locals as any)?.isAdmin && data?.channel !== 'online';

    return isPos
      ? await handlePosOrder(data, session)
      : await handleOnlineOrder(data, session);
  } catch (error: any) {
    if (error instanceof CheckoutError) return json({ error: error.message }, error.status);
    console.error('❌ Error al crear la orden:', error);
    const isDev = import.meta.env.DEV;
    return json({ error: 'Error al crear la orden', ...(isDev ? { details: error?.message } : {}) }, 500);
  }
};

// ============================================================
// Tienda online
// ============================================================

async function verifyPayment(method: string, paymentId: string): Promise<{ ok: boolean; amount: number; error?: string }> {
  if (method === 'card') {
    const secret = import.meta.env.STRIPE_SECRET_KEY;
    if (!secret) return { ok: false, amount: 0, error: 'Stripe no está configurado' };
    const stripe = new Stripe(secret, { apiVersion: "2025-04-30.basil" });
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentId);
      if (pi.status !== 'succeeded' || pi.currency !== 'mxn') {
        return { ok: false, amount: 0, error: 'El pago con tarjeta no está completado.' };
      }
      return { ok: true, amount: (pi.amount_received || pi.amount) / 100 };
    } catch {
      return { ok: false, amount: 0, error: 'No encontramos ese pago con tarjeta.' };
    }
  }

  if (method === 'paypal') {
    try {
      const p = await getPaypalPayment(paymentId);
      return p.ok ? { ok: true, amount: p.amount } : { ok: false, amount: 0, error: 'El pago de PayPal no está completado.' };
    } catch {
      return { ok: false, amount: 0, error: 'No pudimos verificar el pago de PayPal.' };
    }
  }

  return { ok: false, amount: 0, error: 'Método de pago no válido.' };
}

async function handleOnlineOrder(data: any, session: any) {
  const paymentMethod = String(data?.paymentMethod || '');
  const paymentId = String(data?.paymentIntentId || data?.paymentId || '').trim();
  if (!paymentId || !['card', 'paypal'].includes(paymentMethod)) {
    return json({ error: 'Falta un pago válido para registrar el pedido.' }, 400);
  }

  // Idempotente: si este pago ya tiene pedido, se devuelve el mismo.
  const existing = await findOrderByPaymentId(paymentId);
  if (existing) {
    return json({
      id: existing.id,
      orderNumber: existing.orderNumber,
      customerEmail: existing.customerEmail,
      total: existing.total,
      message: 'La orden ya estaba registrada',
    });
  }

  const customerEmail = session?.user?.email || data.customerEmail;
  if (!customerEmail) return json({ error: 'Email del cliente es requerido' }, 400);

  const shippingAddress = data.shippingAddress || {};
  const checkout = await priceCheckout({
    products: toIncomingItems(data.products),
    deliveryMethod: data.deliveryMethod,
    shipping: data.shippingInfo,
    destinationPostalCode: shippingAddress.postalCode,
    checkStock: false, // ya se cobró: no se rechaza el pedido por stock
  });

  // ── El pago, verificado con el proveedor ──
  const paid = await verifyPayment(paymentMethod, paymentId);
  if (!paid.ok) return json({ error: paid.error || 'Pago no verificado' }, 402);

  if (paid.amount + AMOUNT_TOLERANCE < checkout.total) {
    console.error('❌ Monto pagado menor al total del pedido', {
      paymentMethod, paymentId, paid: paid.amount, total: checkout.total,
    });
    return json({ error: 'El monto pagado no coincide con tu pedido. Contáctanos con tu comprobante y lo resolvemos.' }, 409);
  }

  const orderId = uuidv4();
  const orderNumber = `ORD-${Date.now()}`;

  await db.insert(orders).values({
    id: orderId,
    orderNumber,
    customerEmail,
    shippingAddress: JSON.stringify(shippingAddress),
    subtotal: checkout.subtotal,
    tax: 0,
    total: checkout.total,
    paymentMethod,
    paymentId,
    status: 'completed',
    createdAt: new Date(),
    clientId: null,
    shippingCost: checkout.shipping.shippingCost,
    deliveryMethod: checkout.deliveryMethod,
    carrier: checkout.shipping.carrier,
    shippingService: checkout.shipping.service,
  } as any);

  const itemRows = checkout.items.map((i: any) => ({
    id: uuidv4(),
    orderId,
    productId: String(i.productId),
    productName: String(i.name),
    quantity: i.quantity,
    price: i.unitPrice,
    subtotal: i.lineTotal,
    variantCombinationId: i.combinationId || null,
    variantDescription: toText(i.variantCombination),
    customizationData: toText(i.customizationData),
    engraving: i.engraving ? JSON.stringify(i.engraving) : null,
  }));

  try {
    await db.insert(order_items).values(itemRows as any);
  } catch (e) {
    console.error('❌ INSERT order_items falló:', e);
    await db.delete(orders).where(eq(orders.id, orderId)).catch(() => {});
    throw e;
  }

  // Stock: ya está pagado, así que se descuenta aunque quede en negativo
  // (el negativo es la señal para revisar inventario, no para perder la venta).
  try {
    const { decrementStock } = await import('@/utils/stock');
    await decrementStock(
      checkout.items.map(i => ({ productId: i.productId, quantity: i.quantity, combinationId: i.combinationId ?? null })),
      { allowNegative: true }
    );
  } catch (e) {
    console.error('⚠️ Pedido creado pero no se pudo descontar stock:', orderNumber, e);
  }

  return json({
    id: orderId,
    orderNumber,
    customerEmail,
    clientId: null,
    total: checkout.total,
    message: 'Orden creada exitosamente',
  });
}

// ============================================================
// POS (admin) — misma lógica que antes
// ============================================================

async function handlePosOrder(data: any, session: any) {
  if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
    return json({ error: 'Datos de productos inválidos' }, 400);
  }
  if (data.products.length > 50) {
    return json({ error: 'Demasiados productos en la orden' }, 400);
  }

  // Email: priorizar sesión autenticada (igual que antes)
  const customerEmail = session?.user?.email || data.customerEmail;
  if (!customerEmail) return json({ error: 'Email del cliente es requerido' }, 400);

  // ── Idempotencia ──
  // El POS genera una llave por intento de venta y la manda en cada envío.
  // Si la misma llave llega dos veces (doble clic, reintento por conexión
  // lenta, pestaña duplicada), la segunda devuelve la orden que ya existe en
  // vez de registrar la venta otra vez. El candado del botón en el navegador
  // tapa el caso normal; esto tapa el resto.
  //
  // Se guarda en externalReference, que ya existe y ya está indexado. Mercado
  // Pago usa esa misma columna con su propio formato, así que no se pisan.
  const idempotencyKey = typeof data.idempotencyKey === 'string' && data.idempotencyKey.length >= 8
    ? data.idempotencyKey.slice(0, 64)
    : null;

  // ✅ RECALCULAR TOTAL SERVER-SIDE — no confiar en el cliente
  const productIds: string[] = Array.from(new Set(data.products.map((p: any) => String(p.id)).filter((id: string) => id && id !== 'undefined'))) as string[];
  if (productIds.length === 0) return json({ error: 'No se encontraron productos válidos' }, 400);

  // El carrito manda `variantId`, que en productos de 2+ grupos es en realidad
  // el id de una COMBINACIÓN, y en productos de 1 grupo es el id de una VARIANTE.
  const variantOrComboIds: string[] = Array.from(new Set(
    data.products
      .map((p: any) => p.combinationId || p.variantId)
      .filter((id: any) => id && id !== 'undefined' && id !== 'null')
      .map((id: any) => String(id))
  ));

  // Las cuatro lecturas van juntas: no dependen una de otra y así se paga
  // una sola ida al servidor de base de datos en vez de cuatro seguidas.
  const [existingOrder, dbProducts, dbCombinations, dbVariants] = await Promise.all([
    // ¿Esta misma venta ya se registró? (ver la nota de idempotencia arriba)
    idempotencyKey
      ? db
          .select({ id: orders.id, orderNumber: orders.orderNumber, total: orders.total, clientId: orders.clientId })
          .from(orders)
          .where(eq(orders.externalReference, idempotencyKey))
          .limit(1)
      : Promise.resolve([] as Array<{ id: string; orderNumber: string; total: number; clientId: number | null }>),

    db
      .select({ id: Product.id, price: Product.price, name: Product.name })
      .from(Product)
      .where(inArray(Product.id, productIds)),

    variantOrComboIds.length > 0
      ? db
          .select({ id: ProductVariantCombination.id, price: ProductVariantCombination.price, productId: ProductVariantCombination.productId })
          .from(ProductVariantCombination)
          .where(inArray(ProductVariantCombination.id, variantOrComboIds))
      : Promise.resolve([] as Array<{ id: string; price: number; productId: string }>),

    variantOrComboIds.length > 0
      ? db
          .select({ id: ProductVariant.id, priceAdjustment: ProductVariant.priceAdjustment, productId: ProductVariant.productId })
          .from(ProductVariant)
          .where(inArray(ProductVariant.id, variantOrComboIds))
      : Promise.resolve([] as Array<{ id: string; priceAdjustment: number | null; productId: string }>),
  ]);

  // Llegó dos veces: se devuelve la venta que ya existe, sin crear otra ni
  // volver a descontar stock.
  if (existingOrder.length > 0) {
    const ya = existingOrder[0];
    console.warn('⚠️ Venta POS repetida, se devuelve la original:', ya.orderNumber);
    return json({
      id: ya.id,
      orderNumber: ya.orderNumber,
      customerEmail,
      clientId: ya.clientId,
      total: ya.total,
      duplicate: true,
      message: 'Esta venta ya estaba registrada',
    });
  }

  const dbProductMap = new Map(dbProducts.map(p => [p.id, p]));
  const dbCombinationMap = new Map(dbCombinations.map(c => [c.id, { price: c.price, productId: c.productId }]));
  const dbVariantMap = new Map(dbVariants.map(v => [v.id, { priceAdjustment: v.priceAdjustment ?? 0, productId: v.productId }]));

  let serverSubtotal = 0;
  const validatedItems: Array<{ id: string; name: string; price: number; quantity: number; variantCombinationId?: string | null; variantDescription?: string | null; engraving?: string | null }> = [];

  // Dónde hay que descontar el stock de cada renglón. Se arma aquí, con los
  // mapas que ya se leyeron: antes esto lo resolvía /api/update-stock con un
  // SELECT extra por producto.
  type DescuentoStock = { kind: 'combo' | 'variant' | 'product'; id: string; productId: string; quantity: number };
  const descuentos: DescuentoStock[] = [];

  for (const item of data.products) {
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
    const dbProduct = dbProductMap.get(item.id);
    if (!dbProduct) return json({ error: `Producto no encontrado: ${item.id}` }, 400);

    const variantOrCombo = item.combinationId || item.variantId;
    let realPrice = dbProduct.price;
    if (variantOrCombo && dbCombinationMap.has(variantOrCombo)) {
      realPrice = dbCombinationMap.get(variantOrCombo)!.price;
    } else if (variantOrCombo && dbVariantMap.has(variantOrCombo)) {
      realPrice = dbProduct.price + dbVariantMap.get(variantOrCombo)!.priceAdjustment;
    }

    serverSubtotal += realPrice * quantity;
    validatedItems.push({
      id: item.id,
      name: item.name || dbProduct.name,
      price: realPrice,
      quantity,
      variantCombinationId: (variantOrCombo && dbCombinationMap.has(variantOrCombo)) ? variantOrCombo : null,
      variantDescription: item.variantName || null,
      engraving: item.engraving ? JSON.stringify(item.engraving) : null,
    });

    if (variantOrCombo && dbCombinationMap.has(variantOrCombo)) {
      descuentos.push({ kind: 'combo', id: variantOrCombo, productId: dbCombinationMap.get(variantOrCombo)!.productId, quantity });
    } else if (variantOrCombo && dbVariantMap.has(variantOrCombo)) {
      descuentos.push({ kind: 'variant', id: variantOrCombo, productId: dbVariantMap.get(variantOrCombo)!.productId, quantity });
    } else {
      descuentos.push({ kind: 'product', id: item.id, productId: item.id, quantity });
    }
  }

  const discount = Math.max(0, Math.min(serverSubtotal, Number(data.discount) || 0));
  const additionalCharges = Math.max(0, Math.min(serverSubtotal * 2, Number(data.additionalCharges) || 0));
  const tax = Math.max(0, Number(data.tax) || 0);
  const serverTotal = serverSubtotal + additionalCharges + tax - discount;

  const clientTotal = Number(data.total) || 0;
  if (Math.abs(serverTotal - clientTotal) > AMOUNT_TOLERANCE && import.meta.env.DEV) {
    console.warn(`⚠️ Total mismatch: client=${clientTotal}, server=${serverTotal}`);
  }

  const orderId = uuidv4();
  const orderNumber = `ORD-${Date.now()}`;

  // ── Todas las escrituras, en un solo viaje ──
  //
  // Antes esto eran dos inserts sueltos aquí, y después el navegador llamaba
  // a /api/update-stock (que hacía un SELECT y un UPDATE por renglón, más dos
  // consultas por producto para recalcular el stock base) y, en ventas a
  // crédito, a updateClientBalance. Entre todo, más de veinte idas y vueltas
  // seguidas a la base de datos: eso era la tardanza que reportó la tienda.
  //
  // Ahora va todo en un db.batch, que es una sola petición y además una sola
  // transacción: o se guarda la venta completa con su stock, o no se guarda
  // nada. Antes podía quedar la orden registrada sin descontar stock si el
  // navegador se cerraba entre una llamada y la otra.
  const escrituras: any[] = [];

  escrituras.push(db.insert(orders).values({
    id: orderId,
    orderNumber,
    customerEmail,
    shippingAddress: JSON.stringify(data.shippingAddress || {}),
    subtotal: serverSubtotal,
    tax,
    total: serverTotal,
    paymentMethod: data.paymentMethod || 'Desconocido',
    status: 'completed',
    createdAt: new Date(),
    clientId: data.clientId || null,
    externalReference: idempotencyKey,
  } as any));

  escrituras.push(db.insert(order_items).values(validatedItems.map(item => ({
    id: uuidv4(),
    orderId,
    productId: item.id,
    productName: item.name,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.price * item.quantity,
    variantCombinationId: item.variantCombinationId || null,
    variantDescription: item.variantDescription || null,
    engraving: item.engraving || null,
  })) as any));

  // Stock. El mostrador puede vender aunque quede en negativo: el negativo es
  // la señal para revisar inventario, no para perder la venta.
  // Qué producto se recalcula sumando combinaciones y cuál sumando variantes:
  // si el producto tuvo aunque sea un renglón por combinación, manda esa.
  const resyncPorCombinacion = new Set<string>();
  const resyncPorVariante = new Set<string>();

  for (const d of descuentos) {
    if (d.kind === 'combo') {
      escrituras.push(
        db.update(ProductVariantCombination)
          .set({ stock: sql`${ProductVariantCombination.stock} - ${d.quantity}` } as any)
          .where(eq(ProductVariantCombination.id, d.id)),
      );
      resyncPorCombinacion.add(d.productId);
    } else if (d.kind === 'variant') {
      escrituras.push(
        db.update(ProductVariant)
          .set({ stock: sql`${ProductVariant.stock} - ${d.quantity}` } as any)
          .where(eq(ProductVariant.id, d.id)),
      );
      resyncPorVariante.add(d.productId);
    } else {
      escrituras.push(
        db.update(Product)
          .set({ stock: sql`${Product.stock} - ${d.quantity}` } as any)
          .where(eq(Product.id, d.id)),
      );
    }
  }

  // Product.stock queda como la suma de sus hijos. Va después de los
  // descuentos a propósito: el batch ejecuta en orden, así que la suma ya lee
  // el stock nuevo. Antes esto costaba dos SELECT por producto.
  for (const productId of resyncPorCombinacion) {
    escrituras.push(
      db.update(Product)
        .set({ stock: sql`(SELECT COALESCE(SUM(${ProductVariantCombination.stock}), 0) FROM ${ProductVariantCombination} WHERE ${ProductVariantCombination.productId} = ${productId})` } as any)
        .where(eq(Product.id, productId)),
    );
  }
  for (const productId of resyncPorVariante) {
    if (resyncPorCombinacion.has(productId)) continue;
    escrituras.push(
      db.update(Product)
        .set({ stock: sql`(SELECT COALESCE(SUM(${ProductVariant.stock}), 0) FROM ${ProductVariant} WHERE ${ProductVariant.productId} = ${productId})` } as any)
        .where(eq(Product.id, productId)),
    );
  }

  // Venta a crédito: el saldo del cliente entra en la misma transacción.
  // Si la venta no se guarda, el saldo tampoco se mueve.
  const esCredito = (data.paymentMethod || '') === 'Venta a crédito';
  if (esCredito && data.clientId) {
    escrituras.push(
      db.run(sql`UPDATE client SET saldo_actual = saldo_actual + ${serverTotal} WHERE id = ${Number(data.clientId)}`),
    );
  }

  await db.batch(escrituras as any);

  return json({
    id: orderId,
    orderNumber,
    customerEmail,
    clientId: data.clientId || null,
    total: serverTotal,
    creditBalanceUpdated: esCredito && !!data.clientId,
    message: 'Orden creada exitosamente',
  });
}

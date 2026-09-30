// ============================================================
// src/utils/checkout.ts
//
// El único lugar donde se decide cuánto se cobra en la tienda
// online: productos (precio desde la base) + envío (desde la
// cotización guardada en el servidor). Lo usan Stripe, PayPal,
// Mercado Pago y /api/create-order, así que los cuatro cobran
// exactamente lo mismo.
//
// El navegador solo dice QUÉ compra y QUÉ envío eligió
// (quoteId + paquetería). Nunca cuánto cuesta.
// ============================================================

import { db, eq, lt, ShippingQuote, orders } from 'astro:db';
import { priceItems, type IncomingItem, type PricedItem } from '@/utils/mercadopago-orders';
import { chargedShipping, packageForItems } from '@/utils/shipping';
import { STORE_PICKUP, normalizeDeliveryMethod, type DeliveryMethod } from '@/utils/store';

/** Una cotización vale 2 h en el servidor (el navegador la reutiliza máx. 30 min). */
export const QUOTE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Diferencia máxima aceptada entre montos, por redondeo. */
export const AMOUNT_TOLERANCE = 1;

/** Error con mensaje apto para mostrarle al cliente. */
export class CheckoutError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export interface ShippingSelection {
  quoteId?: string | null;
  carrier?: string | null;
  service?: string | null;
}

export interface ResolvedShipping {
  shippingCost: number;      // lo que paga el cliente
  carrierRate: number;       // lo que cotizó la paquetería
  carrier: string | null;
  service: string | null;
  deliveryDays: number | null;
}

interface StoredRate { carrier: string; service: string; deliveryDays: number; totalPrice: number; }

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Cotizaciones guardadas ───────────────────────────────────

export async function saveQuote(postalCode: string, weight: number, rates: StoredRate[]): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(ShippingQuote).values({
    id,
    postalCode,
    weight,
    rates: JSON.stringify(rates.map(r => ({
      carrier: r.carrier,
      service: r.service,
      deliveryDays: r.deliveryDays,
      totalPrice: r.totalPrice,
    }))),
    createdAt: now,
  } as any); // igual que el resto del repo: los tipos de Astro DB omiten el id de texto

  // Limpieza: las cotizaciones de más de un día ya no sirven para nada.
  await db
    .delete(ShippingQuote)
    .where(lt(ShippingQuote.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))
    .catch(e => console.warn('⚠️ No se pudieron limpiar cotizaciones viejas:', e));

  return id;
}

/**
 * Devuelve el costo real del envío a domicilio a partir de la
 * cotización guardada. Lanza CheckoutError si algo no cuadra.
 */
export async function resolveShipping(args: {
  subtotal: number;
  itemsCount: number;
  selection?: ShippingSelection | null;
  destinationPostalCode?: string | null;
}): Promise<ResolvedShipping> {
  const retry = 'Vuelve a cotizar tu envío antes de pagar.';
  const sel = args.selection;

  if (!sel?.quoteId || !sel.carrier || !sel.service) {
    throw new CheckoutError(`Falta elegir la paquetería. ${retry}`);
  }

  const quote = await db.select().from(ShippingQuote).where(eq(ShippingQuote.id, String(sel.quoteId))).get();
  if (!quote) throw new CheckoutError(`Tu cotización de envío ya no es válida. ${retry}`);

  const age = Date.now() - new Date(quote.createdAt as any).getTime();
  if (!(age >= 0 && age <= QUOTE_MAX_AGE_MS)) {
    throw new CheckoutError(`Tu cotización de envío expiró. ${retry}`);
  }

  // El CP de la dirección debe ser el mismo que se cotizó: si no, se
  // podría cotizar a un CP barato y mandar el paquete a otro lejano.
  const dest = String(args.destinationPostalCode || '').trim();
  if (!/^\d{5}$/.test(dest)) throw new CheckoutError('Falta el código postal de la dirección de envío.');
  if (dest !== quote.postalCode) {
    throw new CheckoutError(
      `El código postal de tu dirección (${dest}) no coincide con el que cotizaste (${quote.postalCode}). ${retry}`
    );
  }

  // Si el carrito creció, el paquete pesa más de lo que se cotizó.
  if (Number(quote.weight) < packageForItems(args.itemsCount).weight) {
    throw new CheckoutError(`Tu carrito cambió desde que cotizaste. ${retry}`);
  }

  let rates: StoredRate[] = [];
  try { rates = JSON.parse(quote.rates); } catch {}
  const rate = rates.find(r => r.carrier === sel.carrier && r.service === sel.service);
  const carrierRate = Number(rate?.totalPrice);
  if (!rate || !(carrierRate > 0)) {
    throw new CheckoutError(`La paquetería elegida ya no está disponible. ${retry}`);
  }

  return {
    shippingCost: chargedShipping(args.subtotal, carrierRate),
    carrierRate,
    carrier: rate.carrier,
    service: rate.service,
    deliveryDays: Number(rate.deliveryDays) || null,
  };
}

// ── Total del pedido ─────────────────────────────────────────

export interface CheckoutInput {
  products: IncomingItem[];
  deliveryMethod?: unknown;
  shipping?: ShippingSelection | null;
  destinationPostalCode?: string | null;
  /** Verificar existencias (antes de cobrar). */
  checkStock?: boolean;
}

export interface CheckoutQuote {
  deliveryMethod: DeliveryMethod;
  items: PricedItem[];
  subtotal: number;
  itemsCount: number;
  shipping: ResolvedShipping;
  total: number;
}

export async function priceCheckout(input: CheckoutInput): Promise<CheckoutQuote> {
  const deliveryMethod = normalizeDeliveryMethod(input.deliveryMethod);
  if (deliveryMethod === 'pickup' && !STORE_PICKUP.enabled) {
    throw new CheckoutError('Recoger en tienda no está disponible por ahora.');
  }
  if (!Array.isArray(input.products) || input.products.length === 0) {
    throw new CheckoutError('El carrito está vacío.');
  }
  if (input.products.length > 50) throw new CheckoutError('Demasiados productos en la orden.');

  let items: PricedItem[];
  try {
    items = await priceItems(input.products);
  } catch (e) {
    throw new CheckoutError(e instanceof Error ? e.message : 'Productos inválidos');
  }

  if (input.checkStock) {
    const { assertAvailable } = await import('@/utils/stock');
    try {
      await assertAvailable(items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        combinationId: i.combinationId ?? null,
      })));
    } catch (e) {
      throw new CheckoutError(e instanceof Error ? e.message : 'Sin existencias suficientes', 409);
    }
  }

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const itemsCount = items.reduce((s, i) => s + i.quantity, 0);

  const shipping: ResolvedShipping = deliveryMethod === 'pickup'
    ? { shippingCost: 0, carrierRate: 0, carrier: null, service: 'Recoger en tienda', deliveryDays: STORE_PICKUP.readyInDays }
    : await resolveShipping({
        subtotal,
        itemsCount,
        selection: input.shipping,
        destinationPostalCode: input.destinationPostalCode,
      });

  return { deliveryMethod, items, subtotal, itemsCount, shipping, total: round2(subtotal + shipping.shippingCost) };
}

/**
 * Productos como los manda CheckoutForm ({ id, quantity, ... })
 * al formato de priceItems ({ productId, ... }). Acota cantidades.
 */
export function toIncomingItems(products: unknown): IncomingItem[] {
  if (!Array.isArray(products)) return [];
  return products.map((p: any) => ({
    productId: String(p?.productId ?? p?.id ?? ''),
    quantity: Math.max(1, Math.min(99, Math.floor(Number(p?.quantity) || 1))),
    combinationId: p?.combinationId || null,
    variantId: p?.variantId || null,
    variantCombination: p?.variantCombination ?? null,
    variantSku: p?.variantSku ?? null,
    customizationData: p?.customizationData ?? undefined,
    // Se conserva para guardarlo en order_items.engraving
    ...(p?.engraving ? { engraving: p.engraving } : {}),
  }));
}

/** Pedido ya registrado con ese id de pago (para no duplicar). */
export async function findOrderByPaymentId(paymentId: string) {
  if (!paymentId) return null;
  return (await db.select().from(orders).where(eq(orders.paymentId, paymentId)).get()) ?? null;
}

export const formatMXN = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

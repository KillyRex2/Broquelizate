// ============================================================
// src/utils/order-emails.ts
//
// Puente entre la base de datos y las plantillas: arma el
// objeto OrderEmailData a partir del id de un pedido.
//
// Así ningún punto de integración tiene que repetir la lógica
// de leer pedido + items + imágenes.
// ============================================================

import { db, eq, inArray, orders, order_items, Product, ProductImage } from 'astro:db';
import type { OrderEmailData } from './email-templates.ts';

export async function buildOrderEmailData(
  orderId: string,
  siteUrl?: string
): Promise<OrderEmailData | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const items = await db.select().from(order_items).where(eq(order_items.orderId, orderId));

  // Imagen de portada de cada producto, para que el correo no se vea plano
  const productIds = [...new Set(items.map(i => i.productId))];
  let imageByProduct = new Map<string, string>();

  if (productIds.length > 0) {
    const [products, images] = await Promise.all([
      db
        .select({ id: Product.id, coverImageId: Product.coverImageId })
        .from(Product)
        .where(inArray(Product.id, productIds)),
      db
        .select({ id: ProductImage.id, productId: ProductImage.productId, image: ProductImage.image })
        .from(ProductImage)
        .where(inArray(ProductImage.productId, productIds)),
    ]);

    const coverById = new Map(products.map((p: any) => [p.id, p.coverImageId]));

    for (const pid of productIds) {
      const own = images.filter((i: any) => i.productId === pid);
      const coverId = coverById.get(pid);
      const chosen = (coverId && own.find((i: any) => i.id === coverId)) || own[0];
      if (!chosen) continue;

      // Los correos necesitan URL absoluta: un /images/... no carga en Gmail.
      const url = chosen.image.startsWith('http')
        ? chosen.image
        : `${siteUrl ?? ''}/images/products/${chosen.image}`;
      imageByProduct.set(pid, url);
    }
  }

  let shippingAddress: OrderEmailData['shippingAddress'] = {};
  try {
    shippingAddress = JSON.parse(order.shippingAddress || '{}');
  } catch {}

  return {
    orderNumber: order.orderNumber,
    customerName: (shippingAddress as any)?.name || order.customerEmail?.split('@')[0] || 'Cliente',
    customerEmail: order.customerEmail,
    items: items.map((it: any) => ({
      name: it.productName,
      quantity: it.quantity,
      price: it.price,
      variant: it.variantDescription,
      image: imageByProduct.get(it.productId) ?? null,
    })),
    subtotal: order.subtotal,
    shippingCost: order.shippingCost ?? 0,
    total: order.total,
    paymentMethod: order.paymentMethod,
    shippingAddress,
    trackingNumber: order.trackingNumber,
    carrier: order.carrier,
    siteUrl,
  };
}


// ============================================================
// Disparadores
//
// Estas dos funciones son el único punto por el que salen los correos de un
// pedido. Antes esto era un comentario con instrucciones de "pega esto aquí"
// que nunca se pegó: el módulo estaba completo y no lo llamaba nadie, así que
// la tienda llevaba meses cobrando sin avisarle a nadie, ni al cliente ni a
// la tienda.
//
// Tres reglas que las dos cumplen:
//
//   1. NUNCA lanzan. El cliente ya pagó; que falle un correo no puede tirar
//      la venta ni devolver un 500 al navegador.
//   2. NUNCA se mandan desde el mostrador. En el POS el correo del pedido es
//      el de la cuenta admin (sale de la sesión), así que mandar "gracias por
//      tu compra" sería escribirle a la dueña por cada venta de mostrador. El
//      cliente de mostrador se lleva su ticket impreso.
//   3. Tienen tope de tiempo. Ver TOPE_MS.
// ============================================================

/**
 * Cuánto se espera a que salga el correo antes de seguir adelante.
 *
 * El compromiso es real y conviene tenerlo escrito: esto corre dentro de una
 * función de Netlify, que se congela en cuanto se devuelve la respuesta. No
 * se puede mandar el correo "en segundo plano" después de responder, porque
 * no habría después. Entonces o se espera, o no se manda.
 *
 * Seis segundos: Resend normalmente tarda menos de uno, así que el tope solo
 * salta cuando algo va mal de verdad, y en ese caso vale más devolverle la
 * página al cliente que ya pagó que dejarlo mirando un spinner. Cuando salta,
 * el correo probablemente se pierde — por eso queda anotado en consola con
 * el número de pedido, para poder reenviarlo a mano.
 */
const TOPE_MS = 6000;

async function conTope<T>(tarea: Promise<T>, etiqueta: string): Promise<T | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<null>(resolver => {
    reloj = setTimeout(() => {
      console.error(`⏱️ ${etiqueta}: se acabó el tiempo (${TOPE_MS} ms). Puede no haber salido.`);
      resolver(null);
    }, TOPE_MS);
  });
  try {
    return await Promise.race([tarea, limite]);
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}

interface AvisoArgs {
  orderId: string;
  /** Para que las imágenes del correo lleven URL absoluta. */
  siteUrl?: string;
  /** true = venta de mostrador: no se manda nada. */
  esMostrador?: boolean;
}

/**
 * Confirmación al cliente + aviso de venta nueva al negocio.
 * Se llama UNA vez, en la transición a pagado.
 */
export async function notificarCompra({ orderId, siteUrl, esMostrador }: AvisoArgs): Promise<void> {
  if (esMostrador) return;
  try {
    const datos = await buildOrderEmailData(orderId, siteUrl);
    if (!datos) {
      console.error('⚠️ No se encontró el pedido para avisar por correo:', orderId);
      return;
    }
    const { sendPurchaseEmails } = await import('@/utils/email');
    await conTope(sendPurchaseEmails(datos), `Correos de la compra ${datos.orderNumber}`);
  } catch (e) {
    console.error('❌ Fallaron los correos de la compra (la venta sigue bien):', orderId, e);
  }
}

/** Aviso al cliente de que su pedido va en camino, con número de rastreo. */
export async function notificarEnvio({ orderId, siteUrl }: AvisoArgs): Promise<void> {
  try {
    const datos = await buildOrderEmailData(orderId, siteUrl);
    if (!datos?.trackingNumber) {
      console.error('⚠️ Sin guía guardada: no se avisa del envío.', orderId);
      return;
    }
    const { sendShippingNotification } = await import('@/utils/email');
    await conTope(sendShippingNotification(datos), `Aviso de envío ${datos.orderNumber}`);
  } catch (e) {
    console.error('❌ Falló el aviso de envío (la guía ya está generada):', orderId, e);
  }
}

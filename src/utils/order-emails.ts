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


/* ============================================================
   PUNTOS DE INTEGRACIÓN
   ============================================================

   ── 1. Mercado Pago ──
   En src/utils/mercadopago-orders.ts, dentro de
   confirmOrderByReference, ANTES del return final:

     // Correos: solo en la transición pending → paid.
     // Si el webhook y el retorno confirman los dos, el segundo
     // sale por el early-return de arriba y no se duplica el envío.
     try {
       const { buildOrderEmailData } = await import('@/utils/order-emails');
       const { sendPurchaseEmails } = await import('@/utils/email');
       const data = await buildOrderEmailData(order.id, import.meta.env.PUBLIC_SITE_URL);
       if (data) await sendPurchaseEmails(data);
     } catch (e) {
       console.error('❌ Correos del pedido fallaron (la venta sigue OK):', e);
     }

     return { ok: true, alreadyPaid: false, orderId: order.id, orderNumber: order.orderNumber };


   ── 2. Stripe y PayPal ──
   En src/pages/api/create-order.ts, justo antes de devolver la
   respuesta de éxito:

     try {
       const { buildOrderEmailData } = await import('@/utils/order-emails');
       const { sendPurchaseEmails } = await import('@/utils/email');
       const data = await buildOrderEmailData(orderId, new URL(request.url).origin);
       if (data) await sendPurchaseEmails(data);
     } catch (e) {
       console.error('❌ Correos del pedido fallaron:', e);
     }


   ── 3. Guía de envío ──
   En src/actions/envia/envia.action.ts, dentro de
   createShippingLabel, después de guardar el trackingNumber:

     try {
       const { buildOrderEmailData } = await import('@/utils/order-emails');
       const { sendShippingNotification } = await import('@/utils/email');
       const data = await buildOrderEmailData(orderId, import.meta.env.PUBLIC_SITE_URL);
       if (data) await sendShippingNotification(data);
     } catch (e) {
       console.error('❌ Correo de envío falló:', e);
     }


   ── Variables de entorno ──
     RESEND_API_KEY=re_xxxxxxxx
     EMAIL_FROM=Broquelizate <pedidos@tudominio.com>
     EMAIL_ADMIN=broquelizatelaguna@gmail.com

   Sin dominio verificado en Resend, usa el remitente de prueba:
     EMAIL_FROM=Broquelizate <onboarding@resend.dev>
   pero ojo: SOLO envía a la dirección con la que te registraste
   en Resend. Para enviar a clientes reales hay que verificar el
   dominio con los registros DNS que Resend indica.
   ============================================================ */
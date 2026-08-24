// ============================================================
// src/pages/api/create-mercadopago-preference.ts
//
// Cambios frente a la versión anterior:
//   1. Los precios se recalculan desde la base. El navegador ya
//      no decide cuánto se cobra.
//   2. El pedido se crea como 'pending' antes de redirigir, con
//      su externalReference. Así el webhook puede confirmarlo
//      aunque el cliente nunca regrese al sitio.
//   3. Sirve igual para la tienda y para el POS (channel).
// ============================================================

import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { priceItems, createPendingOrder, type IncomingItem } from '@/utils/mercadopago-orders';

interface PreferenceRequest {
  products: Array<IncomingItem & { name?: string; image?: string }>;
  shippingCost?: number;
  customerEmail: string;
  customerName?: string;
  phone?: string;
  shippingAddress?: Record<string, unknown>;
  shippingInfo?: Record<string, unknown> | null;
  clientId?: number | null;
  channel?: 'online' | 'pos';
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const accessToken = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('❌ MERCADOPAGO_ACCESS_TOKEN no está configurada');
    return json({ error: 'Mercado Pago no está configurado correctamente' }, 500);
  }

  const rawSiteUrl =
    import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || new URL(request.url).origin;
  const siteUrl = rawSiteUrl.replace(/\/+$/, '');
  const isLocal = /localhost|127\.0\.0\.1/.test(siteUrl);

  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });

  try {
    const body: PreferenceRequest = await request.json();
    const channel = body.channel === 'pos' ? 'pos' : 'online';

    if (!Array.isArray(body.products) || body.products.length === 0) {
      return json({ error: 'No hay productos en el carrito' }, 400);
    }
    if (!body.customerEmail) {
      return json({ error: 'El email del cliente es requerido' }, 400);
    }

    // ── 1. Precios reales, desde la base ──
    const priced = await priceItems(body.products);
    const shippingCost = Math.max(0, Number(body.shippingCost) || 0);
    const subtotal = priced.reduce((s, i) => s + i.lineTotal, 0);
    const total = subtotal + shippingCost;

    if (total <= 0) return json({ error: 'El total debe ser mayor a 0' }, 400);

    // ── 2. Pedido pendiente ──
    const externalReference = crypto.randomUUID();

    const order = await createPendingOrder({
      externalReference,
      items: priced,
      shippingCost,
      customerEmail: body.customerEmail,
      customerName: body.customerName || body.customerEmail,
      shippingAddress: body.shippingAddress ?? {},
      shippingInfo: body.shippingInfo ?? null,
      clientId: body.clientId ?? null,
      channel,
    });

    // ── 3. Preferencia ──
    const imageByProduct = new Map(
      body.products.map(p => [p.productId, (p as any).image as string | undefined])
    );

    const items = priced.map(p => ({
      id: p.productId,
      title: (p.name || 'Producto').substring(0, 250),
      description: p.variantCombination ? String(p.variantCombination).substring(0, 250) : undefined,
      picture_url: imageByProduct.get(p.productId) || undefined,
      category_id: 'fashion',
      quantity: p.quantity,
      currency_id: 'MXN',
      unit_price: p.unitPrice,
    }));

    // En el POS el cliente escanea un QR: al terminar debe caer en una
    // página simple de "listo", no en el checkout de la tienda.
    const backBase = channel === 'pos' ? `${siteUrl}/pago-listo` : `${siteUrl}/checkout/retorno-mp`;

    const result = await new Preference(client).create({
      body: {
        items,
        shipments:
          shippingCost > 0 ? { cost: shippingCost, mode: 'not_specified' } : undefined,
        payer: {
          name: body.customerName || undefined,
          email: body.customerEmail,
          phone: body.phone ? { number: String(body.phone) } : undefined,
        },
        back_urls: {
          success: backBase,
          pending: backBase,
          failure: channel === 'pos' ? backBase : `${siteUrl}/checkout?mp=failure`,
        },
        ...(isLocal ? {} : { auto_return: 'approved' }),
        external_reference: externalReference,
        notification_url: `${siteUrl}/api/mercadopago-webhook`,
        statement_descriptor: 'BROQUELIZATE',
        metadata: {
          external_reference: externalReference,
          order_id: order.orderId,
          order_number: order.orderNumber,
          channel,
        },
      },
    });

    console.log('✅ Preference creada:', {
      id: result.id,
      externalReference,
      orderNumber: order.orderNumber,
      total,
    });

    return json({
      id: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
      externalReference,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      total,
    });
  } catch (error: any) {
    console.error('❌ Error MP:', error?.message, error?.cause ?? '');
    return json({ error: error?.message || 'Error al crear la preferencia' }, 500);
  }
};
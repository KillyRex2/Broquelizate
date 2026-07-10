// src/pages/api/create-mercadopago-preference.ts
import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Preference } from 'mercadopago';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variantCombination?: string | null;
  variantSku?: string | null;
}

interface ShippingInfo {
  carrier: string;
  service: string;
  price: number;
  deliveryDays: number;
}

interface PreferenceRequest {
  products: Product[];
  subtotal: number;
  shippingCost: number;
  total: number;
  customerEmail: string;
  customerName: string;
  phone?: string;
  shippingInfo: ShippingInfo | null;
}

export const POST: APIRoute = async ({ request }) => {
  const accessToken = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('❌ MERCADOPAGO_ACCESS_TOKEN no está configurada');
    return new Response(
      JSON.stringify({ error: 'Mercado Pago no está configurado correctamente' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Base pública del sitio (para back_urls y notification_url).
  const rawSiteUrl =
    import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || new URL(request.url).origin;
  const siteUrl = rawSiteUrl.replace(/\/+$/, ''); // sin slash final

  // MP rechaza auto_return si las back_urls apuntan a localhost
  const isLocal = /localhost|127\.0\.0\.1/.test(siteUrl);

  const client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 8000 },
  });

  try {
    const body: PreferenceRequest = await request.json();
    const {
      products,
      shippingCost,
      total,
      customerEmail,
      customerName,
      phone,
    } = body;

    // Validaciones
    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay productos en el carrito' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (typeof total !== 'number' || total <= 0) {
      return new Response(JSON.stringify({ error: 'El total debe ser mayor a 0' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'El email del cliente es requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Referencia única para correlacionar el pago con el pedido en el retorno y el webhook.
    const externalReference = crypto.randomUUID();

    const items = products.map((p) => ({
      id: p.id || externalReference,
      title: (p.name || 'Producto').substring(0, 250),
      description: p.variantCombination ? String(p.variantCombination).substring(0, 250) : undefined,
      picture_url: p.image || undefined,
      category_id: 'fashion', // joyería / accesorios
      quantity: Number(p.quantity) || 1,
      currency_id: 'MXN',
      unit_price: Number(p.price) || 0,
    }));

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items,
        // El envío se suma al total como costo de shipment (no como item).
        shipments:
          shippingCost && shippingCost > 0
            ? { cost: Number(shippingCost), mode: 'not_specified' }
            : undefined,
        payer: {
          name: customerName || undefined,
          email: customerEmail,
          phone: phone ? { number: String(phone) } : undefined,
        },
        back_urls: {
          success: `${siteUrl}/checkout/retorno-mp`,
          pending: `${siteUrl}/checkout/retorno-mp`,
          failure: `${siteUrl}/checkout?mp=failure`,
        },
        ...(isLocal ? {} : { auto_return: 'approved' }),
        external_reference: externalReference,
        notification_url: `${siteUrl}/api/mercadopago-webhook`,
       
        // metadata propia (visible en el pago, útil para el webhook)
        metadata: {
          external_reference: externalReference,
          customer_email: customerEmail,
        },
      },
    });

    console.log('✅ Preference creada:', {
      id: result.id,
      externalReference,
    });

    return new Response(
      JSON.stringify({
        id: result.id,
        initPoint: result.init_point,
        sandboxInitPoint: result.sandbox_init_point,
        externalReference,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error MP completo:', JSON.stringify(error, null, 2));
    console.error('❌ cause:', error?.cause);
    return new Response(
        JSON.stringify({ error: error?.message || 'Error', cause: error?.cause }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
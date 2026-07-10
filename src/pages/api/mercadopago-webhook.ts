// src/pages/api/mercadopago-webhook.ts
import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Webhook de Mercado Pago. MP lo llama cuando cambia el estado de un pago.
// Es el respaldo confiable: si el comprador cierra la pestaña después de pagar
// (o paga después en OXXO/SPEI), la página de retorno no se ejecuta, pero el
// webhook sí. Por eso aquí debería vivir, a futuro, la confirmación definitiva
// del pedido.
//
// IMPORTANTE: responde 200 rápido. Si tardas o devuelves error, MP reintenta.
export const POST: APIRoute = async ({ request, url }) => {
  const accessToken = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;

  try {
    // MP manda la notificación de dos formas según el tipo: query params y/o body.
    let type = url.searchParams.get('type') || url.searchParams.get('topic');
    let dataId = url.searchParams.get('data.id') || url.searchParams.get('id');

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      // algunas notificaciones llegan sin body JSON
    }
    if (!type && body?.type) type = body.type;
    if (!dataId && body?.data?.id) dataId = String(body.data.id);

    console.log('🔔 Webhook MP recibido:', { type, dataId });

    if (type === 'payment' && dataId && accessToken) {
      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
      const payment = await new Payment(client).get({ id: dataId });

      const externalReference = payment.external_reference;
      const status = payment.status; // approved | pending | rejected ...

      console.log('🔔 Estado del pago:', { id: payment.id, status, externalReference });

      // TODO (cuando tengas listo el flujo server-side de la orden):
      //  - Buscar el pedido por externalReference en tu base (Turso/Astro DB).
      //  - Si status === 'approved' y el pedido aún no está pagado:
      //      marcarlo como pagado / crearlo (idempotente por externalReference
      //      para no duplicar con la página de retorno).
      //  - Si status === 'rejected'/'cancelled': marcar el pedido en consecuencia.
      // De momento la creación del pedido la hace /checkout/retorno-mp.
    }

    // Siempre 200 para que MP no reintente innecesariamente.
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error en webhook MP:', error);
    // Aun ante error devolvemos 200 para evitar tormenta de reintentos;
    // los errores quedan logueados para revisión.
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
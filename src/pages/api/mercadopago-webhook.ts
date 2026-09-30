// ============================================================
// src/pages/api/mercadopago-webhook.ts
//
// Ahora sí confirma el pedido. Es el camino confiable: OXXO y
// SPEI se pagan después, y el cliente puede no volver nunca al
// sitio. confirmOrderByReference es idempotente, así que no
// importa si el retorno del navegador llega también.
//
// Sigue respondiendo 200 siempre: si devuelves error, MP
// reintenta en bucle.
// ============================================================

import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { confirmOrderByReference, failOrderByReference } from '@/utils/mercadopago-orders';

const ok = () =>
  new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, url }) => {
  const accessToken = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;

  try {
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

    console.log('🔔 Webhook MP:', { type, dataId });

    if (type !== 'payment' || !dataId || !accessToken) return ok();

    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
    const payment = await new Payment(client).get({ id: dataId });

    const externalReference = payment.external_reference;
    const status = payment.status;

    console.log('🔔 Pago:', { id: payment.id, status, externalReference });

    if (!externalReference) return ok();

    if (status === 'approved') {
      const res = await confirmOrderByReference(externalReference, payment.id);
      console.log(
        res.ok
          ? `✅ Pedido ${res.orderNumber} ${res.alreadyPaid ? 'ya estaba pagado' : 'confirmado'}`
          : `⚠️ Sin pedido para la referencia ${externalReference}`
      );
    } else if (status === 'rejected' || status === 'cancelled') {
      await failOrderByReference(externalReference, status);
    }
    // pending / in_process: se deja en pending, ya llegará otra notificación

    return ok();
  } catch (error) {
    console.error('❌ Error en webhook MP:', error);
    return ok();
  }
};


/* ============================================================
   src/pages/api/mercadopago-order-status.ts  ← ARCHIVO NUEVO
   
   El POS pregunta aquí cada pocos segundos si el cliente ya pagó.
   Consulta la base, no a MP: la base ya la actualizó el webhook,
   y así no se gasta la cuota de la API de MP con el polling.
   ============================================================

import type { APIRoute } from 'astro';
import { getOrderStatusByReference } from '@/utils/mercadopago-orders';

export const GET: APIRoute = async ({ url }) => {
  const ref = url.searchParams.get('ref');
  if (!ref) {
    return new Response(JSON.stringify({ error: 'Falta ref' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const order = await getOrderStatusByReference(ref);
  if (!order) {
    return new Response(JSON.stringify({ error: 'No encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(order), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
*/
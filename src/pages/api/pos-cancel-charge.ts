// ============================================================
// src/pages/api/pos-cancel-charge.ts
//
// Cancela un cobro de Mercado Pago iniciado en el POS.
//
// Antes el botón "Cancelar" solo escondía el panel: la orden se quedaba en
// 'pending' y el QR seguía siendo pagable. Si alguien lo pagaba después, el
// webhook confirmaba la orden y descontaba stock de una venta que el cajero
// ya había dado por cancelada.
//
// Esto marca la orden como 'cancelled'. A partir de ahí
// confirmOrderByReference se niega a confirmarla y el inventario no se toca.
// ============================================================

import type { APIRoute } from 'astro';
import { failOrderByReference, getOrderStatusByReference } from '@/utils/mercadopago-orders';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  // Cancelar un cobro es una operación de caja: solo admin.
  // El middleware resuelve locals.isAdmin en todas las rutas, /api incluida.
  if (!(locals as any)?.isAdmin) {
    return json({ error: 'No autorizado' }, 403);
  }

  let externalReference = '';
  try {
    const body = await request.json();
    externalReference = String(body?.externalReference || '').trim();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  if (!externalReference) return json({ error: 'Falta la referencia del cobro' }, 400);

  const order = await getOrderStatusByReference(externalReference);
  if (!order) return json({ error: 'No encontramos ese cobro' }, 404);

  // Si el cliente ya pagó, cancelar sería mentirle al inventario y al corte
  // de caja. Se rechaza y el POS avisa al cajero.
  if (order.status === 'paid') {
    return json({
      error: 'Este cobro ya fue pagado. No se puede cancelar desde aquí.',
      alreadyPaid: true,
      orderNumber: order.orderNumber,
    }, 409);
  }

  await failOrderByReference(externalReference, 'cancelled');
  console.log(`🚫 Cobro cancelado en el POS: ${order.orderNumber} (${externalReference})`);

  return json({ ok: true, orderNumber: order.orderNumber });
};

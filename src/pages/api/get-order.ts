// src/pages/api/get-order.ts
//
// Pedido completo, para herramientas de admin.
//
// Antes esto era público y devolvía la fila entera de la orden —correo del
// cliente, dirección, total, id de pago, número de guía— a quien llegara
// con el order_id en la URL. Lo usaba order-success.astro, que corre en el
// servidor y por lo tanto nunca necesitó pasar por HTTP: ahora llama
// directo a getOrderDetails() y este endpoint se cerró.
//
// Si algún día hace falta que el cliente consulte su propio pedido desde el
// navegador, no basta con reabrirlo: hay que comprobar que la sesión sea la
// dueña del pedido, o mandarle un enlace firmado que caduque.

import type { APIRoute } from 'astro';
import { getOrderDetails } from '@/utils/order-details';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ request, locals }) => {
  if (!(locals as any)?.isAdmin) {
    return json({ error: 'No autorizado' }, 401);
  }

  try {
    const orderId = new URL(request.url).searchParams.get('order_id');
    if (!orderId) return json({ error: 'Falta el parámetro order_id' }, 400);

    const detalle = await getOrderDetails(orderId);
    if (!detalle) return json({ error: 'Orden no encontrada' }, 404);

    return json(detalle);
  } catch (error) {
    console.error('Error obteniendo la orden:', error);
    return json({ error: 'Error al obtener la orden' }, 500);
  }
};

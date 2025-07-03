import { db, orders, order_items } from 'astro:db';
import { eq } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');
    
    if (!orderId) {
      return new Response(JSON.stringify({
        error: 'Falta el parámetro order_id'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Buscar la orden principal
    const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
    
    if (!order) {
      return new Response(JSON.stringify({
        error: 'Orden no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Buscar los items de la orden
    const items = await db.select().from(order_items).where(eq(order_items.orderId, orderId)).all();

    return new Response(JSON.stringify({
      ...order,
      items
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Error al obtener la orden'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
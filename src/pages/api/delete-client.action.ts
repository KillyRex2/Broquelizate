import { db, Client, orders, eq, sql } from 'astro:db';
import type { APIRoute } from 'astro';

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // Solo admin (antes bastaba con tener sesión)
    if (!(locals as any)?.isAdmin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const id = formData.get('id');

    if (!id || isNaN(Number(id))) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const clientId = Number(id);

    const [client] = await db.select().from(Client).where(eq(Client.id, clientId));
    if (!client) return json({ error: 'Cliente no encontrado' }, 404);

    // Con saldo pendiente se perdería lo que debe
    if (Math.abs(Number(client.saldo_actual) || 0) > 0.009) {
      return json({
        error: `${client.nombre} tiene un saldo de $${Number(client.saldo_actual).toFixed(2)}. Liquídalo o ajústalo a $0 antes de eliminarlo.`,
      }, 409);
    }

    // Las ventas apuntan al cliente (clave foránea): no se puede borrar sin romperlas
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.clientId, clientId));
    if (Number(count) > 0) {
      return json({
        error: `${client.nombre} tiene ${count} venta${Number(count) === 1 ? '' : 's'} registrada${Number(count) === 1 ? '' : 's'}, así que no se puede eliminar sin perder ese historial.`,
      }, 409);
    }

    const result = await db.delete(Client).where(eq(Client.id, clientId));

    if (result.rowsAffected === 0) {
      return new Response(JSON.stringify({ error: 'Cliente no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
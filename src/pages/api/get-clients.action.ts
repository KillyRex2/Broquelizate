import { db, Client } from 'astro:db';
import type { APIRoute } from 'astro';
export const GET: APIRoute = async ({ locals }) => {
  try {
    // Solo admin (antes bastaba con tener sesión)
    if (!(locals as any)?.isAdmin) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const clients = await db.select().from(Client);
    const sortedClients = clients.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return new Response(JSON.stringify(sortedClients), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
import { db, Client } from 'astro:db';
import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';

export const GET: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const clients = await db.select().from(Client);
    const sortedClients = clients.sort((a, b) => a.nombre.localeCompare(b.nombre));

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
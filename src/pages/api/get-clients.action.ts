import { db, Client } from 'astro:db';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    // Obtener todos los clientes de la base de datos
    const clients = await db.select().from(Client);
    
    // Ordenar por nombre
    const sortedClients = clients.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    return new Response(JSON.stringify(sortedClients), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo clientes:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};
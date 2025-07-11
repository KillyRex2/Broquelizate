// src/pages/api/delete-client.action.ts
import { db, Client, eq } from 'astro:db';
import type { APIRoute } from 'astro';

export const DELETE: APIRoute = async ({ request }) => {
  try {
    // Obtener el ID del cliente a eliminar
    const formData = await request.formData();
    const id = formData.get('id');
    
    // Validar ID
    if (!id || isNaN(Number(id))) {
      return new Response('ID de cliente inválido', { status: 400 });
    }
    
    const clientId = Number(id);
    
    // Eliminar el cliente de la base de datos usando eq() para la comparación
    const result = await db.delete(Client).where(eq(Client.id, clientId));
    
    // Verificar si se eliminó algún registro
    if (result.rowsAffected === 0) {
      return new Response('Cliente no encontrado', { status: 404 });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('Error eliminando cliente:', error);
    return new Response('Error interno del servidor', { status: 500 });
  }
};
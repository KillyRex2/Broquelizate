// src/pages/api/create-client.action.ts
import { db, Client } from 'astro:db';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Obtener datos del formulario
    const formData = await request.formData();
    
    // Extraer y validar datos
    const nombre = formData.get('nombre');
    if (!nombre || typeof nombre !== 'string') {
      return new Response('Nombre es requerido', { status: 400 });
    }

    const clave_elector = formData.get('clave_elector');
    const saldo_actual = formData.get('saldo_actual');
    const observaciones = formData.get('observaciones');
    const telefono = formData.get('telefono');

    // Convertir y validar saldo
    const saldo = saldo_actual ? parseFloat(saldo_actual.toString()) : 0.0;
    if (isNaN(saldo) || saldo < 0) {
      return new Response('Saldo debe ser un número positivo', { status: 400 });
    }

    // Crear objeto con tipo explícito (AHORA INCLUYE createdAt)
    const clientData: {
      nombre: string;
      saldo_actual: number;
      createdAt: Date; // Nuevo campo añadido
      clave_elector?: string;
      observaciones?: string;
      telefono?: string;
    } = {
      nombre: nombre.toString(),
      saldo_actual: saldo,
      createdAt: new Date() // Fecha actual del servidor
    };

    // Añadir campos opcionales
    if (clave_elector) clientData.clave_elector = clave_elector.toString();
    if (observaciones) clientData.observaciones = observaciones.toString();
    if (telefono) clientData.telefono = telefono.toString();

    console.log("Insertando cliente con datos:", clientData);

    // Insertar en la base de datos
    const [newClient] = await db.insert(Client).values(clientData).returning();

    console.log("Cliente creado exitosamente:", newClient);

    // Retornar respuesta exitosa
    return new Response(JSON.stringify(newClient), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error: any) {
    console.error('Error completo:', error);
    
    // Manejar errores específicos
    if (error.message.includes('UNIQUE constraint failed: Client.clave_elector')) {
      return new Response('Clave de elector ya existe', { status: 409 });
    }
    
    // Manejar otros errores
    return new Response('Error interno del servidor: ' + error.message, { status: 500 });
  }
};
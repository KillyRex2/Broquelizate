// src/pages/api/create-client.action.ts
import { db, Client } from 'astro:db';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  // Solo admin (antes no tenía ninguna protección)
  if (!(locals as any)?.isAdmin) {
    return new Response('No autorizado', { status: 403 });
  }
  try {
    // Obtener datos del formulario
    const formData = await request.formData();
    
    // Extraer y validar datos
    // Texto sin espacios sobrantes; vacío = no enviado
    const text = (key: string) => {
      const v = formData.get(key);
      return typeof v === 'string' && v.trim() ? v.trim() : '';
    };

    const nombre = text('nombre');
    if (nombre.length < 3) {
      return new Response('El nombre es requerido (mínimo 3 letras)', { status: 400 });
    }

    // La clave de elector se guarda en mayúsculas: así "abc123" y "ABC123" cuentan como la misma
    const clave_elector = text('clave_elector').toUpperCase();
    const saldo_actual = text('saldo_actual');
    const observaciones = text('observaciones');
    const telefono = text('telefono');

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
      nombre,
      saldo_actual: saldo,
      createdAt: new Date() // Fecha actual del servidor
    };

    // Añadir campos opcionales
    if (clave_elector) clientData.clave_elector = clave_elector;
    if (observaciones) clientData.observaciones = observaciones;
    if (telefono) clientData.telefono = telefono;

    // Insertar en la base de datos
    const [newClient] = await db.insert(Client).values(clientData).returning();


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
    if (String(error?.message).includes('UNIQUE constraint failed')) {
      return new Response('Ya existe un cliente con esa clave de elector', { status: 409 });
    }

    return new Response('No se pudo crear el cliente. Intenta de nuevo.', { status: 500 });
  }
};
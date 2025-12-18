// src/pages/api/update-profile.ts
import { db, User } from 'astro:db';
import { eq } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Verificar autenticación
    const user = locals.user;
    if (!user || !user.email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No autenticado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { name, phone, shippingAddress } = body;

    // Preparar datos para actualizar
    const updateData: Record<string, any> = {
      updatedAt: new Date()
    };

    if (name !== undefined) {
      if (!name || name.trim().length < 2) {
        return new Response(JSON.stringify({
          success: false,
          error: 'El nombre debe tener al menos 2 caracteres'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updateData.name = name.trim();
    }

    if (phone !== undefined) {
      // Validar formato de teléfono (10 dígitos para México)
      const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
      if (cleanPhone && cleanPhone.length !== 10) {
        return new Response(JSON.stringify({
          success: false,
          error: 'El teléfono debe tener 10 dígitos'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updateData.phone = cleanPhone || null;
    }

    if (shippingAddress !== undefined) {
      // Validar campos requeridos de dirección
      if (shippingAddress) {
        const { streetAddress, colony, city, state, postalCode } = shippingAddress;
        
        if (!streetAddress || !city || !state || !postalCode) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Todos los campos de dirección son requeridos'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Validar código postal (5 dígitos para México)
        if (!/^\d{5}$/.test(postalCode)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'El código postal debe tener 5 dígitos'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        updateData.shippingAddress = JSON.stringify({
          streetAddress: streetAddress.trim(),
          colony: colony?.trim() || '',
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim()
        });
      } else {
        updateData.shippingAddress = null;
      }
    }

    // Actualizar en la base de datos usando email
    await db
      .update(User)
      .set(updateData)
      .where(eq(User.email, user.email));

    return new Response(JSON.stringify({
      success: true,
      message: 'Perfil actualizado correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error actualizando perfil:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al actualizar el perfil'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

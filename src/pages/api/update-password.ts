// src/pages/api/update-password.ts
import { db, User } from 'astro:db';
import { eq } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import bcrypt from 'bcryptjs';

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
    const { currentPassword, newPassword } = body;

    // Validar campos requeridos
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Todos los campos son requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar longitud de nueva contraseña
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({
        success: false,
        error: 'La nueva contraseña debe tener al menos 8 caracteres'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener usuario actual con contraseña usando email
    const currentUser = await db
      .select()
      .from(User)
      .where(eq(User.email, user.email))
      .get();

    if (!currentUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Usuario no encontrado'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isValidPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'La contraseña actual es incorrecta'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);
    if (isSamePassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'La nueva contraseña debe ser diferente a la actual'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar en la base de datos usando email
    await db
      .update(User)
      .set({
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(User.email, user.email));

    return new Response(JSON.stringify({
      success: true,
      message: 'Contraseña actualizada correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error actualizando contraseña:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error al actualizar la contraseña'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

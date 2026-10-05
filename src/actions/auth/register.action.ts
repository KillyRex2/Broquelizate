// src/actions/auth/registerUser.ts
import { defineAction, ActionError } from 'astro:actions';
import { db, User, eq, sql, Role } from 'astro:db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

// Validación de contraseña con mensajes detallados
const passwordSchema = z.string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
  .regex(/\d/, 'La contraseña debe contener al menos un número');

export const registerUser = defineAction({
  accept: 'form',
  input: z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().trim().toLowerCase().email('Por favor ingresa un email válido'),
    password: passwordSchema
  }),
  // Los errores se lanzan como ActionError: un Error normal llega al
  // navegador como "Internal server error" en producción y el cliente no
  // sabía por qué no se creaba su cuenta.
  handler: async ({ name, email, password }) => {
    // 1. Verificar si el rol 'client' existe
    const userRole = await db
      .select()
      .from(Role)
      .where(eq(Role.name, 'client'))
      .get();

    if (!userRole) {
      console.error("Registro: no existe el rol 'client' en la tabla Role");
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error en la configuración del sistema. Por favor contacta al soporte.' });
    }

    // 2. Comprobar si el usuario ya existe (sin distinguir mayúsculas)
    const existingUser = await db
      .select({ id: User.id })
      .from(User)
      .where(sql`lower(${User.email}) = ${email}`)
      .get();

    if (existingUser) {
      throw new ActionError({ code: 'CONFLICT', message: 'Este correo ya está registrado. Inicia sesión o usa otro correo.' });
    }

    try {

      // 3. Hashear la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Crear el nuevo usuario
      await db.insert(User).values({
        id: randomUUID(),
        name,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        rol: userRole.id
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error en registro:', error);
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Ocurrió un error inesperado al crear tu cuenta. Intenta de nuevo.' });
    }
  },
});
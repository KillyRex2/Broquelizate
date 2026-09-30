// src/actions/auth/registerUser.ts
import { defineAction } from 'astro:actions';
import { db, User, eq, Role } from 'astro:db';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

// Validación de contraseña con mensajes detallados
const passwordSchema = z.string()
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
  .regex(/\d/, 'La contraseña debe contener al menos un número');

export const registerUser = defineAction({
  accept: 'form',
  input: z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('Por favor ingresa un email válido'),
    password: passwordSchema
  }),
  handler: async ({ name, email, password }) => {
    try {
      // 1. Verificar si el rol 'client' existe
      const userRole = await db
        .select()
        .from(Role)
        .where(eq(Role.name, 'client'))
        .get();

      if (!userRole) {
        throw new Error('No se pudo encontrar el rol de cliente en la base de datos');
      }

      // 2. Comprobar si el usuario ya existe
      const existingUser = await db
        .select()
        .from(User)
        .where(eq(User.email, email))
        .get();

      if (existingUser) {
        throw new Error('Este correo electrónico ya está registrado');
      }

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
      
      // Mensajes de error personalizados para diferentes casos
      if (error.message.includes('correo electrónico')) {
        throw new Error('Este correo ya está registrado. Por favor usa otro email.');
      }
      
      if (error.message.includes('contraseña')) {
        throw new Error(error.message);
      }
      
      if (error.message.includes('rol')) {
        throw new Error('Error en la configuración del sistema. Por favor contacta al soporte.');
      }
      
      throw new Error('Ocurrió un error inesperado al crear tu cuenta');
    }
  },
});
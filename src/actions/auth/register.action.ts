// src/actions/auth/registerUser.ts
import { defineAction } from 'astro:actions';
import { db, User, eq } from 'astro:db';
import { z } from 'astro:schema';
import { v4 as UUID } from 'uuid';
import bcrypt from 'bcryptjs';

export const registerUser = defineAction({
  accept: 'form',
  input: z.object({
    name: z.string().min(1, 'Nombre requerido'),
    email: z.string().email(),
    password: z.string().min(6),
  }),
  handler: async ({ name, email, password }) => {
    // 1) Genera internamente tu UUID
    const id = UUID();

    // 2) Comprueba si ya existe
    const existingUser = await db
      .select()
      .from(User)
      .where(eq(User.email, email))
      .get();

    if (existingUser) {
      throw new Error('El correo ya existe');
    }
    // Meter aquí la lógica de validación de la contraseña
    // Validación de la contraseña con expresiones regulares
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/.test(password)) {
      throw new Error('La contraseña debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número');
    }

    // 3) Hashea la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4) Inserta también el ID recién generado
    await db.insert(User).values({
      id,               // <-- tu UUID aquí
      name,
      email,
      password: hashedPassword,
      rol: 'user',
    });

    return { success: true };
  },
});

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
  handler: async (form) => {
    const { name, email, password } = form;

    const existingUser = await db
      .select()
      .from(User)
      .where(eq(User.email, email))
      .get();

    if (existingUser) {
      throw new Error('El correo ya existe');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.insert(User).values({
      name,
      email,
      password: hashedPassword,
      rol: 'user',
    });

    return { success: true };
  },
});

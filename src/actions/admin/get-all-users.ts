// src/actions/admin/get-all-users.ts
// Usuarios de la tienda (cuentas con login), para /admin/users.
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { db, User, Role, orders, eq, sql } from 'astro:db';
import { assertAdmin } from '../_guard';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string | null;
  rol: string;
  roleName: string;
  ordersCount: number;
  totalSpent: number;
  isYou: boolean;
}

/** Lista de usuarios con su rol y lo que han comprado. Nunca devuelve la contraseña. */
export const getAllUsers = defineAction({
  handler: async (_input, context) => {
    assertAdmin(context);

    const [users, roles, purchases] = await Promise.all([
      db
        .select({
          id: User.id,
          name: User.name,
          email: User.email,
          phone: User.phone,
          createdAt: User.createdAt,
          rol: User.rol,
        })
        .from(User),
      db.select().from(Role),
      // Pedidos por email (los de la tienda se ligan por email, no por id)
      db
        .select({
          email: sql<string>`lower(${orders.customerEmail})`,
          count: sql<number>`count(*)`,
          total: sql<number>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(sql`${orders.status} NOT IN ('cancelled', 'rejected', 'pending')`)
        .groupBy(sql`lower(${orders.customerEmail})`),
    ]);

    const roleName = new Map(roles.map(r => [r.id, r.name]));
    const byEmail = new Map(purchases.map(p => [p.email, p]));
    const myEmail = String(context.locals?.user?.email || '').toLowerCase();

    const rows: AdminUserRow[] = users.map(u => {
      const p = byEmail.get(u.email.toLowerCase());
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? null,
        createdAt: u.createdAt ? new Date(u.createdAt as any).toISOString() : null,
        rol: u.rol,
        roleName: roleName.get(u.rol) ?? u.rol,
        ordersCount: Number(p?.count ?? 0),
        totalSpent: Number(p?.total ?? 0),
        isYou: u.email.toLowerCase() === myEmail,
      };
    });

    // Admins primero, luego por nombre
    rows.sort((a, b) =>
      (a.rol === 'admin' ? 0 : 1) - (b.rol === 'admin' ? 0 : 1) || a.name.localeCompare(b.name, 'es')
    );

    return {
      users: rows,
      roles: roles.map(r => ({ id: r.id, name: r.name })),
    };
  },
});

/** Cambia el rol de un usuario, sin dejar la tienda sin administradores. */
export const updateUserRole = defineAction({
  accept: 'json',
  input: z.object({
    userId: z.string().min(1),
    roleId: z.string().min(1),
  }),
  handler: async ({ userId, roleId }, context) => {
    assertAdmin(context);

    const [target] = await db.select({ id: User.id, email: User.email, name: User.name, rol: User.rol }).from(User).where(eq(User.id, userId));
    if (!target) throw new ActionError({ code: 'NOT_FOUND', message: 'Usuario no encontrado.' });

    const [role] = await db.select().from(Role).where(eq(Role.id, roleId));
    if (!role) throw new ActionError({ code: 'BAD_REQUEST', message: 'Ese rol no existe.' });

    if (target.rol === roleId) return { success: true, user: { ...target, rol: roleId } };

    // No puedes cambiar tu propio rol: evita quitarte el acceso por accidente
    const myEmail = String(context.locals?.user?.email || '').toLowerCase();
    if (target.email.toLowerCase() === myEmail) {
      throw new ActionError({ code: 'BAD_REQUEST', message: 'No puedes cambiar tu propio rol. Pídeselo a otro administrador.' });
    }

    // Siempre debe quedar al menos un admin
    if (target.rol === 'admin' && roleId !== 'admin') {
      const [{ admins }] = await db.select({ admins: sql<number>`count(*)` }).from(User).where(eq(User.rol, 'admin'));
      if (Number(admins) <= 1) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'Debe quedar al menos un administrador.' });
      }
    }

    await db.update(User).set({ rol: roleId, updatedAt: new Date() } as any).where(eq(User.id, userId));
    return { success: true, user: { ...target, rol: roleId } };
  },
});

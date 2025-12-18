import type { MiddlewareNext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { getSession } from 'auth-astro/server';
import { db, User } from 'astro:db';
import { eq } from 'drizzle-orm';

const privateRoutes = ['/protected'];
const notAuthenticatedRoutes = ['/login', '/register'];
const accountRoutes = ['/account']; // Rutas que requieren autenticación

export const onRequest = defineMiddleware( 
    async ({ url, locals, redirect, request }, next) => {

    const session = await getSession(request);
    const isLoggedIn = !!session;
    const user = session?.user; 
 
    locals.isLoggedIn = isLoggedIn;
    locals.user = null;
    locals.isAdmin = false;

    if (user && user.email) {
        try {
            // Obtener datos completos del usuario desde la BD
            const fullUser = await db
                .select()
                .from(User)
                .where(eq(User.email, user.email))
                .get();

            if (fullUser) {
                locals.user = {
                    id: fullUser.id,
                    name: fullUser.name,
                    email: fullUser.email,
                    phone: fullUser.phone || null,
                    shippingAddress: fullUser.shippingAddress || null,
                    createdAt: fullUser.createdAt || null,
                    rol: fullUser.rol
                };
                locals.isAdmin = fullUser.rol === 'admin';
            } else {
                // Fallback si no encuentra en BD
                locals.user = {
                    name: user.name!,
                    email: user.email!,
                };
                locals.isAdmin = (user as any).rol === 'admin';
            }
        } catch (error) {
            console.error('Error obteniendo usuario en middleware:', error);
            // Fallback en caso de error
            locals.user = {
                name: user.name!,
                email: user.email!,
            };
            locals.isAdmin = (user as any).rol === 'admin';
        }
    }

    // Proteger rutas de admin
    if (!locals.isAdmin && url.pathname.startsWith('/dashboard')) {
        return redirect('/');
    }

    // Proteger rutas de cuenta (requieren estar logueado)
    if (!isLoggedIn && url.pathname.startsWith('/account')) {
        return redirect('/login');
    }
    
    // Redirigir usuarios autenticados de páginas de login/register
    if (isLoggedIn && notAuthenticatedRoutes.includes(url.pathname)) {
        return redirect('/');
    }

    return next();
});

import type { MiddlewareNext } from "astro";
import { defineMiddleware } from "astro:middleware";
import { getSession } from 'auth-astro/server';




const privateRoutes = ['/protected'];
const notAuthenticatedRoutes = ['/login','/register']

export const onRequest = defineMiddleware( 
    async ({ url, locals, redirect, request }, next) => {

    const session = await getSession(request);
    const isLoggedIn = !!session;
    const user = session?.user; 
 
    locals.isLoggedIn = isLoggedIn;
    locals.user = null;
    locals.isAdmin = false

    if (user) {
        // TODO
        locals.user = {
            name: user.name!,
            email: user.email!,
        }

        locals.isAdmin = user.rol === 'admin'
        

    }

    if(!locals.isAdmin && url.pathname.startsWith('/dashboard')){
        return redirect('/')
    }
    
    if (isLoggedIn && notAuthenticatedRoutes.includes(url.pathname)){
        return redirect('/');
    }

    return next();

});

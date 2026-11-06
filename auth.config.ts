import { db, eq, sql, User, Role } from 'astro:db';
//import GitHub from '@auth/core/providers/github';
import { defineConfig } from 'auth-astro';
import Google from "@auth/core/providers/google";
import Credentials from '@auth/core/providers/credentials';
import bcrypt from 'bcryptjs';
import { puedeIntentar, registrarFallo, limpiarIntentos, ipDe } from '@/utils/login-throttle';
import type { AdapterUser } from '@auth/core/adapters';
export default defineConfig({
  providers: [
    // TODO
    Google({
      clientId: import.meta.env.GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET,
    }),
        // TODO
    // Apple({
    //   clientId: import.meta.env.Apple_CLIENT_ID,
    //   clientSecret: import.meta.env.Apple_CLIENT_SECRET,
    // }),

    Credentials({
        credentials: {
            email: {label: 'Correo', type:'email' },
            password: {label: 'Password', type: 'password'}
        },
        // Devolver null = "correo o contraseña incorrectos" (CredentialsSignin).
        // Antes se lanzaba un Error: Auth.js lo trata como falla de configuración
        // y el formulario no podía distinguirlo de un error del servidor.
        authorize: async({email, password}, request) => {
            const cleanEmail = String(email ?? '').trim().toLowerCase();
            const plain = String(password ?? '');
            if (!cleanEmail || !plain) return null;

            // Freno de fuerza bruta. Va ANTES de buscar al usuario y antes
            // de bcrypt: si no, cada intento bloqueado seguiría costando un
            // hash, que es la parte cara, y el freno serviría de poco.
            const ip = request instanceof Request ? ipDe(request) : 'desconocida';
            const estado = await puedeIntentar(cleanEmail, ip);
            if (estado.bloqueado) {
                console.warn(`🔒 Intento rechazado por el freno (${estado.esperaSegundos}s):`, cleanEmail, ip);
                return null;
            }

            // Sin distinguir mayúsculas: hay cuentas guardadas como "Ana@Gmail.com"
            const [user] = await db.select().from(User)
                .where(sql`lower(${User.email}) = ${cleanEmail}`)
                .limit(1);

            let valid = false;
            if (user?.password) {
                try {
                    valid = bcrypt.compareSync(plain, user.password);
                } catch {
                    valid = false; // hash vacío o con otro formato
                }
            }

            // Correo que no existe y contraseña mala cuentan igual: si solo
            // se contaran las contraseñas malas, el formulario serviría para
            // averiguar qué correos están dados de alta.
            if (!valid) {
                await registrarFallo(cleanEmail, ip);
                return null;
            }

            await limpiarIntentos(cleanEmail, ip);
            const {password: _, ...rest } = user!;
            return rest;

        }
    })

  ],

  callbacks: {
    // Quien entra con Google por primera vez queda registrado como cliente,
    // igual que con el formulario (antes no existía en la base: sin id,
    // sin pedidos ni datos de envío guardados).
    signIn: async ({ user, account }) => {
        if (account?.provider !== 'google' || !user?.email) return true;
        try {
            const email = user.email.trim().toLowerCase();
            const existing = await db.select({ id: User.id }).from(User)
                .where(sql`lower(${User.email}) = ${email}`).limit(1);
            if (existing.length === 0) {
                const clientRole = await db.select().from(Role).where(eq(Role.name, 'client')).get();
                if (clientRole) {
                    await db.insert(User).values({
                        id: crypto.randomUUID(),
                        name: user.name || email.split('@')[0],
                        email,
                        // Contraseña aleatoria: esta cuenta entra con Google
                        password: bcrypt.hashSync(crypto.randomUUID(), 10),
                        createdAt: new Date(),
                        rol: clientRole.id,
                    } as any); // los tipos de Astro DB omiten el id de texto
                }
            }
        } catch (e) {
            // No se bloquea el acceso si falla el registro automático
            console.error('No se pudo registrar al usuario de Google:', e);
        }
        return true;
    },

    jwt: ({token, user}) => {

        if (user) {
            token.user = user;
        }
        return token;
    }, 
    
    session: ({session, token}) => {
        session.user = token.user as AdapterUser;

        
        return session;
    }
  }
});
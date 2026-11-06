// src/utils/login-throttle.ts
//
// Freno de fuerza bruta para el formulario de acceso.
//
// La cuenta de admin abre el punto de venta, el inventario y los saldos de
// los clientes, y hasta ahora nada impedía martillar el formulario con
// contraseñas hasta dar con una. bcrypt está bien usado —el hash es lento
// a propósito— pero eso encarece cada intento, no los limita.
//
// Dos límites, no uno:
//
//   · Por 'correo|ip': 5 fallos en 15 minutos y se bloquea esa combinación
//     15 minutos.
//   · Por 'ip' a secas: 20 fallos en 15 minutos. Esto atrapa al que prueba
//     muchos correos distintos desde el mismo lugar, que el primer límite
//     dejaría pasar.
//
// Por qué no se bloquea solo por correo: cualquiera podría dejar fuera a la
// dueña de su propia tienda metiendo cinco contraseñas malas con su correo.
// Atar el bloqueo a la IP hace que el atacante se estorbe a sí mismo y no a
// ella.

import { db, LoginAttempt } from 'astro:db';
import { eq } from 'drizzle-orm';

const VENTANA_MS = 15 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;
const MAX_POR_CUENTA = 5;
const MAX_POR_IP = 20;

/**
 * IP de quien llama.
 *
 * Detrás de Netlify, request.headers es la única fuente. x-nf-client-
 * connection-ip la pone Netlify y no la puede falsificar el cliente;
 * x-forwarded-for sí se puede inventar, así que solo se usa de respaldo y
 * tomando la primera entrada.
 */
export function ipDe(request: Request): string {
  const netlify = request.headers.get('x-nf-client-connection-ip');
  if (netlify) return netlify.trim();
  const reenviada = request.headers.get('x-forwarded-for');
  if (reenviada) return reenviada.split(',')[0]!.trim();
  return 'desconocida';
}

interface Estado {
  bloqueado: boolean;
  /** Segundos que faltan, para poder decírselo a quien intenta entrar. */
  esperaSegundos: number;
}

const LIBRE: Estado = { bloqueado: false, esperaSegundos: 0 };

async function leer(key: string) {
  const [fila] = await db.select().from(LoginAttempt).where(eq(LoginAttempt.key, key));
  return fila ?? null;
}

/**
 * ¿Se le permite intentar?
 *
 * Si la base falla —por ejemplo porque todavía no se corrió la migración—
 * se DEJA PASAR y se anota en consola. Es deliberado: fallar cerrado aquí
 * dejaría a la tienda sin poder entrar a su propio punto de venta por un
 * problema de infraestructura, que es peor que quedarse un rato sin este
 * freno. Lo mismo que ya se hace en el registro con Google.
 */
export async function puedeIntentar(email: string, ip: string): Promise<Estado> {
  const ahora = Date.now();
  try {
    for (const key of [`${email}|${ip}`, ip]) {
      const fila = await leer(key);
      if (!fila?.lockedUntil) continue;
      const hasta = new Date(fila.lockedUntil).getTime();
      if (hasta > ahora) {
        return { bloqueado: true, esperaSegundos: Math.ceil((hasta - ahora) / 1000) };
      }
    }
    return LIBRE;
  } catch (e) {
    console.error('⚠️ No se pudo consultar el freno de acceso, se deja pasar:', e);
    return LIBRE;
  }
}

async function sumarFallo(key: string, maximo: number, ahora: number) {
  const fila = await leer(key);

  // Sin fila, o con la ventana ya vencida: se empieza a contar de nuevo.
  const ventanaVencida = fila && ahora - new Date(fila.windowStart).getTime() > VENTANA_MS;
  if (!fila || ventanaVencida) {
    const valores = { key, failures: 1, windowStart: new Date(ahora), lockedUntil: null };
    if (fila) {
      await db.update(LoginAttempt).set(valores as any).where(eq(LoginAttempt.key, key));
    } else {
      await db.insert(LoginAttempt).values(valores as any);
    }
    return;
  }

  const fallos = (fila.failures ?? 0) + 1;
  await db.update(LoginAttempt)
    .set({
      failures: fallos,
      lockedUntil: fallos >= maximo ? new Date(ahora + BLOQUEO_MS) : null,
    } as any)
    .where(eq(LoginAttempt.key, key));

  if (fallos >= maximo) {
    console.warn(`🔒 Acceso bloqueado ${BLOQUEO_MS / 60000} min por ${fallos} fallos:`, key);
  }
}

/** Registra un intento fallido en las dos llaves. */
export async function registrarFallo(email: string, ip: string): Promise<void> {
  const ahora = Date.now();
  try {
    await sumarFallo(`${email}|${ip}`, MAX_POR_CUENTA, ahora);
    await sumarFallo(ip, MAX_POR_IP, ahora);
  } catch (e) {
    console.error('⚠️ No se pudo registrar el intento fallido:', e);
  }
}

/** Entró bien: se borra el contador para que no arrastre fallos viejos. */
export async function limpiarIntentos(email: string, ip: string): Promise<void> {
  try {
    await db.delete(LoginAttempt).where(eq(LoginAttempt.key, `${email}|${ip}`));
    await db.delete(LoginAttempt).where(eq(LoginAttempt.key, ip));
  } catch (e) {
    console.error('⚠️ No se pudieron limpiar los intentos:', e);
  }
}

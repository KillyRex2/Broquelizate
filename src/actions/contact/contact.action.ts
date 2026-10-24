// ============================================================
// src/actions/contact/contact.action.ts
//
// Formulario de /contact: la persona escribe y el mensaje llega al correo
// de la tienda, con su dirección como responder-a.
//
// El enlace "Contacto" del pie de página ya apuntaba a /contact desde antes;
// lo que faltaba era la página. Hasta ahora daba 404 en producción.
// ============================================================

import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { sendContactMessage } from '@/utils/email';

/**
 * Un formulario público sin freno es una máquina de mandar correo gratis a
 * cualquiera. Tres defensas, de la más barata a la más cara:
 *
 *   1. Un campo trampa, invisible para las personas y tentador para los
 *      robots que rellenan todo lo que encuentran. Si viene lleno, se
 *      responde como si todo hubiera ido bien y no se manda nada: un robot
 *      que recibe un error reintenta, uno que recibe un "listo" se va.
 *   2. Un mínimo de tiempo entre que se abre la página y se envía. Nadie
 *      escribe nombre, correo y mensaje en tres segundos.
 *   3. Un tope por dirección IP, más abajo.
 */
const SEGUNDOS_MINIMOS = 3;

// Tope por IP: 5 mensajes por hora. Vive en memoria, así que se reinicia
// cuando el servidor se recicla — suficiente para frenar un robot torpe, no
// para un ataque serio. Si algún día hace falta más, esto va a la base.
const LIMITE_POR_HORA = 5;
const VENTANA_MS = 60 * 60 * 1000;
const envios = new Map<string, number[]>();

function demasiados(ip: string): boolean {
  const ahora = Date.now();
  const previos = (envios.get(ip) ?? []).filter(t => ahora - t < VENTANA_MS);

  if (previos.length >= LIMITE_POR_HORA) {
    envios.set(ip, previos);
    return true;
  }

  previos.push(ahora);
  envios.set(ip, previos);

  // Limpieza perezosa: sin esto el mapa crece para siempre.
  if (envios.size > 500) {
    for (const [clave, marcas] of envios) {
      if (marcas.every(t => ahora - t >= VENTANA_MS)) envios.delete(clave);
    }
  }

  return false;
}

export const sendContactForm = defineAction({
  accept: 'form',
  input: z.object({
    name: z.string().trim().min(2, 'Escribe tu nombre.').max(80, 'Ese nombre es demasiado largo.'),
    email: z.string().trim().email('Revisa el correo: parece que falta algo.').max(150),
    phone: z.string().trim().max(30, 'Ese número es demasiado largo.').optional().or(z.literal('')),
    message: z
      .string()
      .trim()
      .min(10, 'Cuéntanos un poco más, con al menos 10 caracteres.')
      .max(3000, 'El mensaje es muy largo. Resume un poco, por favor.'),
    // El campo trampa. Si lo trae lleno, no fue una persona.
    website: z.string().optional(),
    // Marca de tiempo de cuándo se abrió el formulario.
    ts: z.string().optional(),
  }),

  handler: async ({ name, email, phone, message, website, ts }, context) => {
    // 1. Trampa: se finge éxito para que el robot no reintente.
    if (website && website.trim() !== '') {
      console.warn('🪤 Formulario de contacto: campo trampa relleno, descartado.');
      return { ok: true };
    }

    // 2. Demasiado rápido para haberlo escrito.
    const abierto = Number(ts);
    if (Number.isFinite(abierto) && abierto > 0) {
      const segundos = (Date.now() - abierto) / 1000;
      if (segundos < SEGUNDOS_MINIMOS) {
        console.warn('🪤 Formulario de contacto: enviado en', segundos.toFixed(1), 's, descartado.');
        return { ok: true };
      }
    }

    // 3. Tope por IP.
    const ip =
      context.request.headers.get('x-nf-client-connection-ip') ||
      context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'desconocida';

    if (demasiados(ip)) {
      throw new ActionError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Has enviado varios mensajes seguidos. Espera un rato o escríbenos por WhatsApp.',
      });
    }

    const enviado = await sendContactMessage({
      name,
      email,
      phone: phone && phone.trim() !== '' ? phone.trim() : null,
      message,
    });

    // sendContactMessage devuelve false y lo registra en los logs cuando
    // Resend no está configurado o rechaza el envío. Aquí sí hay que
    // decírselo a la persona: si cree que su mensaje llegó y no llegó, se
    // queda esperando una respuesta que nunca va a venir.
    if (!enviado) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por WhatsApp.',
      });
    }

    return { ok: true };
  },
});

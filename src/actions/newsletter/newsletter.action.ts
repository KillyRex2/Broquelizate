// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { Resend } from 'resend';

export const subscribeToNewsletter = defineAction({
  accept: 'form',
  input: z.object({
    email: z.string().email({ message: "Por favor, ingresa una dirección de correo válida." })
  }),
  handler: async ({ email }) => {
    if (!import.meta.env.RESEND_API_KEY) {
      console.error("La variable de entorno RESEND_API_KEY no está configurada.");
      throw new Error("No se pudo procesar la suscripción en este momento.");
    }

    const resend = new Resend(import.meta.env.RESEND_API_KEY);

    try {
      // --- CORREO 1: Notificación para el administrador ---
      await resend.emails.send({
        // ✅ CORRECCIÓN: Se usa la dirección de remitente permitida por Resend para pruebas.
        from: 'Notificaciones Broquelizate <onboarding@resend.dev>',
        to: ['broquelizate@gmail.com'], // Tu correo para recibir notificaciones
        subject: '¡Nueva suscripción al Newsletter! 🎉',
        html: `<p>El correo <strong>${email}</strong> se ha suscrito al newsletter.</p>`,
      });

      // --- CORREO 2: Correo de bienvenida para el nuevo suscriptor ---
      await resend.emails.send({
        // ✅ CORRECCIÓN: Se usa la misma dirección de remitente permitida.
        from: 'Broquelizate La Laguna <onboarding@resend.dev>',
        to: [email], // Se envía al email que el usuario ingresó.
        subject: '¡Bienvenido/a a Broquelizate La Laguna!',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 8px;">
            <h1 style="color: #c2a24d;">¡Gracias por suscribirte!</h1>
            <p>Estamos felices de tenerte en nuestro círculo exclusivo.</p>
            <p>Pronto recibirás noticias sobre nuevas colecciones, ofertas y más.</p>
            <br>
            <p style="font-size: 12px; color: #888;">Si no te suscribiste, puedes ignorar este correo.</p>
          </div>
        `,
      });

      return { success: true };

    } catch (err) {
      console.error("Error en la acción subscribeToNewsletter:", err);
      if (err instanceof Error && err.message.includes('validation error')) {
          throw new Error("La dirección de correo no es válida.");
      }
      throw new Error("Ocurrió un error inesperado al procesar tu suscripción.");
    }
  },
});

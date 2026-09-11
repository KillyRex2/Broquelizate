// ============================================================
// src/utils/email.ts
//
// Envío de correos con Resend.
//
// Regla de oro: un fallo al enviar correo NUNCA debe romper el
// pedido. El cliente ya pagó; si el correo no sale, se registra
// en los logs y la venta sigue su curso. Por eso todo va
// envuelto en try/catch y las funciones devuelven un booleano
// en vez de lanzar.
// ============================================================

import { Resend } from 'resend';
import {
  orderConfirmationEmail,
  adminNewOrderEmail,
  shippingNotificationEmail,
  type OrderEmailData,
} from './email-templates.ts';

const apiKey = import.meta.env.RESEND_API_KEY || process.env.RESEND_API_KEY;

// Remitente. Debe ser de un dominio verificado en Resend.
// Mientras no lo tengas, 'onboarding@resend.dev' funciona pero
// SOLO envía a la dirección con la que te registraste en Resend.
const FROM = import.meta.env.EMAIL_FROM || 'Broquelizate <onboarding@resend.dev>';

// A dónde llegan los avisos de venta nueva
const ADMIN_EMAIL = import.meta.env.EMAIL_ADMIN || 'broquelizatelaguna@gmail.com';

const resend = apiKey ? new Resend(apiKey) : null;

async function send(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY no configurada: no se envió el correo:', opts.subject);
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });

    if (error) {
      console.error('❌ Resend rechazó el envío:', error);
      return false;
    }

    console.log('✅ Correo enviado:', { id: data?.id, to: opts.to, subject: opts.subject });
    return true;
  } catch (e) {
    console.error('❌ Error enviando correo:', e);
    return false;
  }
}

/** Confirmación de compra para el cliente */
export async function sendOrderConfirmation(order: OrderEmailData): Promise<boolean> {
  if (!order.customerEmail) {
    console.warn('⚠️ Pedido sin correo de cliente:', order.orderNumber);
    return false;
  }
  return send({
    to: order.customerEmail,
    subject: `Pedido confirmado #${order.orderNumber} · Broquelizate`,
    html: orderConfirmationEmail(order),
    replyTo: ADMIN_EMAIL,
  });
}

/** Aviso de venta nueva para el negocio */
export async function sendAdminNewOrder(order: OrderEmailData): Promise<boolean> {
  return send({
    to: ADMIN_EMAIL,
    subject: `🛍️ Venta nueva #${order.orderNumber} · ${order.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
    html: adminNewOrderEmail(order),
    replyTo: order.customerEmail || undefined,
  });
}

/** Aviso de que el pedido ya va en camino */
export async function sendShippingNotification(order: OrderEmailData): Promise<boolean> {
  if (!order.customerEmail || !order.trackingNumber) return false;
  return send({
    to: order.customerEmail,
    subject: `Tu pedido #${order.orderNumber} va en camino 📦`,
    html: shippingNotificationEmail(order),
    replyTo: ADMIN_EMAIL,
  });
}

/**
 * Dispara los dos correos de una compra (cliente + negocio) sin
 * bloquear. Se usa justo después de confirmar el pago.
 */
export async function sendPurchaseEmails(order: OrderEmailData): Promise<void> {
  // Promise.allSettled: si uno falla, el otro se envía igual.
  const results = await Promise.allSettled([
    sendOrderConfirmation(order),
    sendAdminNewOrder(order),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`❌ Correo ${i === 0 ? 'al cliente' : 'al admin'} falló:`, r.reason);
    }
  });
}
// src/actions/admin/notifications.action.ts
//
// Avisos de la campanita del admin: compras de la tienda en línea que
// esperan algo del admin. No usa tabla propia: sale de `orders`, así que
// el aviso desaparece solo cuando se genera la guía (o se marca el pedido
// como enviado / cancelado) y no hay que migrar nada en Turso.
import { defineAction } from 'astro:actions';
import { db, orders, sql, desc } from 'astro:db';
import { assertAdmin } from '../_guard';

/** Métodos de pago de la tienda en línea (las ventas del POS no avisan). */
const ONLINE_PAYMENT_METHODS = ['card', 'paypal', 'mercadopago'];
/** Estados de un pedido ya pagado que todavía no se atiende. */
const PAID_STATUSES = ['paid', 'completed'];
/** Hasta cuántos días atrás se buscan pedidos pendientes. */
const LOOKBACK_DAYS = 30;

export interface AdminNotification {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  customer: string;
  /** 'label' = falta generar la guía · 'pickup' = preparar para recoger en tienda */
  kind: 'label' | 'pickup';
}

export const getAdminNotifications = defineAction({
  handler: async (_input, context): Promise<{ items: AdminNotification[]; count: number }> => {
    assertAdmin(context);

    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const inList = (values: string[]) => sql.join(values.map(v => sql`${v}`), sql`, `);

    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        total: orders.total,
        customerEmail: orders.customerEmail,
        shippingAddress: orders.shippingAddress,
        deliveryMethod: orders.deliveryMethod,
      })
      .from(orders)
      .where(sql`${orders.paymentMethod} IN (${inList(ONLINE_PAYMENT_METHODS)})
        AND ${orders.status} IN (${inList(PAID_STATUSES)})
        AND (
          ${orders.deliveryMethod} = 'pickup'
          OR (COALESCE(${orders.trackingNumber}, '') = '' AND COALESCE(${orders.labelUrl}, '') = '')
        )`)
      .orderBy(desc(orders.createdAt))
      .limit(50);

    // La fecha se filtra aquí y no en SQL: Astro DB guarda las fechas como
    // texto y comparar contra un Date en SQL crudo no es confiable.
    const recent = rows.filter(r => new Date(r.createdAt as any).getTime() >= since.getTime()).slice(0, 30);

    const items: AdminNotification[] = recent.map(r => {
      let name = '';
      try { name = JSON.parse(r.shippingAddress || '{}')?.name || ''; } catch {}
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        createdAt: new Date(r.createdAt as any).toISOString(),
        total: Number(r.total) || 0,
        customer: name || r.customerEmail || 'Cliente',
        kind: r.deliveryMethod === 'pickup' ? 'pickup' : 'label',
      };
    });

    return { items, count: items.length };
  },
});

// src/pages/api/admin/resolver-pendientes.ts
//
// Cierra los pedidos que se quedaron colgados en 'pending' porque el cliente
// abandonó el pago y Mercado Pago nunca mandó un webhook.
//
// Lo llama sola la página de pedidos del admin al abrirla. Es el momento
// natural: si alguien está mirando los pedidos, es cuando los pendientes
// fantasma estorban, y así no hace falta montar un cron ni tocar la
// configuración de Netlify.
//
// Es admin-only aunque no destruya nada: consulta la API de Mercado Pago una
// vez por pedido, y eso no se deja abierto a cualquiera que descubra la URL.
//
// La lógica —y las razones por las que no cancela a la ligera— está en
// utils/mercadopago-pendientes.ts.

import type { APIRoute } from 'astro';
import { resolverPedidosPendientes } from '@/utils/mercadopago-pendientes';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ locals }) => {
  if (!(locals as any)?.isAdmin) return json({ error: 'No autorizado' }, 403);

  try {
    const resumen = await resolverPedidosPendientes();
    return json({ ok: true, ...resumen });
  } catch (error) {
    console.error('❌ Error resolviendo pendientes:', error);
    return json({ error: 'No se pudieron revisar los pedidos pendientes' }, 500);
  }
};

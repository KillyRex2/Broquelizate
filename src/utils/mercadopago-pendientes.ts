// src/utils/mercadopago-pendientes.ts
//
// Cierra los pedidos que se quedaron colgados en 'pending'.
//
// El pedido se crea ANTES de mandar al cliente a Mercado Pago, con su
// externalReference, para que el webhook pueda confirmarlo aunque el cliente
// no vuelva nunca. Eso está bien, pero deja un cabo suelto: si el cliente
// cancela o cierra la pestaña sin llegar a generar un pago, Mercado Pago NO
// manda ningún webhook —no hay pago del que notificar—, así que no existe
// nada que resuelva ese pedido. Se queda en 'pending' para siempre.
//
// No es solo basura en el admin. perfil.astro y my-orders.astro cuentan los
// 'pending' como "en proceso", así que al cliente que canceló le queda un
// pedido fantasma en su cuenta, y cada reintento deja uno más.
//
// ────────────────────────────────────────────────────────────────
// Lo difícil: un 'pending' abandonado y uno legítimo se ven IGUAL
// ────────────────────────────────────────────────────────────────
//
// OXXO y SPEI viven en 'pending' durante días, y son ventas de verdad. Si
// esto cancelara por antigüedad a secas, le cancelaría a alguien que tiene el
// voucher en la mano y va a pagar mañana.
//
// Dos cosas los separan:
//
//   1. El paymentId. El webhook ahora lo anota en cuanto Mercado Pago avisa
//      de un pago, aunque siga pendiente. Un pedido con paymentId tiene un
//      pago de verdad en curso y esta limpieza ni lo mira.
//   2. Preguntarle a Mercado Pago. Para los que no tienen paymentId se busca
//      por external_reference antes de tocarlos, porque el webhook pudo
//      haberse perdido. Mercado Pago es la fuente de verdad, no la antigüedad.
//
// La regla que gobierna todo esto: ante la duda NO se cancela. Si la consulta
// a Mercado Pago falla, el pedido se deja como está y se intentará en la
// siguiente pasada. Un pedido viejo de más en el admin es un detalle; cancelar
// una venta que sí se pagó es perder dinero y un cliente.
//
// De regalo arregla un problema peor y silencioso: si un webhook se perdió y
// el pago SÍ se aprobó, hoy ese pedido se queda en 'pending' sin que nadie lo
// note, el cliente pagó y su pedido nunca se prepara. Aquí se detecta y se
// confirma.

import { db, orders, and, eq, lt } from 'astro:db';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { confirmOrderByReference, failOrderByReference } from './mercadopago-orders';

/**
 * Antigüedad mínima para mirar siquiera un pedido.
 *
 * Alguien puede tardar bastante llenando sus datos en Mercado Pago, así que
 * dos horas deja muchísimo margen frente a cualquier sesión real de pago. No
 * es lo que protege a OXXO y SPEI —de eso se encargan el paymentId y la
 * consulta a Mercado Pago—, solo evita gastar llamadas en pedidos que
 * probablemente siguen vivos.
 */
const VENTANA_HORAS = 2;

/** Tope por pasada: cada pedido es una llamada a la API de Mercado Pago. */
const MAXIMO_POR_PASADA = 15;

export interface ResumenPendientes {
  /** Pedidos que se miraron. */
  revisados: number;
  /** Tenían un pago aprobado que nadie había registrado: se rescataron. */
  confirmados: number;
  /** Pago real en curso (OXXO, SPEI, revisión): se anotó y se dejan. */
  enEspera: number;
  /** Nunca hubo pago: se cierran. */
  cancelados: number;
  /** No se pudo preguntar a Mercado Pago: se dejan igual. */
  omitidos: number;
}

const VACIO: ResumenPendientes = {
  revisados: 0, confirmados: 0, enEspera: 0, cancelados: 0, omitidos: 0,
};

/** Qué hacer con un pedido, según lo que Mercado Pago sepa de él. */
export type Decision =
  | { accion: 'confirmar'; paymentId: string }
  | { accion: 'anotar'; paymentId: string }
  | { accion: 'cancelar' };

/**
 * Decide la suerte de un pedido a partir de sus pagos en Mercado Pago.
 *
 * Aparte para poder probarla: es la parte peligrosa de este archivo, la que
 * puede cancelar una venta buena. Sus reglas, en orden:
 *
 *   1. Hay un pago aprobado → confirmar. Manda sobre cualquier otro: alguien
 *      que intentó tres veces y pagó a la tercera tiene dos rechazados y uno
 *      aprobado, y lo que vale es el aprobado.
 *   2. Hay un pago en curso → anotarlo y dejarlo. Es OXXO, SPEI o revisión.
 *   3. Solo rechazados, cancelados, o ningún pago → cancelar. Aquí no hay
 *      venta que perder.
 */
export function decidirPorPagos(pagos: Array<{ id?: unknown; status?: unknown }>): Decision {
  const lista = Array.isArray(pagos) ? pagos : [];

  const aprobado = lista.find(p => p?.status === 'approved' || p?.status === 'authorized');
  if (aprobado?.id != null) return { accion: 'confirmar', paymentId: String(aprobado.id) };

  const enCurso = lista.find(p => p?.status === 'pending' || p?.status === 'in_process');
  if (enCurso?.id != null) return { accion: 'anotar', paymentId: String(enCurso.id) };

  // Un pago aprobado o en curso SIN id es raro, pero cancelar un pedido que
  // Mercado Pago da por vivo sería el peor error posible: mejor dejarlo en
  // espera y que alguien lo mire.
  if (aprobado || enCurso) return { accion: 'anotar', paymentId: '' };

  return { accion: 'cancelar' };
}

/**
 * Revisa los pedidos pendientes viejos y los deja resueltos.
 *
 * Solo toca pedidos de la tienda online. Los del mostrador
 * ('mercadopago-pos') quedan fuera a propósito: ahí hay un cajero delante con
 * su propio botón de cancelar, y el QR puede estar a la vista esperando a que
 * el cliente lo escanee.
 */
export async function resolverPedidosPendientes(): Promise<ResumenPendientes> {
  const accessToken = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('⚠️ Sin MERCADOPAGO_ACCESS_TOKEN: no se revisan los pendientes.');
    return { ...VACIO };
  }

  const corte = new Date(Date.now() - VENTANA_HORAS * 60 * 60 * 1000);

  let candidatos;
  try {
    candidatos = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.status, 'pending'),
        // 'mercadopago' es la tienda online; 'mercadopago-pos' es el mostrador.
        eq(orders.paymentMethod, 'mercadopago'),
        lt(orders.createdAt, corte),
      ));
  } catch (e) {
    console.error('❌ No se pudieron leer los pedidos pendientes:', e);
    return { ...VACIO };
  }

  // El paymentId se filtra aquí y no en el WHERE para no depender de cómo
  // quedó guardado el campo vacío (null o cadena vacía, según por dónde pasó).
  const pendientes = candidatos
    .filter((o: any) => !o.paymentId && o.externalReference)
    .slice(0, MAXIMO_POR_PASADA);

  if (pendientes.length === 0) return { ...VACIO };

  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
  const resumen: ResumenPendientes = { ...VACIO, revisados: pendientes.length };

  for (const pedido of pendientes as any[]) {
    const ref = String(pedido.externalReference);

    let pagos: any[];
    try {
      const res = await new Payment(client).search({ options: { external_reference: ref } });
      pagos = res?.results ?? [];
    } catch (e) {
      // Ante la duda no se cancela. Se reintentará en la siguiente pasada.
      console.warn(`  ⚠️ ${pedido.orderNumber}: no se pudo consultar Mercado Pago; se deja igual.`, e);
      resumen.omitidos++;
      continue;
    }

    const decision = decidirPorPagos(pagos);

    if (decision.accion === 'confirmar') {
      // El pago entró y nadie lo registró: el webhook se perdió. Confirmar
      // descuenta stock y manda los correos, igual que por el camino normal.
      console.warn(`  💰 ${pedido.orderNumber}: tenía un pago aprobado sin registrar. Se confirma.`);
      try {
        await confirmOrderByReference(ref, decision.paymentId);
        resumen.confirmados++;
      } catch (e) {
        console.error(`  ❌ ${pedido.orderNumber}: falló al confirmarlo`, e);
        resumen.omitidos++;
      }
      continue;
    }

    if (decision.accion === 'anotar') {
      // Venta viva: voucher de OXXO sin pagar, transferencia en camino o pago
      // bajo revisión. Se anota el paymentId para que la próxima pasada ni se
      // moleste en preguntar.
      if (decision.paymentId) {
        try {
          await db.update(orders)
            .set({ paymentId: decision.paymentId, updatedAt: new Date() } as any)
            .where(eq(orders.id, pedido.id));
        } catch (e) {
          console.warn(`  ⚠️ ${pedido.orderNumber}: no se pudo anotar el paymentId`, e);
        }
      }
      resumen.enEspera++;
      continue;
    }

    // Ni aprobado, ni en curso: o no hay ningún pago (el cliente nunca llegó a
    // pagar) o todos están rechazados o cancelados. Ahora sí se cierra.
    try {
      await failOrderByReference(ref, 'cancelled');
      resumen.cancelados++;
    } catch (e) {
      console.error(`  ❌ ${pedido.orderNumber}: falló al cancelarlo`, e);
      resumen.omitidos++;
    }
  }

  console.log('🧹 Pendientes revisados:', resumen);
  return resumen;
}

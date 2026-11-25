// src/utils/order-access.ts
//
// Quién puede ver los datos personales de un pedido en /order-success.
//
// El problema: esa página se abre con /order-success?order_id=<uuid> y hasta
// ahora pintaba todo —nombre, correo, teléfono, calle, ciudad, CP, artículos
// y totales— a quien llegara con ese id, sin comprobar nada. El UUID era la
// única cerradura.
//
// Y un UUID no es una cerradura. No se adivina a la fuerza, pero se filtra
// solo: queda en el historial del navegador (incluido el de una computadora
// compartida), viaja en la cabecera Referer, y sobre todo se reenvía — la
// gente manda ese link por WhatsApp para enseñar lo que compró, sin saber
// que lleva su domicilio dentro.
//
// Por qué no se pide sesión y ya: la mayoría de las compras son de invitado,
// sin cuenta. Exigir sesión rompería la pantalla de "gracias por tu compra"
// justo después de pagar, que es el momento en que más importa.
//
// La solución es separar las dos cosas que el UUID mezclaba: *encontrar* el
// pedido y *tener derecho* a ver sus datos personales. El id sigue
// encontrándolo; el derecho ahora se gana de dos formas.
//
//   1. Con sesión, si el correo de la cuenta es el del pedido.
//   2. Sin sesión, si el pedido es RECIÉN hecho.
//
// La segunda es la que sostiene la compra de invitado, y se apoya en algo
// cierto: quien acaba de pagar llega a esta página en segundos. Quien abre
// el mismo link al día siguiente —porque lo encontró en un historial o se lo
// reenviaron— ya no es, casi siempre, la persona que compró.
//
// Fuera de esos dos casos la página sigue funcionando: muestra número de
// pedido, fecha, estado y total, que es lo que alguien necesita para saber
// que su compra está bien. Lo que desaparece son los datos personales y el
// detalle de lo comprado.

/**
 * Cuánto dura el acceso sin sesión.
 *
 * Dos horas. Suficiente de sobra para pagar, volver a cargar la página, o
 * dejar la pestaña abierta un rato y regresar; corto frente a los caminos
 * por los que de verdad se filtra un enlace, que son de horas o días.
 *
 * Subirlo a un día devolvería casi todo el problema. Bajarlo a cinco minutos
 * molestaría a quien paga en OXXO y vuelve más tarde al mismo link.
 */
export const VENTANA_SIN_SESION_MS = 2 * 60 * 60 * 1000;

const mismoCorreo = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export interface ArgsAcceso {
  /** Cuándo se creó el pedido. */
  createdAt: Date | string | number | null | undefined;
  /** Correo con el que se hizo el pedido. */
  customerEmail: string | null | undefined;
  /** Correo de la sesión, si hay alguien con cuenta iniciada. */
  sessionEmail: string | null | undefined;
  /** Para poder probar la ventana sin depender del reloj. */
  ahora?: number;
}

export type MotivoAcceso = 'sesion' | 'reciente' | 'caducado';

/**
 * Devuelve si se pueden enseñar los datos personales, y por qué.
 *
 * El motivo no es decorativo: la página lo usa para explicarle a quien llega
 * qué pasó. "Este enlace ya caducó, inicia sesión para ver tu pedido" es una
 * respuesta; una pantalla a medias sin explicación parece un error.
 */
export function accesoAPedido(args: ArgsAcceso): { completo: boolean; motivo: MotivoAcceso } {
  if (mismoCorreo(args.sessionEmail, args.customerEmail)) {
    return { completo: true, motivo: 'sesion' };
  }

  const creado = args.createdAt ? new Date(args.createdAt).getTime() : NaN;
  const ahora = args.ahora ?? Date.now();

  // Sin fecha utilizable se cierra. Es un pedido raro —o un dato corrupto— y
  // ante la duda es mejor enseñar de menos: el cliente siempre puede iniciar
  // sesión o escribir por WhatsApp, pero un domicilio enseñado de más no se
  // puede recoger.
  if (!Number.isFinite(creado)) return { completo: false, motivo: 'caducado' };

  // La resta se hace en valor absoluto para que un reloj de servidor adelantado
  // respecto al de la base no deje pedidos recién hechos fuera de la ventana.
  const dentro = Math.abs(ahora - creado) <= VENTANA_SIN_SESION_MS;
  return dentro ? { completo: true, motivo: 'reciente' } : { completo: false, motivo: 'caducado' };
}

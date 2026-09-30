// ============================================================
// src/utils/shipping.ts
// Umbral de envío gratis. Este es el ÚNICO lugar donde vive.
// ============================================================

export const FREE_SHIPPING_THRESHOLD = 1099;

/** ¿El subtotal alcanza para envío gratis? */
export const qualifiesForFreeShipping = (subtotal: number): boolean =>
  Number(subtotal) >= FREE_SHIPPING_THRESHOLD;

/** Lo que se le cobra al cliente por envío */
export const chargedShipping = (subtotal: number, carrierRate: number): number =>
  qualifiesForFreeShipping(subtotal) ? 0 : Math.max(0, Number(carrierRate) || 0);

/**
 * Paquete estimado para cotizar según cuántas piezas lleva el carrito.
 * Lo usan el cotizador (navegador) y el servidor al validar la cotización,
 * así que ambos calculan exactamente lo mismo.
 * El peso ya viene normalizado como lo pide Envia (entero, mínimo 1 kg).
 */
export function packageForItems(itemsCount: number) {
  const n = Math.max(0, Math.floor(Number(itemsCount) || 0));
  return {
    weight: Math.max(1, Math.ceil(Math.max(0.5, n * 0.05))),
    length: Math.min(15 + n * 2, 50),
    width: 15,
    height: 10,
  };
}

/** Cuánto falta para alcanzar el envío gratis (0 si ya aplica) */
export const remainingForFreeShipping = (subtotal: number): number =>
  Math.max(0, FREE_SHIPPING_THRESHOLD - Number(subtotal));
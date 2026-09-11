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

/** Cuánto falta para alcanzar el envío gratis (0 si ya aplica) */
export const remainingForFreeShipping = (subtotal: number): number =>
  Math.max(0, FREE_SHIPPING_THRESHOLD - Number(subtotal));
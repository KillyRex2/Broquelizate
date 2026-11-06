// src/utils/policies.ts
// Las promesas que la tienda le hace al cliente, en números.
//
// Viven juntas y en un solo lugar por la misma razón que el umbral de
// envío gratis: estas cifras aparecen en la portada y en los términos, y
// cuando se escriben a mano en los dos lados acaban diciendo cosas
// distintas. La que se publica en la portada es la que el cliente recuerda;
// la de los términos es la que se le enseña cuando reclama.

import { freeShippingLabel } from '@/utils/shipping';

/**
 * Días de garantía contra defectos de fabricación.
 *
 * Anotado como number y no como el literal 30: así el singular de abajo
 * sigue siendo código válido si algún día la garantía baja a un día.
 */
export const WARRANTY_DAYS: number = 30;

/** "30 días", para meterlo en una frase. */
export const warrantyLabel = (): string =>
  `${WARRANTY_DAYS} día${WARRANTY_DAYS === 1 ? '' : 's'}`;

// ============================================================
// Franja de confianza
// ============================================================

export interface TrustItem {
  title: string;
  detail: string;
  /** Qué ícono dibuja quien la pinta: 'envio' | 'garantia' | 'pago'. */
  icon: 'envio' | 'garantia' | 'pago';
}

/**
 * Los tres motivos que la tienda repite al cliente: aparecen en el hero y
 * otra vez en el footer.
 *
 * Están aquí y no copiados en cada componente porque es exactamente el
 * tipo de texto que se actualiza en un lado y se olvida en el otro: el
 * día que la garantía deje de ser de 30 días, el footer seguiría
 * prometiendo 30 mientras el hero dice otra cosa.
 */
export const trustItems = (): TrustItem[] => [
  { title: 'Envío gratis', detail: `En compras mayores a ${freeShippingLabel()}`, icon: 'envio' },
  { title: 'Garantía', detail: `${warrantyLabel()} contra defectos`, icon: 'garantia' },
  { title: 'Pago seguro', detail: 'Tarjeta, PayPal y Mercado Pago', icon: 'pago' },
];

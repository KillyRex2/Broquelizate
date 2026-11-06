// src/utils/policies.ts
// Las promesas que la tienda le hace al cliente, en números.
//
// Viven juntas y en un solo lugar por la misma razón que el umbral de
// envío gratis: estas cifras aparecen en la portada y en los términos, y
// cuando se escriben a mano en los dos lados acaban diciendo cosas
// distintas. La que se publica en la portada es la que el cliente recuerda;
// la de los términos es la que se le enseña cuando reclama.

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

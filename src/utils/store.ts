// src/utils/store.ts
// Datos de la tienda física: dirección, contacto y "Recoger en tienda".
//
// Este archivo es la fuente para todo lo que se le MUESTRA al cliente. La
// dirección de origen que se le manda a Envia vive aparte (en
// envia.action.ts y en admin/orders/[id].astro) porque esa API pide los
// campos con otra forma —calle y número separados, el estado como 'DG'— y
// no conviene mezclarlas: un error ahí no se ve en pantalla, se ve cuando
// la paquetería no encuentra el domicilio de recolección.

export const STORE_PICKUP = {
  enabled: true,

  name: 'Broquelizate',
  street: 'Bravo 222, esquina con Escobedo (segundo piso)',
  neighborhood: 'Colonia Centro',
  city: 'Gómez Palacio',
  state: 'Durango',
  postalCode: '35000',
  country: 'México',

  /**
   * Horario de atención. Vacío = no se muestra, que es justo lo que debe
   * pasar mientras no se confirme: antes aquí decía
   * 'TODO: Lun a Sáb · 11:00 a 19:00' y eso se le enseñaba tal cual al
   * cliente en el carrito y en el checkout.
   */
  hours: '',

  /** Días hábiles para tener el pedido listo (0 = mismo día). */
  readyInDays: 1,

  instructions:
    'Te avisaremos por correo cuando tu pedido esté listo. Al recoger, presenta tu número de pedido y una identificación.',
} as const;

export type StorePickup = typeof STORE_PICKUP;

// ============================================================
// Contacto
// ============================================================

/** Teléfono en formato internacional sin signos, como lo pide wa.me. */
export const STORE_WHATSAPP = '528714617696';

/** El mismo número, legible, para mostrarlo en pantalla. */
export const STORE_PHONE_DISPLAY = '+52 871 461 7696';

/**
 * Link de WhatsApp, opcionalmente con mensaje ya escrito.
 *
 * Existe porque el número estaba copiado a mano en cuatro archivos y en la
 * página de producto se había quedado como 'wa.me/52XXXXXXXXXX'. O sea que
 * el botón de "pregúntanos por este producto" no llevaba a ningún lado,
 * justo en la página donde la gente pregunta.
 */
export const whatsappUrl = (mensaje?: string): string =>
  `https://wa.me/${STORE_WHATSAPP}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;

// ============================================================
// Derivados
// ============================================================

export type DeliveryMethod = 'delivery' | 'pickup';

/** Cualquier valor que no sea exactamente 'pickup' se trata como envío a domicilio. */
export const normalizeDeliveryMethod = (v: unknown): DeliveryMethod =>
  v === 'pickup' ? 'pickup' : 'delivery';

/** Dirección en una línea, para mostrar en UI y guardar en la orden. */
export const storeAddressLine = (s: StorePickup = STORE_PICKUP) =>
  `${s.street}, ${s.neighborhood}, ${s.city}, ${s.state} ${s.postalCode}`;

/**
 * Link a Google Maps.
 *
 * Se arma con la búsqueda por dirección en vez de pegar un link fijo del
 * negocio: así no se queda apuntando a un lugar equivocado si algún día
 * cambia la dirección aquí arriba y nadie se acuerda de actualizar el link.
 */
export const storeMapsUrl = (s: StorePickup = STORE_PICKUP) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${s.name}, ${storeAddressLine(s)}`,
  )}`;

/** Texto "Listo hoy" / "Listo en 1 día hábil" / "Listo en 2 días hábiles". */
export const pickupReadyText = (days: number) =>
  days <= 0 ? 'Listo el mismo día' : `Listo en ${days} día${days !== 1 ? 's' : ''} hábil${days !== 1 ? 'es' : ''}`;

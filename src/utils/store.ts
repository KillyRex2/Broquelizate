// src/utils/store.ts
// Datos de la tienda física para "Recoger en tienda".
// ⚠️ Llena los campos marcados con TODO antes de publicar: se muestran tal cual al cliente.

export const STORE_PICKUP = {
  enabled: true,

  name: 'Broquelizate',
  street: 'TODO: Calle y número',
  neighborhood: 'TODO: Colonia',
  city: 'Gómez Palacio',
  state: 'Durango',
  postalCode: '35000',
  country: 'México',

  hours: 'TODO: Lun a Sáb · 11:00 a 19:00',
  /** Días hábiles para tener el pedido listo (0 = mismo día). */
  readyInDays: 1,
  /** Link de Google Maps (opcional). Vacío = no se muestra el botón. */
  mapsUrl: '',

  instructions:
    'Te avisaremos por correo cuando tu pedido esté listo. Al recoger, presenta tu número de pedido y una identificación.',
} as const;

export type StorePickup = typeof STORE_PICKUP;

export type DeliveryMethod = 'delivery' | 'pickup';

/** Cualquier valor que no sea exactamente 'pickup' se trata como envío a domicilio. */
export const normalizeDeliveryMethod = (v: unknown): DeliveryMethod =>
  v === 'pickup' ? 'pickup' : 'delivery';

/** Dirección en una línea, para mostrar en UI y guardar en la orden. */
export const storeAddressLine = (s: StorePickup = STORE_PICKUP) =>
  `${s.street}, ${s.neighborhood}, ${s.city}, ${s.state} ${s.postalCode}`;

/** Texto "Listo hoy" / "Listo en 1 día hábil" / "Listo en 2 días hábiles". */
export const pickupReadyText = (days: number) =>
  days <= 0 ? 'Listo el mismo día' : `Listo en ${days} día${days !== 1 ? 's' : ''} hábil${days !== 1 ? 'es' : ''}`;
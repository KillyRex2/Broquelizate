// ============================================================
// src/utils/images.ts
//
// Las fotos se suben a Cloudinary tal cual salen del celular
// (varios MB, miles de px). Mostrarlas así en miniaturas de
// 140 px descarga el original completo en cada tarjeta.
//
// optimizeImage() le pide a Cloudinary una versión del tamaño
// que realmente se muestra:
//   f_auto  → WebP/AVIF si el navegador lo soporta
//   q_auto  → compresión automática sin pérdida visible
//   c_limit → solo reduce, nunca agranda
//   w_N     → ancho máximo en px (usa ~2x lo que se ve, por pantallas retina)
//
// URLs que no son de Cloudinary (placeholders, /images/...) se
// devuelven sin cambios. Funciona igual en servidor y navegador.
// ============================================================

/** Anchos estándar (ya pensados para pantallas 2x). */
export const IMG_WIDTH = {
  /** Miniaturas pequeñas: carrito, resumen de checkout (≈50–100 px) */
  thumb: 200,
  /** Tarjetas del POS (≈140–160 px) */
  pos: 320,
  /** Tarjetas de producto en la tienda y carruseles (≈250–300 px) */
  card: 600,
  /** Imagen principal del producto */
  main: 1200,
  /** Lightbox / zoom */
  full: 2000,
} as const;

const CLOUDINARY_UPLOAD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

export function optimizeImage<T extends string | null | undefined>(url: T, width: number): T {
  if (!url || typeof url !== 'string') return url;
  const m = url.match(CLOUDINARY_UPLOAD);
  if (!m) return url;

  const [, base, rest] = m;
  const firstSegment = rest.split('/')[0];
  // Si ya trae transformaciones (p. ej. "w_300,c_fill"), no se tocan.
  if (!/^v\d+$/.test(firstSegment) && /^[a-z]{1,3}_[^/]*$/.test(firstSegment) && rest.includes('/')) {
    return url;
  }

  return `${base}f_auto,q_auto,c_limit,w_${Math.round(width)}/${rest}` as T;
}

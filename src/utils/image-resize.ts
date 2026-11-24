// src/utils/image-resize.ts
//
// Achica una foto en el navegador ANTES de subirla.
//
// Por qué existe: las fotos del formulario de producto viajaban al servidor
// a tamaño original, y desde un teléfono eso no funciona.
//
//   · Una foto de celular pesa de 2 a 5 MB. Netlify corta las peticiones
//     alrededor de 6 MB y además no devuelve un 413 limpio, sino un 500 o un
//     502, así que el mensaje que veía quien subía era genérico e inútil.
//     Con dos o tres fotos ya no se guardaba nada.
//   · El servidor descartaba por su cuenta todo lo que pasara de 5 MB.
//   · Y el iPhone puede mandar HEIC, que no todo el mundo digiere igual.
//
// Los tres se arreglan solos si lo que sale del navegador ya es un JPEG
// chico. Para una ficha de producto, 1600px de lado largo sobra: Cloudinary
// no necesita los 12 megapíxeles del original, y nadie los va a mirar.
//
// Esto NO sustituye los límites del servidor. Son la última línea y ahí se
// quedan: este archivo corre en el navegador del cliente y cualquiera puede
// saltárselo.

/** Lado largo máximo. Más que de sobra para la ficha más grande del sitio. */
const LADO_MAXIMO = 1600;

/** Calidad del JPEG. 0.82 es el punto donde dejan de notarse los artefactos. */
const CALIDAD = 0.82;

/** Debajo de esto no vale la pena recomprimir: ya es chica. */
const NO_TOCAR_DEBAJO_DE = 400 * 1024;

export interface FotoAchicada {
  archivo: File;
  /** true si de verdad se recomprimió; false si se devolvió el original. */
  cambiada: boolean;
  bytesAntes: number;
  bytesDespues: number;
}

/**
 * Decodifica el archivo respetando la orientación EXIF.
 *
 * Esto importa más de lo que parece: una foto tomada en vertical con el
 * teléfono suele venir guardada en horizontal con una etiqueta EXIF que dice
 * "gírala". Al dibujarla en un canvas esa etiqueta se pierde, y si no se
 * aplica antes, la foto queda acostada en la tienda.
 *
 * createImageBitmap con imageOrientation lo resuelve de una. Donde no exista
 * se cae al <img> de toda la vida, que aplica la orientación por su cuenta.
 */
async function decodificar(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    } catch {
      // Safari viejo no acepta la opción: se reintenta sin ella antes de
      // bajar al <img>, que es más lento.
      try {
        return await createImageBitmap(file);
      } catch {
        /* al <img> */
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
      img.src = url;
    });
  } finally {
    // Se revoca en cuanto la imagen está decodificada; el bitmap ya no lo
    // necesita y dejarlo colgando filtra memoria en una pestaña que puede
    // estar subiendo veinte fotos.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function medidas(fuente: ImageBitmap | HTMLImageElement) {
  const ancho = (fuente as ImageBitmap).width || (fuente as HTMLImageElement).naturalWidth;
  const alto = (fuente as ImageBitmap).height || (fuente as HTMLImageElement).naturalHeight;
  return { ancho, alto };
}

/**
 * Devuelve la foto lista para subir.
 *
 * Nunca lanza: si algo sale mal devuelve el archivo original sin tocar. Es
 * deliberado. Que una foto suba más pesada de lo ideal es un inconveniente;
 * que el formulario se rompa entero porque el navegador de alguien no
 * soportó un canvas es perder la venta de ese día.
 */
export async function achicarFoto(file: File): Promise<FotoAchicada> {
  const sinCambios: FotoAchicada = {
    archivo: file, cambiada: false, bytesAntes: file.size, bytesDespues: file.size,
  };

  // Un GIF animado pierde la animación al pasar por el canvas, y un SVG no
  // tiene nada que achicar. Se dejan en paz.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return sinCambios;

  let fuente: ImageBitmap | HTMLImageElement;
  try {
    fuente = await decodificar(file);
  } catch {
    return sinCambios;
  }

  try {
    const { ancho, alto } = medidas(fuente);
    if (!ancho || !alto) return sinCambios;

    const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));

    // Ya es chica y además cabe: no se gana nada recomprimiéndola, y
    // recomprimir un JPEG siempre le quita algo.
    if (escala === 1 && file.size <= NO_TOCAR_DEBAJO_DE) return sinCambios;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(ancho * escala);
    canvas.height = Math.round(alto * escala);

    const ctx = canvas.getContext('2d');
    if (!ctx) return sinCambios;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(fuente as CanvasImageSource, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolver =>
      canvas.toBlob(resolver, 'image/jpeg', CALIDAD),
    );
    if (!blob) return sinCambios;

    // Si el resultado pesa más que el original, el original gana. Pasa con
    // capturas de pantalla y con PNG de pocos colores.
    if (blob.size >= file.size) return sinCambios;

    const nombre = file.name.replace(/\.[^.]+$/, '') || 'foto';
    const archivo = new File([blob], `${nombre}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    return { archivo, cambiada: true, bytesAntes: file.size, bytesDespues: archivo.size };
  } catch {
    return sinCambios;
  } finally {
    if (typeof ImageBitmap !== 'undefined' && fuente instanceof ImageBitmap) fuente.close();
  }
}

/** "3.2 MB", "412 KB" — para poder decirle a la persona qué pasó con su foto. */
export function pesoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

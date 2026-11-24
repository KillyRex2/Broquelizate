// src/utils/pos-adhoc.ts
//
// Productos momentáneos de la venta en mostrador: algo que se vende y no está
// en el catálogo —un arreglo, una pieza de encargo, un apartado— con su
// nombre y su precio escritos en el momento.
//
// Por qué no sirven los "montos adicionales" que ya existían:
//
//   · Son un CARGO sobre una venta, no un artículo. Salen en el ticket bajo
//     "Monto adicional", que no es lo que el cliente compró.
//   · No tienen cantidad: vender tres iguales obligaba a hacer la cuenta a
//     mano o a capturarlos uno por uno.
//   · Y sobre todo: el checkout te devuelve al carrito si no hay productos
//     del catálogo (AdminCheckout: `if (cart.length === 0) navigate(...)`),
//     así que para cobrar algo que no está en el catálogo había que meter
//     un producto cualquiera para que lo dejara pasar.
//
// Los dos conviven a propósito: el monto adicional sigue siendo para cargos
// sueltos (un envío, una propina) y esto es para cosas que se venden. Por eso
// viven en llaves distintas de localStorage y se guardan por separado en el
// pedido: si compartieran sitio, el detalle no podría distinguirlos y el
// ticket no sabría cuál es cuál.

export interface PosAdHocItem {
  /** Lo que verá el cliente en el ticket. */
  name: string;
  /** Precio por unidad. */
  price: number;
  quantity: number;
}

export const POS_ADHOC_KEY = 'admin-pos-adhoc';
export const POS_ADHOC_NAME_MAX = 80;
export const POS_ADHOC_MAX_ITEMS = 20;
export const POS_ADHOC_MAX_QTY = 99;

/**
 * Precio máximo por unidad.
 *
 * No es desconfianza hacia la tienda —quien captura aquí ya entró como
 * admin—, es una red contra el dedo pegado al teclado. Un 3500 que sale
 * 35000000 se cobra, se imprime el ticket y se descubre al cuadrar la caja.
 */
export const POS_ADHOC_MAX_PRICE = 500_000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Limpia y valida una lista venida de localStorage o del navegador.
 *
 * La usan el POS y también el servidor, y eso es intencional: lo que llega en
 * la petición no es de fiar solo porque lo haya escrito el mismo código.
 */
export function normalizeAdHoc(raw: unknown): PosAdHocItem[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  return list
    .map((x: any) => {
      const price = round2(Number(x?.price) || 0);
      const quantity = Math.floor(Number(x?.quantity) || 0);
      return {
        name: String(x?.name ?? '').trim().slice(0, POS_ADHOC_NAME_MAX),
        price: Math.min(Math.max(price, 0), POS_ADHOC_MAX_PRICE),
        quantity: Math.min(Math.max(quantity, 1), POS_ADHOC_MAX_QTY),
      };
    })
    // Sin nombre no se puede poner en un ticket, y a precio 0 no es una venta.
    .filter(x => x.name.length > 0 && x.price > 0)
    .slice(0, POS_ADHOC_MAX_ITEMS);
}

export const adHocLineTotal = (item: PosAdHocItem) => round2(item.price * item.quantity);

export const adHocTotal = (items: PosAdHocItem[]) =>
  round2(items.reduce((suma, x) => suma + x.price * x.quantity, 0));


export function readPosAdHoc(): PosAdHocItem[] {
  try {
    return normalizeAdHoc(JSON.parse(localStorage.getItem(POS_ADHOC_KEY) || 'null'));
  } catch {
    return [];
  }
}

export function savePosAdHoc(items: PosAdHocItem[]): void {
  try {
    const limpio = normalizeAdHoc(items);
    if (limpio.length === 0) localStorage.removeItem(POS_ADHOC_KEY);
    else localStorage.setItem(POS_ADHOC_KEY, JSON.stringify(limpio));
  } catch {}
}

export function clearPosAdHoc(): void {
  try { localStorage.removeItem(POS_ADHOC_KEY); } catch {}
}

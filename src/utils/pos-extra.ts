// src/utils/pos-extra.ts
// Montos adicionales de la venta en mostrador (servicios, cargos extra…).
// Se capturan en el POS y viajan al checkout del admin junto con el carrito,
// por localStorage, igual que 'admin-pos-cart'. Puede haber varios.

export interface PosExtraCharge {
  amount: number;
  description: string;
}

export const POS_EXTRA_KEY = 'admin-pos-extra';
export const POS_EXTRA_DESCRIPTION_MAX = 120;
export const POS_EXTRA_MAX_ITEMS = 20;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Limpia y valida una lista (acepta también el formato viejo de un solo monto). */
export function normalizeExtras(raw: unknown): PosExtraCharge[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  return list
    .map((x: any) => ({
      amount: round2(Number(x?.amount) || 0),
      description: String(x?.description ?? '').trim().slice(0, POS_EXTRA_DESCRIPTION_MAX),
    }))
    .filter(x => x.amount > 0)
    .slice(0, POS_EXTRA_MAX_ITEMS);
}

export function readPosExtras(): PosExtraCharge[] {
  try {
    return normalizeExtras(JSON.parse(localStorage.getItem(POS_EXTRA_KEY) || 'null'));
  } catch {
    return [];
  }
}

export function savePosExtras(extras: PosExtraCharge[]): void {
  try {
    const clean = normalizeExtras(extras);
    if (clean.length === 0) localStorage.removeItem(POS_EXTRA_KEY);
    else localStorage.setItem(POS_EXTRA_KEY, JSON.stringify(clean));
  } catch {}
}

export function clearPosExtras(): void {
  try { localStorage.removeItem(POS_EXTRA_KEY); } catch {}
}

export const extrasTotal = (extras: PosExtraCharge[]) => round2(extras.reduce((s, x) => s + x.amount, 0));

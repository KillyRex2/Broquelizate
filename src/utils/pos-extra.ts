// src/utils/pos-extra.ts
// Monto adicional de la venta en mostrador (servicio, cargo extra…).
// Se captura en el POS y viaja al checkout del admin junto con el carrito,
// por localStorage, igual que 'admin-pos-cart'.

export interface PosExtraCharge {
  amount: number;
  description: string;
}

export const POS_EXTRA_KEY = 'admin-pos-extra';
export const POS_EXTRA_DESCRIPTION_MAX = 120;

export function readPosExtra(): PosExtraCharge | null {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_EXTRA_KEY) || 'null');
    const amount = Number(raw?.amount);
    if (!(amount > 0)) return null;
    return { amount: Math.round(amount * 100) / 100, description: String(raw?.description ?? '').trim() };
  } catch {
    return null;
  }
}

export function savePosExtra(extra: PosExtraCharge | null): void {
  try {
    if (!extra || !(extra.amount > 0)) localStorage.removeItem(POS_EXTRA_KEY);
    else localStorage.setItem(POS_EXTRA_KEY, JSON.stringify({
      amount: Math.round(extra.amount * 100) / 100,
      description: extra.description.trim().slice(0, POS_EXTRA_DESCRIPTION_MAX),
    }));
  } catch {}
}

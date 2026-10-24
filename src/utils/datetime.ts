// ============================================================
// src/utils/datetime.ts
//
// Todas las fechas que ve la tienda se calculan en la zona horaria del
// negocio, no en la del servidor.
//
// El servidor de Netlify corre en UTC. Una venta hecha a las 6:46 pm en
// Gómez Palacio ocurre a las 00:46 UTC del día siguiente, así que
// `toLocaleDateString()` y `getDate()` en el servidor la fechaban un día
// después. Eso salía en la lista de pedidos ("24-oct" en una venta del 23)
// y, peor, en las estadísticas: las ventas de la tarde se sumaban al día,
// la hora, el día de la semana y hasta el mes equivocados.
//
// Lo que se guarda en la base está bien: un Date es un instante y se guarda
// como tal. Lo que estaba mal era leerlo con el huso del servidor.
// ============================================================

/** Zona del negocio. Durango no cambia de horario desde 2022. */
export const TIMEZONE = 'America/Mexico_City';

/**
 * El mismo desfase, en el formato que entienden las funciones de fecha de
 * SQLite: DATE(createdAt, TZ_SQL_OFFSET) da el día del negocio, no el de UTC.
 * Va fijo porque Durango no tiene horario de verano desde 2022. Si algún día
 * volviera, habría que agrupar en JS (con localParts) en vez de en SQL.
 */
export const TZ_SQL_OFFSET = '-6 hours';

export interface LocalParts {
  year: number;
  /** 1–12, no 0–11 como getMonth(). */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo, como getDay(). */
  weekday: number;
}

/** Las partes de un instante vistas desde la zona del negocio. */
export function localParts(date: Date | string | number, timeZone = TIMEZONE): LocalParts {
  const d = new Date(date);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);

  const v: Record<string, string> = {};
  for (const p of partes) v[p.type] = p.value;

  const year = Number(v.year);
  const month = Number(v.month);
  const day = Number(v.day);

  return {
    year,
    month,
    day,
    // '24' a medianoche en algunos entornos: se normaliza a 0.
    hour: Number(v.hour) % 24,
    minute: Number(v.minute),
    // El mediodía evita cualquier borde al calcular el día de la semana.
    weekday: new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay(),
  };
}

/** 'YYYY-MM-DD' del día en la zona del negocio. Sirve para agrupar. */
export function dayKey(date: Date | string | number = new Date(), timeZone = TIMEZONE): string {
  const { year, month, day } = localParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Minutos de diferencia entre la zona del negocio y UTC para ese instante. */
function offsetMinutes(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute } = localParts(date, timeZone);
  const comoUTC = Date.UTC(year, month - 1, day, hour, minute);
  // Se truncan los segundos de los dos lados para comparar lo mismo.
  const real = Math.floor(date.getTime() / 60000) * 60000;
  return (comoUTC - real) / 60000;
}

/**
 * El instante en que empieza ese día en la zona del negocio.
 * startOfDay('2026-10-23') → 2026-10-23T06:00:00Z (medianoche en México).
 */
export function startOfDay(date: Date | string = new Date(), timeZone = TIMEZONE): Date {
  const clave = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : dayKey(date, timeZone);

  const tentativo = new Date(`${clave}T00:00:00Z`);
  return new Date(tentativo.getTime() - offsetMinutes(tentativo, timeZone) * 60000);
}

/** El último milisegundo de ese día en la zona del negocio. */
export function endOfDay(date: Date | string = new Date(), timeZone = TIMEZONE): Date {
  return new Date(startOfDay(date, timeZone).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** El primer instante de ese mes (month va de 1 a 12), en la zona del negocio. */
export function startOfMonth(year: number, month: number, timeZone = TIMEZONE): Date {
  return startOfDay(`${year}-${String(month).padStart(2, '0')}-01`, timeZone);
}

/** El primer instante del año, en la zona del negocio. */
export function startOfYear(year: number, timeZone = TIMEZONE): Date {
  return startOfDay(`${year}-01-01`, timeZone);
}

// ── Formato para mostrar ──────────────────────────────────────
// Son envoltorios de toLocaleDateString que fijan la zona. Usarlos en vez
// del método directo: sin timeZone, en el servidor sale la fecha en UTC.

export function formatDate(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
  locale = 'es-MX',
): string {
  if (date == null) return '—';
  return new Date(date).toLocaleDateString(locale, { timeZone: TIMEZONE, ...options });
}

export function formatDateTime(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  },
  locale = 'es-MX',
): string {
  if (date == null) return '—';
  return new Date(date).toLocaleString(locale, { timeZone: TIMEZONE, ...options });
}

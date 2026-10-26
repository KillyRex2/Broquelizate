// ============================================================
// src/utils/db-errors.ts
//
// Traducir los errores de la base de datos a algo accionable.
//
// Nace de un fallo real: el esquema de astro:db declaró una columna nueva
// (orders.updatedAt), se desplegó el código, y la migración en Turso se
// quedó sin correr. Drizzle arma la lista de columnas del INSERT desde el
// ESQUEMA, no desde las claves que le pasas, así que metía "updatedAt" con
// null aunque nadie se la diera. Contra una tabla que no la tenía, el
// insert reventaba, se caía el batch entero y el catch general devolvía un
// "Error al crear la orden" sin más.
//
// Resultado: ninguna venta del mostrador funcionó durante horas y el
// mensaje no daba ni una pista. La causa real estaba en los logs del
// servidor, que es justo donde nadie que esté cobrando puede mirar.
// ============================================================

/**
 * ¿Este error es "la base no tiene una columna que el código sí espera"?
 *
 * Devuelve un mensaje para la persona, o null si el error es otro.
 *
 * Cubre cualquier columna futura, no solo la que lo provocó: mientras el
 * esquema vaya por delante de la base, el mensaje lo dice con nombre y
 * apellido en vez de dejar un 500 mudo.
 */
export function describeSchemaError(error: unknown): string | null {
  const mensaje = String((error as any)?.message ?? error ?? '');

  // SQLite / libSQL dicen una de estas dos, según sea INSERT o SELECT:
  //   table orders has no column named updatedAt
  //   no such column: updatedAt
  const enInsert = mensaje.match(/has no column named ["'`]?([\w]+)/i);
  const enSelect = mensaje.match(/no such column:?\s*["'`]?([\w.]+)/i);
  const columna = enInsert?.[1] ?? enSelect?.[1];

  if (!columna) return null;

  const limpia = columna.includes('.') ? columna.split('.').pop() : columna;

  return `La base de datos no tiene la columna "${limpia}", que esta versión del sitio ya usa. `
    + `Falta correr la migración pendiente de db/migrations/ en Turso.`;
}

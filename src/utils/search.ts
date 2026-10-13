/**
 * Normalizacion de texto para busquedas.
 *
 * El problema: SQLite (y por tanto Turso) no normaliza acentos, y su LOWER()
 * solo entiende ASCII. Entonces:
 *
 *   LOWER('Ópalo')            -> 'Ópalo'    (la Ó se queda igual)
 *   'ópalo' LIKE '%opalo%'    -> 0 filas
 *
 * Resultado: buscar "opalo" no encontraba "Ópalo (pieza)". Buscar "palo" si,
 * porque el patron casa dentro de la palabra.
 *
 * La solucion es normalizar LOS DOS lados de la comparacion:
 *   - el termino que escribe el usuario, con normalizeSearch() en JS
 *   - la columna, con unaccentSqlExpr() dentro de la consulta
 *
 * Al normalizar ambos de la misma forma, da igual como se escriba: "opalo",
 * "Ópalo", "ÓPALO" y "ópalo" encuentran lo mismo.
 */

/** Pares acento -> letra base. Cubre el espanol completo, mayus y minus. */
const ACCENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['á', 'a'], ['é', 'e'], ['í', 'i'], ['ó', 'o'], ['ú', 'u'], ['ü', 'u'], ['ñ', 'n'],
  ['Á', 'a'], ['É', 'e'], ['Í', 'i'], ['Ó', 'o'], ['Ú', 'u'], ['Ü', 'u'], ['Ñ', 'n'],
];

/**
 * Pasa a minusculas y quita acentos. Para usar en JS (cliente o servidor).
 * 'Ópalo' -> 'opalo' · '3 Piedras Ópalo' -> '3 piedras opalo'
 */
export function normalizeSearch(text: string | null | undefined): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')                 // separa la letra de su acento
    .replace(/[̀-ͯ]/g, '')  // elimina los acentos sueltos
    .trim();
}

/**
 * Construye la expresion SQL que hace lo mismo que normalizeSearch(), pero
 * del lado de la columna. SQLite no trae una funcion unaccent(), asi que se
 * arma anidando REPLACE() sobre LOWER().
 *
 * Uso con Drizzle:
 *   sql`${sql.raw(unaccentSqlExpr('"Product"."name"'))} LIKE ${patron}`
 *
 * OJO: columnRef se interpola tal cual en el SQL, asi que SIEMPRE debe ser
 * un literal escrito en el codigo ('"Product"."name"'), nunca algo que venga
 * del usuario. El termino de busqueda si va parametrizado por Drizzle.
 *
 * Costo: obliga a recorrer la tabla aplicando 14 REPLACE por fila, asi que no
 * usa indice. Con ~200 productos es irrelevante. Si el catalogo creciera a
 * decenas de miles, lo correcto seria una columna searchName ya normalizada,
 * llenada al guardar, e indexada.
 */
export function unaccentSqlExpr(columnRef: string): string {
  return ACCENT_PAIRS.reduce(
    (expr, [from, to]) => `REPLACE(${expr}, '${from}', '${to}')`,
    `LOWER(${columnRef})`
  );
}

/** Patron LIKE ya normalizado: 'Ópalo' -> '%opalo%' */
export function likePattern(text: string | null | undefined): string {
  return `%${normalizeSearch(text)}%`;
}

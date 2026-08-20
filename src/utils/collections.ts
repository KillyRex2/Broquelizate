// ============================================================
// src/utils/collections.ts
//
// Trae los carruseles del home en 3 rondas de consultas, sin
// importar cuantas colecciones tenga el cliente:
//
//   ronda 1 → las colecciones activas
//   ronda 2 → [links manuales] + [1 query por coleccion auto]  ← en paralelo
//   ronda 3 → [productos de las manuales] + [todas las imagenes] ← en paralelo
//
// Turso va por HTTP: cada query es un viaje de red. Lanzarlas
// secuencialmente con un for/await seria N viajes en serie;
// asi son 3 esperas totales aunque haya 12 carruseles.
// ============================================================

import {
  db, eq, and, gt, asc, inArray,
  Product, ProductImage, Collection, CollectionProduct,
} from 'astro:db';
import type { CarouselProduct } from '@/components/ProductCarousel.astro';

export interface HomeCarousel {
  id: string;
  title: string;
  href: string;
  linkText: string;
  products: CarouselProduct[];
}

const PLACEHOLDER = 'https://placehold.co/400x533/1a1a1a/eab308?text=Sin+Imagen';

/** Campos que el admin puede usar como filtro en mode='auto' */
const FILTERABLE = {
  category: Product.category,
  type: Product.type,
  allowsEngraving: Product.allowsEngraving,
  isFeatured: Product.isFeatured,
} as const;

type FilterField = keyof typeof FILTERABLE;

function buildCondition(col: { filterField: string | null; filterValue: string | null }) {
  // Siempre exigimos stock: un carrusel del home con productos agotados
  // manda al usuario a una ficha donde no puede comprar.
  const inStock = gt(Product.stock, 0);

  const field = col.filterField as FilterField | null;
  if (!field || !(field in FILTERABLE)) return inStock;

  const column = FILTERABLE[field];
  const raw = col.filterValue ?? '';

  // Los booleanos llegan como texto desde el formulario del admin
  if (field === 'allowsEngraving' || field === 'isFeatured') {
    return and(inStock, eq(column as any, raw === 'true'));
  }
  return and(inStock, eq(column as any, raw));
}

const PRODUCT_FIELDS = {
  id: Product.id,
  name: Product.name,
  price: Product.price,
  slug: Product.slug,
  stock: Product.stock,
  hasVariants: Product.hasVariants,
  coverImageId: Product.coverImageId,
};

export async function getHomeCarousels(): Promise<HomeCarousel[]> {
  // ── Ronda 1 ──
  const collections = await db
    .select()
    .from(Collection)
    .where(eq(Collection.isActive, true))
    .orderBy(asc(Collection.sortOrder));

  if (collections.length === 0) return [];

  const manualCols = collections.filter(c => c.mode === 'manual');
  const autoCols = collections.filter(c => c.mode !== 'manual');

  // ── Ronda 2: todo en paralelo ──
  const [manualLinks, ...autoResults] = await Promise.all([
    manualCols.length > 0
      ? db
          .select()
          .from(CollectionProduct)
          .where(inArray(CollectionProduct.collectionId, manualCols.map(c => c.id)))
          .orderBy(asc(CollectionProduct.position))
      : Promise.resolve([] as Array<{ collectionId: string; productId: string; position: number }>),
    ...autoCols.map(c =>
      db.select(PRODUCT_FIELDS).from(Product).where(buildCondition(c)).limit(c.limit ?? 10)
    ),
  ]);

  // ── Ronda 3: productos manuales + imagenes de TODO, en paralelo ──
  const manualProductIds = [...new Set(manualLinks.map(l => l.productId))];
  const autoProductIds = autoResults.flat().map(p => p.id);

  const [manualProducts, images] = await Promise.all([
    manualProductIds.length > 0
      ? db.select(PRODUCT_FIELDS).from(Product).where(inArray(Product.id, manualProductIds))
      : Promise.resolve([] as any[]),
    // Nota: las imagenes de los productos manuales se piden por su id,
    // que ya conocemos antes de traer los productos. Por eso caben en la
    // misma ronda y no hace falta una cuarta.
    [...manualProductIds, ...autoProductIds].length > 0
      ? db
          .select({ id: ProductImage.id, productId: ProductImage.productId, image: ProductImage.image })
          .from(ProductImage)
          .where(inArray(ProductImage.productId, [...new Set([...manualProductIds, ...autoProductIds])]))
      : Promise.resolve([] as any[]),
  ]);

  // ── Armado en memoria (sin mas viajes a la base) ──
  const imagesByProduct = new Map<string, typeof images>();
  for (const img of images) {
    const arr = imagesByProduct.get(img.productId);
    if (arr) arr.push(img);
    else imagesByProduct.set(img.productId, [img]);
  }

  const toCarouselProduct = (p: any, badge?: string | null): CarouselProduct => {
    const imgs = imagesByProduct.get(p.id) ?? [];
    const cover = p.coverImageId ? imgs.find(i => i.id === p.coverImageId) : null;
    const primary = cover || imgs[0];
    const secondary = imgs.find(i => i.id !== primary?.id);
    return {
      name: p.name,
      price: p.price,
      image: primary?.image || PLACEHOLDER,
      hoverImage: secondary?.image,
      slug: p.slug,
      badge: badge || undefined,
    };
  };

  const productsById = new Map(manualProducts.map((p: any) => [p.id, p]));
  const linksByCollection = new Map<string, typeof manualLinks>();
  for (const link of manualLinks) {
    const arr = linksByCollection.get(link.collectionId);
    if (arr) arr.push(link);
    else linksByCollection.set(link.collectionId, [link]);
  }

  const autoByCollectionId = new Map(autoCols.map((c, i) => [c.id, autoResults[i] ?? []]));

  return collections
    .map(c => {
      const rows =
        c.mode === 'manual'
          ? (linksByCollection.get(c.id) ?? [])
              .map(l => productsById.get(l.productId))
              .filter(Boolean)
              .slice(0, c.limit ?? 10)
          : autoByCollectionId.get(c.id) ?? [];

      return {
        id: c.id,
        title: c.title,
        href: c.href || '/products',
        linkText: c.linkText || 'Ver todo',
        products: rows.map((p: any) => toCarouselProduct(p, c.badge)),
      };
    })
    // Una coleccion sin productos no se pinta: mejor que un carrusel vacio
    .filter(c => c.products.length > 0);
}
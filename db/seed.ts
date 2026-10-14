import { db, Role, User, Product, ProductImage, CatalogOption, eq } from 'astro:db';
import { v4 as UUID } from 'uuid';
import bcrypt from 'bcryptjs';
import { seedProducts } from './seed-data';

// https://astro.build/db/seed
//
// Este seed llena SOLO la base local de desarrollo (.astro/content.db).
// Astro lo corre al levantar `astro dev` sin --remote. Nunca toca Turso.
//
// Existe para que no haga falta desarrollar contra produccion: con la base
// local vacia, `astro dev` daba una tienda sin productos y, desde que los
// materiales salen de CatalogOption, tambien selects vacios en el admin.
// Eso empujaba a usar `astro dev --remote`, que escribe en la tienda real.
//
// Es idempotente: lo que ya existe se respeta.

/** Cuantos productos de seed-data.ts insertar. Son 1527 en total; con una
 *  muestra alcanza para listas, filtros, busqueda y POS, y arranca rapido.
 *  Subelo si necesitas probar con volumen. */
const SEED_PRODUCT_LIMIT = 80;

/** Credenciales SOLO locales. A proposito no son las de la tienda real: este
 *  archivo vive en el repo y nadie deberia poder entrar a produccion con lo
 *  que diga aqui. */
const LOCAL_ADMIN = { email: 'admin@local.test', password: 'admin123' };

const CATALOG_MATERIALS: Array<[string, string, string]> = [
  ['mat-titanio', 'Titanio', '#b9bec6'],
  ['mat-acero-quirurgico', 'Acero Quirúrgico', '#c6ccd4'],
  ['mat-acero-inoxidable', 'Acero Inoxidable', '#bcc2ca'],
  ['mat-plata', 'Plata', '#d2d7dc'],
  ['mat-plata-925', 'Plata .925', '#dce1e6'],
  ['mat-rodio', 'Rodio', '#e2e6ea'],
  ['mat-oro-10k', 'Oro 10k', '#d7b471'],
  ['mat-oro-10k-cadenas', 'Oro 10k cadenas', '#d7b471'],
  ['mat-oro-10k-anillos', 'Oro 10k anillos', '#d7b471'],
  ['mat-oro-10k-arracadas', 'Oro 10k arracadas', '#d7b471'],
  ['mat-oro-14k', 'Oro 14k', '#dcb45e'],
  ['mat-oro-18k', 'Oro 18k', '#e3bb48'],
  ['mat-chapa-14k', 'Chapa de Oro 14K', 'linear-gradient(135deg,#dcb45e 50%,#c9ced6 50%)'],
  ['mat-chapa-18k', 'Chapa de Oro 18K', 'linear-gradient(135deg,#e3bb48 50%,#c9ced6 50%)'],
  ['mat-plastico', 'Plástico', '#e9e4dd'],
  ['mat-otros', 'Otros', '#cfcac3'],
];

const CATALOG_TYPES: Array<[string, string]> = [
  ['tipo-anillos', 'Anillos'],
  ['tipo-broqueles', 'Broqueles'],
  ['tipo-pulseras', 'Pulseras'],
  ['tipo-cadenas', 'Cadenas'],
  ['tipo-personalizada', 'Joyería personalizada'],
  ['tipo-otros', 'Otros'],
];

export default async function seed() {
  console.log('🌱 Seed local...');

  // ── Roles ──
  const roles = [
    { id: 'admin', name: 'Administrator' },
    { id: 'worker', name: 'Worker' },
    { id: 'user', name: 'client' },
  ];
  for (const role of roles) {
    const exists = await db.select().from(Role).where(eq(Role.id, role.id)).get();
    if (!exists) await db.insert(Role).values(role);
  }
  console.log(`   roles: ${roles.length}`);

  // ── Usuario admin local ──
  const admin = {
    id: 'local-admin',
    name: 'Admin Local',
    email: LOCAL_ADMIN.email,
    password: bcrypt.hashSync(LOCAL_ADMIN.password, 10),
    rol: 'admin',
    createdAt: new Date(),
  };
  const adminExists = await db.select().from(User).where(eq(User.id, admin.id)).get();
  if (!adminExists) await db.insert(User).values(admin);

  // ── Catálogos (materiales y tipos de joya) ──
  const existingCatalog = await db.select({ id: CatalogOption.id }).from(CatalogOption);
  if (existingCatalog.length === 0) {
    await db.insert(CatalogOption).values([
      ...CATALOG_MATERIALS.map(([id, name, swatch], i) => ({
        id, kind: 'material', name, swatch,
        sortOrder: (i + 1) * 10, isActive: true, createdAt: new Date(),
      })),
      ...CATALOG_TYPES.map(([id, name], i) => ({
        id, kind: 'jewelryType', name, swatch: null,
        sortOrder: (i + 1) * 10, isActive: true, createdAt: new Date(),
      })),
    ]);
    console.log(`   catálogos: ${CATALOG_MATERIALS.length} materiales, ${CATALOG_TYPES.length} tipos`);
  } else {
    console.log(`   catálogos: ya existen (${existingCatalog.length})`);
  }

  // ── Productos ──
  const existingProducts = await db.select({ id: Product.id }).from(Product);
  if (existingProducts.length === 0) {
    const slice = seedProducts.slice(0, SEED_PRODUCT_LIMIT);
    const queries: any[] = [];

    for (const p of slice) {
      const product = {
        id: UUID(),
        name: p.name,
        price: p.price,
        description: p.description,
        category: p.category,
        slug: p.slug,
        type: p.type,
        stock: p.stock,
        piercing_name: p.piercing_name.join(','),
        cost: p.cost ?? null,
        hasVariants: false,
        customizationFields: '[]',
        allowsEngraving: false,
        coverImageId: null,
        isFeatured: false,
        isDeleted: false,
        user: admin.id,
      };
      // `as any` por el mismo motivo que en register.action.ts: los tipos que
      // genera astro:db dejan fuera la clave primaria en el tipo de insert,
      // asi que pasar `id` no compila aunque en tiempo de ejecucion es
      // justamente lo que hay que mandar.
      queries.push(db.insert(Product).values(product as any));

      for (const img of p.images) {
        queries.push(db.insert(ProductImage).values({
          id: UUID(),
          productId: product.id,
          variantId: null,
          combinationId: null,
          image: img,
        } as any));
      }
    }

    // db.batch espera una tupla con al menos un elemento, no un array suelto.
    if (queries.length > 0) {
      await db.batch(queries as [any, ...any[]]);
    }
    console.log(`   productos: ${slice.length} de ${seedProducts.length} (SEED_PRODUCT_LIMIT)`);
  } else {
    console.log(`   productos: ya existen (${existingProducts.length})`);
  }

  console.log(`\n✅ Seed listo. Admin local: ${LOCAL_ADMIN.email} / ${LOCAL_ADMIN.password}\n`);
}

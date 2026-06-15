import { db, Product, ProductVariant, ProductVariantCombination, eq } from 'astro:db';
import { sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Validar autenticación
    const session = await getSession(request);
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { products } = await request.json();

    if (!Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: 'Datos inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Limitar cantidad de updates
    if (products.length > 100) {
      return new Response(JSON.stringify({ error: 'Demasiados productos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }


const productsToSync = new Set<string>();

    for (const item of products) {
      const qty = Math.max(1, Math.min(999, Math.floor(Number(item.quantity) || 0)));
      if (qty <= 0) continue;

      const itemVariantId = (item.variantId && typeof item.variantId === 'string') ? item.variantId : null;
      const itemProductId = (item.productId && typeof item.productId === 'string') ? item.productId : null;

      if (itemVariantId) {
        // El id puede ser una COMBINACIÓN (productos de 2+ grupos) o una VARIANTE suelta (1 grupo).
        // Intentamos primero como combinación.
        const combo = await db
          .select()
          .from(ProductVariantCombination)
          .where(eq(ProductVariantCombination.id, itemVariantId));

        if (combo.length > 0) {
          // Es combinación → descontar en ProductVariantCombination
          await db.run(sql`
            UPDATE ${ProductVariantCombination}
            SET stock = stock - ${qty}
            WHERE id = ${itemVariantId}
          `);
          productsToSync.add(combo[0].productId);
        } else {
          // Es variante suelta → descontar en ProductVariant
          await db.run(sql`
            UPDATE ${ProductVariant}
            SET stock = stock - ${qty}
            WHERE id = ${itemVariantId}
          `);
          if (itemProductId) productsToSync.add(itemProductId);
        }
      } else if (itemProductId) {
        // Producto simple sin variantes
        await db.run(sql`
          UPDATE ${Product}
          SET stock = stock - ${qty}
          WHERE id = ${itemProductId}
        `);
      }
    }

    // Re-sincronizar el stock base: Product.stock = suma de combinaciones (si hay) o de variantes.
    for (const productId of productsToSync) {
      const combos = await db
        .select()
        .from(ProductVariantCombination)
        .where(eq(ProductVariantCombination.productId, productId));

      let total: number;
      if (combos.length > 0) {
        total = combos.reduce((sum, c) => sum + (c.stock || 0), 0);
      } else {
        const variants = await db
          .select()
          .from(ProductVariant)
          .where(eq(ProductVariant.productId, productId));
        total = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      }

      await db.update(Product)
        .set({ stock: total } as any)
        .where(eq(Product.id, productId));
    }

    return new Response(JSON.stringify({ message: 'Stock actualizado' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Error al actualizar stock' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
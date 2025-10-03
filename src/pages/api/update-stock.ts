// src/pages/api/update-stock.ts
import { db, Product, ProductVariant } from 'astro:db';
import { eq, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { products } = await request.json();

    // Procesar cada producto/variante
    for (const item of products) {
      if (item.variantId) {
        // Actualizar stock de la variante usando sintaxis SQL raw
        await db.run(sql`
          UPDATE ${ProductVariant} 
          SET stock = stock - ${item.quantity}
          WHERE id = ${item.variantId}
        `);
      } else {
        // Actualizar stock del producto principal usando sintaxis SQL raw
        await db.run(sql`
          UPDATE ${Product} 
          SET stock = stock - ${item.quantity}
          WHERE id = ${item.productId}
        `);
      }
    }

    return new Response(JSON.stringify({
      message: 'Stock actualizado exitosamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Error al actualizar el stock'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
// src/pages/api/update-stock.ts
import { db, Product } from 'astro:db';
import { eq, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { products } = await request.json();

    // El bucle ahora procesará cada producto sin verificar el stock primero.
    for (const item of products) {
      // ✅ SE HA ELIMINADO EL BLOQUE DE VERIFICACIÓN DE STOCK.
      // Ahora la actualización se realiza directamente.
      // Si el stock es 5 y se venden 10, el nuevo stock será -5.
      await db.update(Product)
        .set({ stock: sql`${Product.stock} - ${item.quantity}` })
        .where(eq(Product.id, item.id));
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
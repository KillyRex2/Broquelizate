// src/pages/api/update-stock.ts
import { db, Product } from 'astro:db';
import { eq, sql } from 'drizzle-orm';
import type { APIRoute } from 'astro';

// ⚠️ Solo admin. Antes era público: cualquiera podía vaciar el inventario.
// La tienda online ya no lo usa: /api/create-order descuenta el stock
// después de verificar el pago.
export const POST: APIRoute = async ({ request, locals }) => {
  if (!(locals as any)?.isAdmin) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { products } = await request.json();

    for (const item of products) {
      // Verificar stock suficiente
      const [product] = await db.select()
        .from(Product)
        .where(eq(Product.id, item.id))
        .limit(1);

      if (!product) {
        throw new Error(`Producto no encontrado: ${item.id}`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para: ${product.name}`);
      }

      // Actualizar stock
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
import { db, Product, ProductVariant } from 'astro:db';
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

    for (const item of products) {
      // Validar que quantity sea un número razonable
      const qty = Math.max(1, Math.min(999, Math.floor(Number(item.quantity) || 0)));
      if (qty <= 0) continue;

      if (item.variantId && typeof item.variantId === 'string') {
        await db.run(sql`
          UPDATE ${ProductVariant} 
          SET stock = stock - ${qty}
          WHERE id = ${item.variantId}
        `);
      } else if (item.productId && typeof item.productId === 'string') {
        await db.run(sql`
          UPDATE ${Product} 
          SET stock = stock - ${qty}
          WHERE id = ${item.productId}
        `);
      }
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
// src/pages/api/get-order.ts
import { db, orders, order_items, Product, ProductImage, ProductVariantCombination, VariantCombinationItem, ProductVariant } from 'astro:db';
import { eq, and } from 'drizzle-orm';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');
    
    if (!orderId) {
      return new Response(JSON.stringify({
        error: 'Falta el parámetro order_id'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Buscar la orden principal
    const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
    
    if (!order) {
      return new Response(JSON.stringify({
        error: 'Orden no encontrada'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Buscar los items de la orden
    const items = await db.select().from(order_items).where(eq(order_items.orderId, orderId)).all();

    // Enriquecer los items con imágenes de productos
    const enrichedItems = await Promise.all(items.map(async (item) => {
      let productImage: string | null = null;
      let variantImage: string | null = null;
      let variantSku: string | null = null;

      try {
        // 1. Buscar imagen principal del producto
        if (item.productId) {
          const images = await db
            .select()
            .from(ProductImage)
            .where(eq(ProductImage.productId, item.productId))
            .all();
          
          // Buscar imagen sin variante (imagen principal del producto)
          const mainImage = images.find(img => !img.variantId);
          if (mainImage) {
            productImage = mainImage.image;
          } else if (images.length > 0) {
            // Si no hay imagen principal, usar la primera disponible
            productImage = images[0].image;
          }

          // 2. Si hay variante, buscar su imagen específica
          if (item.variantCombinationId) {
            // Obtener la combinación de variante
            const combination = await db
              .select()
              .from(ProductVariantCombination)
              .where(eq(ProductVariantCombination.id, item.variantCombinationId))
              .get();
            
            if (combination) {
              variantSku = combination.sku || null;
              
              // Buscar los items de la combinación para obtener los variantIds
              const combinationItems = await db
                .select()
                .from(VariantCombinationItem)
                .where(eq(VariantCombinationItem.combinationId, item.variantCombinationId))
                .all();
              
              // Buscar imagen específica de alguna de las variantes
              for (const combItem of combinationItems) {
                const variantImg = images.find(img => img.variantId === combItem.variantId);
                if (variantImg) {
                  variantImage = variantImg.image;
                  break;
                }
              }
            }
          }
        }
      } catch (imgError) {
        console.warn('Error obteniendo imagen para item:', item.id, imgError);
      }

      return {
        ...item,
        productImage: productImage,
        variantImage: variantImage,
        variantSku: variantSku,
        // Usar la imagen de variante si existe, sino la del producto
        image: variantImage || productImage
      };
    }));

    // Parsear shippingInfo si existe en la orden
    let shippingInfo = null;
    if ((order as any).shippingInfo) {
      try {
        shippingInfo = typeof (order as any).shippingInfo === 'string' 
          ? JSON.parse((order as any).shippingInfo) 
          : (order as any).shippingInfo;
      } catch (e) {
        // Ignorar error de parseo
      }
    }

    return new Response(JSON.stringify({
      ...order,
      shippingInfo,
      items: enrichedItems
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error en get-order:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Error al obtener la orden'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

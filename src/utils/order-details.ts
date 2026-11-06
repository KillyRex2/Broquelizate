// src/utils/order-details.ts
//
// Arma un pedido completo: la orden, sus artículos y las imágenes de cada
// uno. Lo usan la página de "gracias por tu compra" y el endpoint de admin.
//
// Vivía dentro de /api/get-order.ts, y eso tenía dos problemas:
//
//   1. order-success.astro, que corre en el servidor, le hacía fetch por
//      HTTP a su propio sitio para conseguir estos datos. Una vuelta
//      completa por la red para preguntarse algo a sí mismo.
//   2. Por eso el endpoint tenía que ser público, y devolvía la fila entera
//      de la orden: correo del cliente, dirección de envío, total, id de
//      pago y número de guía. Sin pedir nada. El id es un UUID, así que no
//      se adivina a la fuerza, pero un UUID se filtra solo: queda en el
//      historial del navegador, en un link que alguien comparte, en el
//      Referer. No es la clase de dato que debe sostenerse en eso.
//
// Ahora la página llama a esta función directo y el endpoint quedó para
// admin. Un viaje de red menos en la página que ve todo el que compra.

import {
  db, orders, order_items,
  ProductImage, ProductVariantCombination, VariantCombinationItem,
} from 'astro:db';
import { eq } from 'drizzle-orm';

function parseJson<T = any>(valor: unknown): T | null {
  if (valor == null) return null;
  if (typeof valor !== 'string') return valor as T;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return null;
  }
}

/**
 * Devuelve el pedido con sus artículos enriquecidos, o null si no existe.
 *
 * Ojo al mantenerlo: por cada artículo se consulta ProductImage. Con los
 * dos o tres artículos de un pedido normal da igual, pero si algún día se
 * usa para listar muchos pedidos a la vez hay que agruparlo.
 */
export async function getOrderDetails(orderId: string) {
  const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return null;

  const items = await db.select().from(order_items).where(eq(order_items.orderId, orderId)).all();

  const enrichedItems = await Promise.all(items.map(async (item: any) => {
    let productImage: string | null = null;
    let variantImage: string | null = null;
    let variantSku: string | null = null;

    try {
      if (item.productId) {
        const images = await db
          .select()
          .from(ProductImage)
          .where(eq(ProductImage.productId, item.productId))
          .all();

        // La principal es la que no está atada a una variante; si no hay,
        // cualquiera sirve antes que dejar el hueco.
        const mainImage = images.find((img: any) => !img.variantId);
        productImage = mainImage ? mainImage.image : images[0]?.image ?? null;

        if (item.variantCombinationId) {
          const combination = await db
            .select()
            .from(ProductVariantCombination)
            .where(eq(ProductVariantCombination.id, item.variantCombinationId))
            .get();

          if (combination) {
            variantSku = combination.sku || null;

            const combinationItems = await db
              .select()
              .from(VariantCombinationItem)
              .where(eq(VariantCombinationItem.combinationId, item.variantCombinationId))
              .all();

            for (const combItem of combinationItems) {
              const variantImg = images.find((img: any) => img.variantId === combItem.variantId);
              if (variantImg) {
                variantImage = variantImg.image;
                break;
              }
            }
          }
        }
      }
    } catch (imgError) {
      // Sin imagen el pedido se ve feo; sin pedido el cliente se preocupa.
      console.warn('Error obteniendo imagen para item:', item.id, imgError);
    }

    return {
      ...item,
      productImage,
      variantImage,
      variantSku,
      image: variantImage || productImage,
      engraving: parseJson(item.engraving),
    };
  }));

  return {
    ...order,
    shippingInfo: parseJson((order as any).shippingInfo),
    items: enrichedItems,
  };
}

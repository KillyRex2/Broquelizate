import type { ProductWithImages } from "@/interfaces";
import { defineAction } from "astro:actions";
import { db, Product, ProductImage, inArray } from "astro:db";

/**
 * Obtiene TODOS los productos de la base de datos junto con sus imágenes asociadas.
 * Ideal para componentes del lado del administrador que necesitan la lista completa de productos,
 * como una interfaz de punto de venta (POS).
 */
export const getAllProductsWithImages = defineAction({
  handler: async (): Promise<ProductWithImages[]> => {
    try {
      // 1. Obtener todos los productos de la tabla 'Product'
      const allProducts = await db.select().from(Product);

      // Si no hay productos, devolver un arreglo vacío.
      if (allProducts.length === 0) {
        return [];
      }

      // 2. Extraer los IDs de todos los productos.
      const productIds = allProducts.map(p => p.id);

      // 3. Obtener todas las imágenes correspondientes en una sola consulta.
      const allImages = await db
        .select({
          productId: ProductImage.productId,
          image: ProductImage.image
        })
        .from(ProductImage)
        .where(inArray(ProductImage.productId, productIds));

      // 4. Mapear las imágenes a sus productos para un acceso rápido.
      const imagesMap = new Map<string, string[]>();
      for (const img of allImages) {
        if (!imagesMap.has(img.productId)) {
          imagesMap.set(img.productId, []);
        }
        imagesMap.get(img.productId)!.push(img.image);
      }

      // 5. Combinar los productos con sus imágenes y transformar los datos ✅
      const productsWithImages: ProductWithImages[] = allProducts.map(product => {
        // Lógica para las imágenes (sin cambios)
        const images = imagesMap.get(product.id) || ['no-image.png'];

        // ✅ **INICIO DEL CAMBIO**
        // Transforma el string 'piercing_name' en un arreglo.
        // Si 'piercing_name' existe y no está vacío, lo divide por comas y limpia los espacios.
        // Si es null o está vacío, devuelve un arreglo vacío para cumplir con la interfaz.
        const piercingNamesArray = product.piercing_name
          ? product.piercing_name.split(',').map(p => p.trim())
          : [];
        // ✅ **FIN DEL CAMBIO**

        // Se construye el objeto final explícitamente para que coincida con la interfaz
        return {
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          category: product.category,
          slug: product.slug,
          type: product.type,
          stock: product.stock,
          user: product.user,
          cost: product.cost,
          piercing_name: piercingNamesArray, // Usamos el nuevo arreglo
          images: images,                   // Usamos el arreglo de imágenes
        };
      });

      return productsWithImages;

    } catch (error) {
      console.error("Error al obtener todos los productos con imágenes:", error);
      throw new Error("No se pudieron obtener los productos.");
    }
  }
});
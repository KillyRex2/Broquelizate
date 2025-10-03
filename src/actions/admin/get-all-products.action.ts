// src/actions/getAllProductsWithImages.ts
import { defineAction } from 'astro:actions';
import { db, Product, ProductImage, ProductVariant, ProductVariantCombination, VariantCombinationItem } from 'astro:db';
import type { ProductWithVariants, ProductForPOS } from '@/interfaces';
import { convertToProductForPOS } from '@/interfaces';

/**
 * Obtiene todos los productos con sus variantes y combinaciones
 * y los convierte al formato simplificado para el POS
 */
export const getAllProductsWithImages = defineAction({
  handler: async (): Promise<ProductForPOS[]> => {
    try {
      // 1. Obtener todos los datos necesarios
      const [
        allProducts, 
        allVariants, 
        allCombinations,
        allCombinationItems,
        allImages
      ] = await Promise.all([
        db.select().from(Product),
        db.select().from(ProductVariant),
        db.select().from(ProductVariantCombination),
        db.select().from(VariantCombinationItem),
        db.select().from(ProductImage),
      ]);

      if (allProducts.length === 0) {
        return [];
      }

      // 2. Mapear datos para acceso rápido
      
      // Variantes por producto
      const variantsByProduct = new Map<string, typeof allVariants>();
      for (const variant of allVariants) {
        if (!variantsByProduct.has(variant.productId)) {
          variantsByProduct.set(variant.productId, []);
        }
        variantsByProduct.get(variant.productId)!.push(variant);
      }

      // Combinaciones por producto
      const combinationsByProduct = new Map<string, typeof allCombinations>();
      for (const combination of allCombinations) {
        if (!combinationsByProduct.has(combination.productId)) {
          combinationsByProduct.set(combination.productId, []);
        }
        combinationsByProduct.get(combination.productId)!.push(combination);
      }

      // Items de combinación por combinación
      const itemsByCombination = new Map<string, typeof allCombinationItems>();
      for (const item of allCombinationItems) {
        if (!itemsByCombination.has(item.combinationId)) {
          itemsByCombination.set(item.combinationId, []);
        }
        itemsByCombination.get(item.combinationId)!.push(item);
      }

      // Imágenes por producto y por variante
      const imagesByProduct = new Map<string, string[]>();
      const imagesByVariant = new Map<string, string[]>();
      
      // TODO: Implementar imágenes por combinación cuando se agregue combinationId a ProductImage
      // const imagesByCombination = new Map<string, string[]>();
      
      for (const image of allImages) {
        // Imágenes por producto
        if (image.productId) {
          if (!imagesByProduct.has(image.productId)) {
            imagesByProduct.set(image.productId, []);
          }
          imagesByProduct.get(image.productId)!.push(image.image);
        }
        
        // TODO: Agregar lógica para imágenes por combinación cuando esté disponible
        // if (image.combinationId) {
        //   if (!imagesByCombination.has(image.combinationId)) {
        //     imagesByCombination.set(image.combinationId, []);
        //   }
        //   imagesByCombination.get(image.combinationId)!.push(image.image);
        // }
        
        // Imágenes por variante (si tu esquema lo soporta)
        if (image.variantId) {
          if (!imagesByVariant.has(image.variantId)) {
            imagesByVariant.set(image.variantId, []);
          }
          imagesByVariant.get(image.variantId)!.push(image.image);
        }
      }

      // 3. Construir productos con toda la información
      const productsForPOS: ProductForPOS[] = allProducts.map(product => {
        const productVariants = variantsByProduct.get(product.id) || [];
        const productCombinations = combinationsByProduct.get(product.id) || [];
        
        // Obtener todas las imágenes del producto
        let productImages = imagesByProduct.get(product.id) || [];
        
        // Si no hay imágenes directas del producto, intentar obtener de las variantes
        if (productImages.length === 0 && productVariants.length > 0) {
          for (const variant of productVariants) {
            const variantImages = imagesByVariant.get(variant.id) || [];
            productImages.push(...variantImages);
          }
          // Eliminar duplicados
          productImages = [...new Set(productImages)];
        }
        
        // Si aún no hay imágenes, usar placeholder
        if (productImages.length === 0) {
          productImages = ['https://placehold.co/400x400/e2e8f0/4a5568?text=Sin+Imagen'];
        }
        
        // Calcular stock total
        let totalStock = 0;
        
        if (productCombinations.length > 0) {
          // Si hay combinaciones, el stock es la suma de todas las combinaciones activas
          totalStock = productCombinations
            .filter(c => c.isActive)
            .reduce((sum, c) => sum + (c.stock || 0), 0);
        } else if (productVariants.length > 0) {
          // Si solo hay variantes simples, sumar su stock
          totalStock = productVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        } else {
          // Producto simple sin variantes
          totalStock = product.stock || 0;
        }

        const piercingNamesArray = product.piercing_name
          ? product.piercing_name.split(',').map(p => p.trim())
          : [];

        // Crear el producto base con el formato correcto
        const productWithVariants: ProductWithVariants = {
          id: product.id,
          name: product.name,
          price: product.price,
          basePrice: product.price,
          description: product.description,
          category: product.category,
          slug: product.slug,
          type: product.type,
          stock: totalStock,
          user: product.user,
          cost: product.cost ?? undefined,
          piercing_name: piercingNamesArray,
          images: productImages,
          hasVariants: product.hasVariants,
          // Los tipos ya coinciden correctamente con la DB
          productVariants: productVariants,
          combinations: productCombinations
        };

        // Si hay combinaciones, enriquecer con el nombre construido
        if (productCombinations.length > 0) {
          productWithVariants.combinations = productCombinations.map(combo => {
            // TODO: Agregar imágenes específicas de combinación cuando esté disponible
            // const comboImages = imagesByCombination.get(combo.id) || [];
            
            const comboItems = itemsByCombination.get(combo.id) || [];
            
            // Construir el nombre de la combinación basado en las variantes si no existe
            let combinationName = combo.combinationName;
            if (!combinationName && comboItems.length > 0) {
              const variantNames = comboItems.map(item => {
                const variant = productVariants.find(v => v.id === item.variantId);
                return variant ? `${variant.variantValue}` : '';
              }).filter(Boolean).join(' - ');
              combinationName = variantNames || null;
            }
            
            // Retornar la combinación con el nombre actualizado
            return {
              ...combo,
              combinationName,
              // TODO: Agregar imágenes cuando esté disponible
              // images: comboImages.length > 0 ? comboImages : productImages
            };
          });
        }

        // Convertir a formato POS usando la función importada
        return convertToProductForPOS(productWithVariants);
      });

      return productsForPOS;

    } catch (error) {
      console.error("Error al obtener productos con imágenes:", error);
      throw new Error("No se pudieron obtener los productos.");
    }
  }
});
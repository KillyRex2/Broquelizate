// src/actions/getAllProductsWithImages.ts
import { defineAction } from 'astro:actions';
import { db, Product, ProductImage, ProductVariant, ProductVariantCombination, VariantCombinationItem, sql } from 'astro:db';
import type { ProductWithVariants, ProductForPOS } from '@/interfaces';
import { convertToProductForPOS } from '@/interfaces';
import { assertAdmin } from '../_guard';

/**
 * Obtiene todos los productos con sus variantes y combinaciones
 * y los convierte al formato simplificado para el POS
 */
export const getAllProductsWithImages = defineAction({
  handler: async (_input, context): Promise<ProductForPOS[]> => {
    // Devuelve costos de variantes/combinaciones: solo admin (antes era pública)
    assertAdmin(context);
    try {
      // 1. Obtener todos los datos necesarios
      const [
        allProducts, 
        allVariants, 
        allCombinations,
        allCombinationItems,
        allImages
      ] = await Promise.all([
        db.select().from(Product).where(sql`(${Product.isDeleted} = 0 OR ${Product.isDeleted} IS NULL)`),
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

      // Imágenes por producto, por variante y por combinación
      const imagesByProduct = new Map<string, string[]>();
      // Imágenes generales: las que no pertenecen a una variante ni a una combinación
      const generalImagesByProduct = new Map<string, string[]>();
      const imagesByVariant = new Map<string, string[]>();
      const imagesByCombination = new Map<string, string[]>();
      
      // URL de imagen por id (antes se buscaba con allImages.find por cada producto)
      const imageUrlById = new Map(allImages.map(img => [img.id, img.image]));

      // Mapa de coverImageId por producto
      const coverImageByProduct = new Map<string, string>();
      for (const product of allProducts) {
        const coverId = (product as any).coverImageId;
        if (coverId) coverImageByProduct.set(product.id, coverId);
      }

      for (const image of allImages) {
        // Imágenes por producto (guardar con id para ordenar después)
        if (image.productId) {
          if (!imagesByProduct.has(image.productId)) {
            imagesByProduct.set(image.productId, []);
          }
          imagesByProduct.get(image.productId)!.push(image.image);

          if (!image.variantId && !(image as any).combinationId) {
            if (!generalImagesByProduct.has(image.productId)) {
              generalImagesByProduct.set(image.productId, []);
            }
            generalImagesByProduct.get(image.productId)!.push(image.image);
          }
        }
        
        // Imágenes por combinación
        if ((image as any).combinationId) {
          const cid = (image as any).combinationId;
          if (!imagesByCombination.has(cid)) {
            imagesByCombination.set(cid, []);
          }
          imagesByCombination.get(cid)!.push(image.image);
        }
        
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
        
        // Obtener todas las imágenes del producto: portada, luego las generales
        // y al final las de variantes/combinaciones (así la primera nunca es la
        // foto de una variante cuando el producto tiene fotos propias)
        const generalImages = generalImagesByProduct.get(product.id) || [];
        let productImages = [...new Set([...generalImages, ...(imagesByProduct.get(product.id) || [])])];
        
        const coverId = coverImageByProduct.get(product.id);
        if (coverId) {
          // Buscar la imagen de portada en allImages para obtener su URL
          const coverUrl = imageUrlById.get(coverId);
          if (coverUrl) {
            // Mover portada al inicio
            productImages = [
              coverUrl,
              ...productImages.filter(url => url !== coverUrl)
            ];
          }
        }
        
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

        // Imágenes por variante, igual que en el inventario (la primera con su variantId)
        const variantsWithImages = productVariants.map(variant => ({
          ...variant,
          images: imagesByVariant.get(variant.id) || [],
        }));
        
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
          productVariants: variantsWithImages as any,
          combinations: productCombinations as any,
          customizationFields: (product as any).customizationFields || [],
          allowsEngraving: (product as any).allowsEngraving || false
        };

        // Si hay combinaciones, enriquecer con el nombre construido
        if (productCombinations.length > 0) {
          productWithVariants.combinations = productCombinations.map(combo => {
            const comboItems = itemsByCombination.get(combo.id) || [];
            
            let combinationName = combo.combinationName;
            if (!combinationName && comboItems.length > 0) {
              const variantNames = comboItems.map(item => {
                const variant = productVariants.find(v => v.id === item.variantId);
                return variant ? `${variant.variantValue}` : '';
              }).filter(Boolean).join(' - ');
              combinationName = variantNames || null;
            }
            
            // Igual que el inventario: la imagen con el combinationId de la combinación
            // (si hubiera varias, el inventario muestra la última).
            let comboImages = [...(imagesByCombination.get(combo.id) || [])].reverse();

            // Sin foto propia: usar la foto de alguna de sus variantes, si tiene
            if (comboImages.length === 0) {
              for (const item of comboItems) {
                const vImages = imagesByVariant.get(item.variantId) || [];
                if (vImages.length > 0) { comboImages = vImages; break; }
              }
            }

            return {
              ...combo,
              combinationName,
              images: comboImages,
            } as any;
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
import { defineAction } from 'astro:actions';
import { db, eq, and, Product, ProductVariant, ProductVariantCombination, inArray, ProductImage } from 'astro:db';
import { z } from 'astro:schema';
import { v4 as UUID } from 'uuid';
import { getSession } from 'auth-astro/server';
import type { 
  GroupedVariants 
} from '@/interfaces/product-with-variants.interface';

// --- ✅ SOLUCIÓN: Se define una interfaz explícita para el tipo de retorno ---
interface VariantCombinationResult {
  id: string;
  productId: string;
  combinationName: string | null;
  price: number;
  stock: number;
  sku: string | null;
  isActive: boolean;
  createdAt: Date;
}

// ===== OBTENER COMBINACIÓN ESPECÍFICA BASADA EN SELECCIÓN =====
export const getVariantCombination = defineAction({
  accept: 'json',
  input: z.object({
    productId: z.string(),
    selectedVariants: z.record(z.string()) // { "Color": "var_1", "Tamaño": "var_2" }
  }),
  handler: async ({ productId, selectedVariants }): Promise<VariantCombinationResult> => {
    try {
      const variantValues = Object.values(selectedVariants);

      const variants = await db
        .select()
        .from(ProductVariant)
        .where(
          and(
            eq(ProductVariant.productId, productId),
            inArray(ProductVariant.id, variantValues)
          )
        );

      if (variants.length === 0) {
        throw new Error('Variantes seleccionadas no encontradas');
      }

      const combinationName = variants
        .map(v => v.variantValue)
        .sort()
        .join(' - ');

      const [combination] = await db
        .select()
        .from(ProductVariantCombination)
        .where(
          and(
            eq(ProductVariantCombination.productId, productId),
            eq(ProductVariantCombination.combinationName, combinationName),
            eq(ProductVariantCombination.isActive, true)
          )
        );

      if (!combination) {
        // Si no existe combinación, se calcula una al vuelo
        const [baseProduct] = await db
          .select({ price: Product.price })
          .from(Product)
          .where(eq(Product.id, productId));

        if (!baseProduct) {
          throw new Error('Producto no encontrado');
        }

        const totalAdjustment = variants.reduce((sum, v) => sum + v.priceAdjustment, 0);
        const calculatedPrice = baseProduct.price + totalAdjustment;
        const availableStock = Math.min(...variants.map(v => v.stock));

        return {
          id: 'calculated',
          productId,
          combinationName,
          price: calculatedPrice,
          stock: availableStock,
          sku: null,
          isActive: availableStock > 0,
          createdAt: new Date()
        };
      }

      return {
        id: combination.id,
        productId: combination.productId,
        combinationName: combination.combinationName,
        price: combination.price,
        stock: combination.stock,
        sku: combination.sku,
        isActive: combination.isActive,
        createdAt: combination.createdAt
      };

    } catch (error: any) {
      console.error('Error getting variant combination:', error);
      throw new Error('Error al obtener la combinación de variantes');
    }
  }
});

// ===== OBTENER VARIANTES AGRUPADAS PARA UN PRODUCTO =====
export const getGroupedProductVariants = defineAction({
  accept: 'json',
  input: z.string(), // productId
  handler: async (productId) => {
    try {
      const [product] = await db.select().from(Product).where(eq(Product.id, productId));
      if (!product) throw new Error('Producto no encontrado');

      if (!product.hasVariants) {
        return { hasVariants: false, groupedVariants: {}, combinations: [] };
      }

      const variants = await db.select().from(ProductVariant).where(eq(ProductVariant.productId, productId));
      const combinations = await db.select().from(ProductVariantCombination).where(and(eq(ProductVariantCombination.productId, productId), eq(ProductVariantCombination.isActive, true)));

      const groupedVariants: GroupedVariants = {};
      variants.forEach(variant => {
        if (!groupedVariants[variant.variantName]) {
          groupedVariants[variant.variantName] = { name: variant.variantName, options: [] };
        }
        groupedVariants[variant.variantName].options.push({
          id: variant.id,
          value: variant.variantValue,
          priceAdjustment: variant.priceAdjustment,
          stock: variant.stock,
          isDefault: variant.isDefault
        });
      });

      return { hasVariants: true, groupedVariants, combinations };
    } catch (error: any) {
      console.error('Error getting grouped variants:', error);
      throw new Error('Error al obtener las variantes agrupadas');
    }
  }
});

// ===== CREAR VARIANTES EN LOTE PARA UN PRODUCTO =====
export const createBatchVariants = defineAction({
  accept: 'json',
  input: z.object({
    productId: z.string(),
    variants: z.array(z.object({
      variantName: z.string(),
      variantValue: z.string(),
      priceAdjustment: z.number(),
      stock: z.number(),
      sku: z.string().optional(),
      isDefault: z.boolean().optional().default(false)
    }))
  }),
  handler: async (input, { request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    const { productId, variants } = input;
    const [product] = await db.select().from(Product).where(eq(Product.id, productId));
    if (!product) throw new Error('Producto no encontrado');

    const variantInserts = variants.map(variant => ({
      id: UUID(),
      productId,
      variantName: variant.variantName,
      variantValue: variant.variantValue,
      priceAdjustment: variant.priceAdjustment,
      stock: variant.stock,
      sku: variant.sku,
      isDefault: variant.isDefault || false,
      isActive: true, // Asegurarnos de que esté activa
      createdAt: new Date()
    }));

    await db.update(Product).set({ hasVariants: true } as any).where(eq(Product.id, productId));
    if (variantInserts.length > 0) {
      await db.insert(ProductVariant).values(variantInserts as any);
    }
    
    return { success: true, message: 'Variantes creadas correctamente' };
  }
});

// ===== NUEVA ACCIÓN: EDITAR UNA VARIANTE INDIVIDUAL =====
export const updateVariant = defineAction({
  accept: 'json',
  input: z.object({
    variantId: z.string(),
    variantValue: z.string().optional(),
    priceAdjustment: z.number().optional(),
    stock: z.number().optional(),
    sku: z.string().nullable().optional(),
    isActive: z.boolean().optional()
  }),
  handler: async (input, { request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      throw new Error('No autorizado');
    }

    const { variantId, ...updateData } = input;
    
    try {
      // Verificar que la variante existe
      const [variant] = await db
        .select()
        .from(ProductVariant)
        .where(eq(ProductVariant.id, variantId));
      
      if (!variant) {
        throw new Error('Variante no encontrada');
      }

      // Actualizar la variante
      const dataToUpdate: any = {};
      if (updateData.variantValue !== undefined) dataToUpdate.variantValue = updateData.variantValue;
      if (updateData.priceAdjustment !== undefined) dataToUpdate.priceAdjustment = updateData.priceAdjustment;
      if (updateData.stock !== undefined) dataToUpdate.stock = updateData.stock;
      if (updateData.sku !== undefined) dataToUpdate.sku = updateData.sku;
      if (updateData.isActive !== undefined) dataToUpdate.isActive = updateData.isActive;

      await db
        .update(ProductVariant)
        .set(dataToUpdate)
        .where(eq(ProductVariant.id, variantId));

      console.log(`Variante ${variantId} actualizada:`, dataToUpdate);

      // Si se cambió el stock o el precio, actualizar las combinaciones relacionadas
      if (updateData.stock !== undefined || updateData.priceAdjustment !== undefined) {
        // Aquí podrías recalcular las combinaciones si es necesario
        console.log('Considera regenerar las combinaciones para reflejar los cambios');
      }

      return { 
        success: true, 
        message: 'Variante actualizada correctamente',
        variant: { ...variant, ...dataToUpdate }
      };
    } catch (error: any) {
      console.error('Error actualizando variante:', error);
      throw new Error(`Error al actualizar la variante: ${error.message}`);
    }
  }
});

// ===== NUEVA ACCIÓN: ELIMINAR UNA VARIANTE INDIVIDUAL =====
export const deleteVariant = defineAction({
  accept: 'json',
  input: z.string(), // variantId
  handler: async (variantId, { request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      throw new Error('No autorizado');
    }

    return await db.transaction(async (tx) => {
      try {
        // Verificar que la variante existe
        const [variant] = await tx
          .select()
          .from(ProductVariant)
          .where(eq(ProductVariant.id, variantId));
        
        if (!variant) {
          throw new Error('Variante no encontrada');
        }

        // Verificar si hay imágenes asociadas a esta variante
        const variantImages = await tx
          .select()
          .from(ProductImage)
          .where(eq(ProductImage.variantId, variantId));

        if (variantImages.length > 0) {
          // Opción 1: Reasignar las imágenes al producto principal
          await tx
            .update(ProductImage)
            .set({ variantId: null } as any)
            .where(eq(ProductImage.variantId, variantId));
          
          console.log(`${variantImages.length} imágenes reasignadas al producto principal`);
        }

        // Eliminar la variante
        await tx.delete(ProductVariant).where(eq(ProductVariant.id, variantId));
        
        console.log(`Variante ${variantId} eliminada`);

        // Verificar si quedan más variantes del mismo tipo
        const remainingVariants = await tx
          .select()
          .from(ProductVariant)
          .where(
            and(
              eq(ProductVariant.productId, variant.productId),
              eq(ProductVariant.variantName, variant.variantName)
            )
          );

        // Si no quedan variantes del mismo tipo, limpiar combinaciones
        if (remainingVariants.length === 0) {
          // Eliminar combinaciones que incluían esta variante
          await tx
            .delete(ProductVariantCombination)
            .where(eq(ProductVariantCombination.productId, variant.productId));
          
          console.log('Combinaciones eliminadas ya que no quedan variantes del tipo', variant.variantName);
        }

        // Verificar si el producto ya no tiene ninguna variante
        const allVariants = await tx
          .select()
          .from(ProductVariant)
          .where(eq(ProductVariant.productId, variant.productId));

        if (allVariants.length === 0) {
          // Actualizar el producto para indicar que ya no tiene variantes
          await tx
            .update(Product)
            .set({ hasVariants: false } as any)
            .where(eq(Product.id, variant.productId));
          
          console.log('Producto actualizado: hasVariants = false');
        }

        return { 
          success: true, 
          message: 'Variante eliminada correctamente',
          shouldRegenerateCombinations: remainingVariants.length > 0
        };
      } catch (error: any) {
        console.error('Error eliminando variante:', error);
        throw new Error(`Error al eliminar la variante: ${error.message}`);
      }
    });
  }
});

// ===== NUEVA ACCIÓN: ELIMINAR TODAS LAS VARIANTES DE UN TIPO =====
export const deleteVariantGroup = defineAction({
  accept: 'json',
  input: z.object({
    productId: z.string(),
    variantName: z.string()
  }),
  handler: async ({ productId, variantName }, { request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      throw new Error('No autorizado');
    }

    return await db.transaction(async (tx) => {
      try {
        // Obtener todas las variantes del grupo
        const variants = await tx
          .select()
          .from(ProductVariant)
          .where(
            and(
              eq(ProductVariant.productId, productId),
              eq(ProductVariant.variantName, variantName)
            )
          );

        if (variants.length === 0) {
          throw new Error('No se encontraron variantes para eliminar');
        }

        const variantIds = variants.map(v => v.id);

        // Reasignar imágenes al producto principal
        await tx
          .update(ProductImage)
          .set({ variantId: null } as any)
          .where(inArray(ProductImage.variantId, variantIds));

        // Eliminar todas las variantes del grupo
        await tx
          .delete(ProductVariant)
          .where(
            and(
              eq(ProductVariant.productId, productId),
              eq(ProductVariant.variantName, variantName)
            )
          );

        // Eliminar todas las combinaciones del producto
        await tx
          .delete(ProductVariantCombination)
          .where(eq(ProductVariantCombination.productId, productId));

        // Verificar si quedan más variantes
        const remainingVariants = await tx
          .select()
          .from(ProductVariant)
          .where(eq(ProductVariant.productId, productId));

        if (remainingVariants.length === 0) {
          await tx
            .update(Product)
            .set({ hasVariants: false } as any)
            .where(eq(Product.id, productId));
        }

        return { 
          success: true, 
          message: `Grupo de variantes "${variantName}" eliminado correctamente`,
          deletedCount: variants.length
        };
      } catch (error: any) {
        console.error('Error eliminando grupo de variantes:', error);
        throw new Error(`Error al eliminar el grupo de variantes: ${error.message}`);
      }
    });
  }
});

// ===== GENERAR COMBINACIONES AUTOMÁTICAMENTE =====
export const generateVariantCombinations = defineAction({
  accept: 'json',
  input: z.string(), // productId
  handler: async (productId, { request }) => {
    const session = await getSession(request);
    if (!session?.user) throw new Error('Unauthorized');

    const [product] = await db.select().from(Product).where(eq(Product.id, productId));
    if (!product) throw new Error('Producto no encontrado');

    const variants = await db
      .select()
      .from(ProductVariant)
      .where(
        and(
          eq(ProductVariant.productId, productId),
          eq(ProductVariant.isActive, true) // Solo variantes activas
        )
      );

    const groupedVariants: Record<string, any[]> = {};
    variants.forEach(variant => {
      if (!groupedVariants[variant.variantName]) {
        groupedVariants[variant.variantName] = [];
      }
      groupedVariants[variant.variantName].push(variant);
    });

    const variantNames = Object.keys(groupedVariants);
    if (variantNames.length < 2) {
      return { success: false, message: 'Se necesitan al menos 2 tipos de variantes para generar combinaciones' };
    }

    const generateCombinations = (groups: Record<string, any[]>, names: string[]): any[] => {
      const combinations: any[] = [];
      const generate = (current: any[], index: number) => {
        if (index >= names.length) {
          const totalPriceAdjustment = current.reduce((sum, v) => sum + v.priceAdjustment, 0);
          const finalPrice = product.price + totalPriceAdjustment;
          const minStock = Math.min(...current.map(v => v.stock));
          const combinationName = current.map(v => v.variantValue).sort().join(' - ');
          combinations.push({ 
            id: UUID(), 
            productId, 
            combinationName, 
            price: finalPrice, 
            stock: minStock, 
            sku: null, 
            isActive: minStock > 0, 
            createdAt: new Date() 
          } as any);
          return;
        }
        const currentName = names[index];
        groups[currentName].forEach(variant => {
          current.push(variant);
          generate(current, index + 1);
          current.pop();
        });
      };
      generate([], 0);
      return combinations;
    };

    const combinations = generateCombinations(groupedVariants, variantNames);
    await db.delete(ProductVariantCombination).where(eq(ProductVariantCombination.productId, productId));
    if (combinations.length > 0) {
      await db.insert(ProductVariantCombination).values(combinations);
    }

    return { success: true, message: `${combinations.length} combinaciones generadas` };
  }
});

// ===== ACTUALIZAR STOCK DE UNA COMBINACIÓN =====
export const updateCombinationStock = defineAction({
  accept: 'json',
  input: z.object({
    combinationId: z.string(),
    newStock: z.number().min(0)
  }),
  handler: async ({ combinationId, newStock }, { request }) => {
    const session = await getSession(request);
    if (!session?.user) throw new Error('Unauthorized');
    
    await db.update(ProductVariantCombination).set({ stock: newStock } as any).where(eq(ProductVariantCombination.id, combinationId));
    return { success: true, message: 'Stock actualizado' };
  }
});
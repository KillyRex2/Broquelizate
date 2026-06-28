import { defineAction } from 'astro:actions';
import { db, eq, and, Product, ProductVariant, ProductVariantCombination, inArray, ProductImage } from 'astro:db';
import { z } from 'astro:schema';
import { v4 as UUID } from 'uuid';
import { getSession } from 'auth-astro/server';
import { assertAdmin } from '../_guard';
import type { 
  GroupedVariants 
} from '@/interfaces/product-with-variants.interface';

// ===== HELPER: sincronizar precios de combinaciones (conserva stock/SKU/imágenes) =====
async function syncProductCombinations(productId: string) {
  const [product] = await db.select().from(Product).where(eq(Product.id, productId));
  if (!product) throw new Error('Producto no encontrado');

  const variants = await db
    .select()
    .from(ProductVariant)
    .where(and(eq(ProductVariant.productId, productId), eq(ProductVariant.isActive, true)));

  const grouped: Record<string, any[]> = {};
  for (const v of variants) {
    (grouped[v.variantName] ||= []).push(v);
  }
  const names = Object.keys(grouped);

  const existing = await db
    .select()
    .from(ProductVariantCombination)
    .where(eq(ProductVariantCombination.productId, productId));

  // Menos de 2 grupos: no hay combinaciones, limpiar todo.
  if (names.length < 2) {
    const ids = existing.map(c => c.id);
    if (ids.length > 0) {
      await db.batch([
        db.update(ProductImage).set({ combinationId: null } as any)
          .where(inArray(ProductImage.combinationId, ids)),
        db.delete(ProductVariantCombination)
          .where(eq(ProductVariantCombination.productId, productId)),
      ] as any);
    }
    return { generated: 0, updated: 0, inserted: 0, removed: existing.length };
  }

  type Fresh = { combinationName: string; price: number; minStock: number };
  const fresh: Fresh[] = [];
  const build = (current: any[], idx: number) => {
    if (idx >= names.length) {
      const total = current.reduce((sum, v) => sum + v.priceAdjustment, 0);
      fresh.push({
        combinationName: current.map(v => v.variantValue).sort().join(' - '),
        price: product.price + total,
        minStock: Math.min(...current.map(v => v.stock)),
      });
      return;
    }
    for (const v of grouped[names[idx]]) {
      current.push(v);
      build(current, idx + 1);
      current.pop();
    }
  };
  build([], 0);

  const existingByName = new Map(existing.map(c => [c.combinationName, c]));
  const freshNames = new Set(fresh.map(f => f.combinationName));

  const obsoleteIds = existing
    .filter(c => !freshNames.has(c.combinationName!))
    .map(c => c.id);

  const toInsert: any[] = [];
  const priceUpdates: { id: string; price: number }[] = [];

  for (const f of fresh) {
    const prev = existingByName.get(f.combinationName);
    if (prev) {
      if (prev.price !== f.price) priceUpdates.push({ id: prev.id, price: f.price });
    } else {
      toInsert.push({
        id: UUID(),
        productId,
        combinationName: f.combinationName,
        price: f.price,
        stock: f.minStock,
        sku: null,
        isActive: true,
        createdAt: new Date(),
      });
    }
  }

  const ops: any[] = [];
  if (obsoleteIds.length > 0) {
    ops.push(
      db.update(ProductImage).set({ combinationId: null } as any)
        .where(inArray(ProductImage.combinationId, obsoleteIds)),
      db.delete(ProductVariantCombination).where(inArray(ProductVariantCombination.id, obsoleteIds)),
    );
  }
  if (toInsert.length > 0) {
    ops.push(db.insert(ProductVariantCombination).values(toInsert));
  }
  for (const u of priceUpdates) {
    ops.push(
      db.update(ProductVariantCombination).set({ price: u.price } as any)
        .where(eq(ProductVariantCombination.id, u.id)),
    );
  }

  if (ops.length > 0) await db.batch(ops as any);

  return { generated: fresh.length, updated: priceUpdates.length, inserted: toInsert.length, removed: obsoleteIds.length };
}

// --- Interfaz explícita para el tipo de retorno ---
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
    selectedVariants: z.record(z.string())
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
  input: z.string(),
  handler: async (productId) => {
    try {
      const [product] = await db.select().from(Product).where(eq(Product.id, productId));
      if (!product) throw new Error('Producto no encontrado');

      if (!product.hasVariants) {
        return { hasVariants: false, groupedVariants: {}, combinations: [], combinationImages: {} };
      }

      const variants = await db.select().from(ProductVariant).where(eq(ProductVariant.productId, productId));
      const combinations = await db.select().from(ProductVariantCombination).where(and(eq(ProductVariantCombination.productId, productId), eq(ProductVariantCombination.isActive, true)));

      // ✅ NUEVO: Obtener imágenes de combinaciones
      const allImages = await db.select().from(ProductImage).where(eq(ProductImage.productId, productId));
      
      const combinationImages: Record<string, { id: string; image: string }> = {};
      allImages.forEach(img => {
        const comboId = img.combinationId;
        if (comboId) {
          combinationImages[comboId] = {
            id: img.id,
            image: img.image
          };
        }
      });
      
      console.log('Combination images found:', Object.keys(combinationImages).length, combinationImages);

      const groupedVariants: GroupedVariants = {};
      variants.forEach(variant => {
        if (!groupedVariants[variant.variantName]) {
          groupedVariants[variant.variantName] = { name: variant.variantName, options: [] };
        }
        groupedVariants[variant.variantName].options.push({
          id: variant.id,
          value: variant.variantValue,
          priceAdjustment: variant.priceAdjustment,
          cost: variant.cost ?? null,
          stock: variant.stock,
          isDefault: variant.isDefault,
          isActive: variant.isActive
        });
      });

      return { hasVariants: true, groupedVariants, combinations, combinationImages };
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
      cost: z.number().optional(),
      stock: z.number(),
      sku: z.string().optional(),
      isDefault: z.boolean().optional().default(false)
    }))
  }),
  handler: async (input, context) => {
    assertAdmin(context); // 🔒 Solo admin

    const { productId, variants } = input;
    const [product] = await db.select().from(Product).where(eq(Product.id, productId));
    if (!product) throw new Error('Producto no encontrado');

    const variantInserts = variants.map(variant => ({
      id: UUID(),
      productId,
      variantName: variant.variantName,
      variantValue: variant.variantValue,
      priceAdjustment: variant.priceAdjustment,
      cost: variant.cost ?? null,
      stock: variant.stock,
      sku: variant.sku,
      isDefault: variant.isDefault || false,
      isActive: true,
      createdAt: new Date()
    }));

    await db.batch([
      db.update(Product).set({ hasVariants: true } as any).where(eq(Product.id, productId)),
      ...(variantInserts.length > 0 
        ? [db.insert(ProductVariant).values(variantInserts as any)] 
        : [])
    ]);
    
    return { success: true, message: 'Variantes creadas correctamente' };
  }
});

// ===== EDITAR UNA VARIANTE INDIVIDUAL =====
export const updateVariant = defineAction({
  accept: 'json',
  input: z.object({
    variantId: z.string(),
    variantValue: z.string().optional(),
    priceAdjustment: z.number().optional(),
    cost: z.number().nullable().optional(),
    stock: z.number().optional(),
    sku: z.string().nullable().optional(),
    isActive: z.boolean().optional()
  }),
  handler: async (input, context) => {
    assertAdmin(context); // 🔒 Solo admin

    const { variantId, ...updateData } = input;
    
    try {
      const [variant] = await db
        .select()
        .from(ProductVariant)
        .where(eq(ProductVariant.id, variantId));
      
      if (!variant) {
        throw new Error('Variante no encontrada');
      }

      const dataToUpdate: any = {};
      if (updateData.variantValue !== undefined) dataToUpdate.variantValue = updateData.variantValue;
      if (updateData.priceAdjustment !== undefined) dataToUpdate.priceAdjustment = updateData.priceAdjustment;
      if (updateData.cost !== undefined) dataToUpdate.cost = updateData.cost;
      if (updateData.stock !== undefined) dataToUpdate.stock = updateData.stock;
      if (updateData.sku !== undefined) dataToUpdate.sku = updateData.sku;
      if (updateData.isActive !== undefined) dataToUpdate.isActive = updateData.isActive;

      await db
        .update(ProductVariant)
        .set(dataToUpdate)
        .where(eq(ProductVariant.id, variantId));

      console.log(`Variante ${variantId} actualizada:`, dataToUpdate);

      if (updateData.priceAdjustment !== undefined || updateData.stock !== undefined) {
        await syncProductCombinations(variant.productId);
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

// ===== ELIMINAR UNA VARIANTE INDIVIDUAL (sin db.transaction) =====
export const deleteVariant = defineAction({
  accept: 'json',
  input: z.string(),
  handler: async (variantId, context) => {
    assertAdmin(context); // 🔒 Solo admin

    try {
      const [variant] = await db
        .select()
        .from(ProductVariant)
        .where(eq(ProductVariant.id, variantId));
      
      if (!variant) {
        throw new Error('Variante no encontrada');
      }

      const variantImages = await db
        .select()
        .from(ProductImage)
        .where(eq(ProductImage.variantId, variantId));

      if (variantImages.length > 0) {
        await db
          .update(ProductImage)
          .set({ variantId: null } as any)
          .where(eq(ProductImage.variantId, variantId));
        
        console.log(`${variantImages.length} imágenes reasignadas al producto principal`);
      }

      await db.delete(ProductVariant).where(eq(ProductVariant.id, variantId));
      console.log(`Variante ${variantId} eliminada`);

      const remainingVariants = await db
        .select()
        .from(ProductVariant)
        .where(
          and(
            eq(ProductVariant.productId, variant.productId),
            eq(ProductVariant.variantName, variant.variantName)
          )
        );

      if (remainingVariants.length === 0) {
        await db
          .delete(ProductVariantCombination)
          .where(eq(ProductVariantCombination.productId, variant.productId));
        
        console.log('Combinaciones eliminadas ya que no quedan variantes del tipo', variant.variantName);
      }

      const allVariants = await db
        .select()
        .from(ProductVariant)
        .where(eq(ProductVariant.productId, variant.productId));

      if (allVariants.length === 0) {
        await db
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
  }
});

// ===== ELIMINAR TODAS LAS VARIANTES DE UN TIPO (sin db.transaction) =====
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

    try {
      const variants = await db
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

      await db.batch([
        db.update(ProductImage)
          .set({ variantId: null } as any)
          .where(inArray(ProductImage.variantId, variantIds)),
        
        db.delete(ProductVariant)
          .where(
            and(
              eq(ProductVariant.productId, productId),
              eq(ProductVariant.variantName, variantName)
            )
          ),
        
        db.delete(ProductVariantCombination)
          .where(eq(ProductVariantCombination.productId, productId)),
      ]);

      const remainingVariants = await db
        .select()
        .from(ProductVariant)
        .where(eq(ProductVariant.productId, productId));

      if (remainingVariants.length === 0) {
        await db
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
  }
});

// ===== GENERAR COMBINACIONES AUTOMÁTICAMENTE =====
export const generateVariantCombinations = defineAction({
  accept: 'json',
  input: z.string(),
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
          eq(ProductVariant.isActive, true)
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

    const result = await syncProductCombinations(productId);
    return { success: true, message: `${result.generated} combinaciones generadas` };
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

// ===== ACTUALIZAR GRUPO COMPLETO DE VARIANTES =====
export const updateVariantGroup = defineAction({
  accept: 'json',
  input: z.object({
    productId: z.string(),
    originalVariantName: z.string(),
    newVariantName: z.string(),
    variants: z.array(z.object({
      id: z.string().optional(),
      variantValue: z.string(),
      priceAdjustment: z.number(),
      cost: z.number().nullable().optional(),
      stock: z.number(),
      sku: z.string().nullable().optional(),
    })),
    deletedVariantIds: z.array(z.string()).optional(),
  }),
  handler: async (input, context) => {
    assertAdmin(context); // 🔒 Solo admin

    const { productId, originalVariantName, newVariantName, variants, deletedVariantIds } = input;

    try {
      // 1. Eliminar variantes marcadas para borrar
      if (deletedVariantIds && deletedVariantIds.length > 0) {
        await db.batch([
          db.update(ProductImage)
            .set({ variantId: null } as any)
            .where(inArray(ProductImage.variantId, deletedVariantIds)),
          db.delete(ProductVariant)
            .where(inArray(ProductVariant.id, deletedVariantIds)),
        ]);
      }

      // 2. Actualizar existentes y crear nuevas
      for (const variant of variants) {
        if (variant.id) {
          await db.update(ProductVariant).set({
            variantName: newVariantName,
            variantValue: variant.variantValue,
            priceAdjustment: variant.priceAdjustment,
            cost: variant.cost ?? null,
            stock: variant.stock,
            sku: variant.sku ?? null,
          } as any).where(eq(ProductVariant.id, variant.id));
        } else {
          await db.insert(ProductVariant).values({
            id: UUID(),
            productId,
            variantName: newVariantName,
            variantValue: variant.variantValue,
            priceAdjustment: variant.priceAdjustment,
            cost: variant.cost ?? null,
            stock: variant.stock,
            sku: variant.sku ?? null,
            isDefault: false,
            isActive: true,
            createdAt: new Date(),
          } as any);
        }
      }

      // 3. Sincronizar combinaciones automáticamente
      await syncProductCombinations(productId);

      return {
        success: true,
        message: `Grupo "${newVariantName}" actualizado correctamente`,
        shouldRegenerateCombinations: false,
      };
    } catch (error: any) {
      console.error('Error actualizando grupo de variantes:', error);
      throw new Error(`Error al actualizar el grupo: ${error.message}`);
    }
  }
});

// ===== SUBIR IMAGEN DE COMBINACIÓN =====
export const uploadCombinationImage = defineAction({
    accept: 'form',
    input: z.object({
        combinationId: z.string().min(1, "ID de combinación requerido"),
        productId: z.string().min(1, "ID de producto requerido"),
        imageFile: z.instanceof(File).optional(),
    }),
    handler: async (form, { request }) => {
        const session = await getSession(request);
        if (!session?.user) throw new Error('No autorizado');

        try {
            const [combination] = await db
                .select()
                .from(ProductVariantCombination)
                .where(eq(ProductVariantCombination.id, form.combinationId));

            if (!combination) throw new Error('Combinación no encontrada');

            const imageFile = form.imageFile;
            if (!imageFile || imageFile.size === 0) throw new Error('No se proporcionó ninguna imagen');
            if (!imageFile.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen');
            if (imageFile.size > 5 * 1024 * 1024) throw new Error('La imagen no debe superar 5MB');

            console.log(`Subiendo imagen para combinación ${form.combinationId}...`);

            // Verificar si ya existe una imagen para esta combinación
            const existingImages = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.productId, form.productId));
            
            const existingImage = existingImages.find((img: any) => img.combinationId === form.combinationId);

            if (existingImage) {
                console.log('Eliminando imagen anterior...');
                const { ImageUpload } = await import('@/utils/image-upload');
                await ImageUpload.delete(existingImage.image);
                await db.delete(ProductImage).where(eq(ProductImage.id, existingImage.id));
            }

            const { ImageUpload } = await import('@/utils/image-upload');
            const imageUrl = await ImageUpload.upload(imageFile);
            console.log(`Imagen subida: ${imageUrl}`);

            const imageRecord = {
                id: UUID(),
                productId: form.productId,
                variantId: null,
                combinationId: form.combinationId,
                image: imageUrl,
            };

            await db.insert(ProductImage).values(imageRecord as any);

            return {
                success: true,
                imageUrl,
                message: 'Imagen de combinación subida correctamente'
            };

        } catch (error: any) {
            console.error('Error subiendo imagen de combinación:', error);
            throw new Error(`Error: ${error.message}`);
        }
    }
});

// ===== ELIMINAR IMAGEN DE COMBINACIÓN =====
export const deleteCombinationImage = defineAction({
    accept: 'json',
    input: z.string().min(1, "ID de combinación requerido"),
    handler: async (combinationId, { request }) => {
        const session = await getSession(request);
        if (!session?.user) throw new Error('No autorizado');

        try {
            const allImages = await db
                .select()
                .from(ProductImage);
            
            const comboImage = allImages.find((img: any) => img.combinationId === combinationId);

            if (!comboImage) throw new Error('No hay imagen asociada a esta combinación');

            console.log(`Eliminando imagen de combinación ${combinationId}...`);

            const { ImageUpload } = await import('@/utils/image-upload');
            await ImageUpload.delete(comboImage.image);
            await db.delete(ProductImage).where(eq(ProductImage.id, comboImage.id));

            return {
                success: true,
                message: 'Imagen de combinación eliminada'
            };

        } catch (error: any) {
            console.error('Error eliminando imagen de combinación:', error);
            throw new Error(`Error: ${error.message}`);
        }
    }
});
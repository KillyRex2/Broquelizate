import { ImageUpload } from '@/utils/image-upload';
import { defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro:schema';
import { db, eq, Product, ProductImage, ProductVariant, inArray, ProductVariantCombination } from 'astro:db';
import { getSession } from 'auth-astro/server';
import { v4 as UUID } from 'uuid';

// ===== ACCIÓN PRINCIPAL: CREAR/ACTUALIZAR PRODUCTO CON IMÁGENES =====
export const crateUpdateProduct = defineAction({
    accept: 'form',
    input: z.object({
        id: z.string().optional(),
        name: z.string().min(1, "El nombre es requerido."),
        price: z.coerce.number().min(0, "El precio base no puede ser negativo."),
        stock: z.coerce.number().int("El stock base debe ser un número entero."),
        cost: z.coerce.number().optional(),
        description: z.string(),
        category: z.string(),
        slug: z.string().transform(val => val.toLowerCase().replaceAll(' ', '-').trim()),
        type: z.string(),
        piercing_name: z.preprocess((val) => {
            if (Array.isArray(val)) {
                return val.filter(v => v && v !== '').join(',');
            }
            if (typeof val === 'string') {
                return val;
            }
            return '';
        }, z.string().optional()),
        hasVariants: z.preprocess((val) => val === 'on' || val === true, z.boolean().default(false)),

        // ✅ NUEVO: JSON string con los campos de personalización
        customizationFields: z.string().default('[]'),

        // ⚠️ DEPRECADO: Mantener temporalmente para compatibilidad
        allowsEngraving: z.preprocess((val) => val === 'on' || val === true, z.boolean().default(false)),

        imageFiles: z.instanceof(File).array().optional(),
    }),
    handler: async (form, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        const user = session?.user;

        if (!user) {
            throw new Error('No autorizado');
        }

        const isEditing = !!form.id;
        const productId = form.id || UUID();

        try {
            // Validar que customizationFields sea JSON válido
            let parsedFields = [];
            try {
                parsedFields = JSON.parse(form.customizationFields);
                if (!Array.isArray(parsedFields)) {
                    parsedFields = [];
                }
            } catch {
                parsedFields = [];
            }

            // Derivar allowsEngraving del nuevo campo para compatibilidad
            const hasCustomization = parsedFields.length > 0;

            const productData = {
                name: form.name,
                price: form.price,
                description: form.description,
                category: form.category,
                slug: form.slug,
                type: form.type,
                stock: form.stock,
                piercing_name: form.piercing_name || '',
                cost: form.cost,
                hasVariants: form.hasVariants,
                customizationFields: JSON.stringify(parsedFields),
                // Mantener sincronizado durante la transición
                allowsEngraving: hasCustomization,
                user: user.id!,
            };

            console.log('Datos del producto a guardar:', {
                ...productData,
                customizationFields: `[${parsedFields.length} campos]`
            });

            if (isEditing) {
                await db.update(Product).set(productData).where(eq(Product.id, productId));
                console.log(`Producto ${productId} actualizado`);
            } else {
                await db.insert(Product).values({ id: productId, ...productData } as any);
                console.log(`Producto ${productId} creado`);
            }

            // 2. Procesar las imágenes nuevas del formulario
            const imageFiles = form.imageFiles || [];
            
            let uploadedCount = 0;
            const uploadedImages = [];
            
            if (imageFiles.length > 0) {
                console.log(`Procesando ${imageFiles.length} archivos de imagen...`);
                
                for (const file of imageFiles) {
                    if (!file || file.size === 0) {
                        console.log('Archivo vacío, saltando...');
                        continue;
                    }
                    
                    if (!file.type.startsWith('image/')) {
                        console.warn(`Archivo ${file.name} no es una imagen válida (tipo: ${file.type})`);
                        continue;
                    }

                    if (file.size > 5 * 1024 * 1024) {
                        console.warn(`Archivo ${file.name} excede el tamaño máximo de 5MB`);
                        continue;
                    }

                    try {
                        console.log(`Subiendo imagen ${file.name} a Cloudinary...`);
                        
                        const imageUrl = await ImageUpload.upload(file);
                        console.log(`Imagen subida exitosamente: ${imageUrl}`);
                        
                        const imageRecord = {
                            id: UUID(),
                            productId: productId,
                            variantId: null,
                            image: imageUrl,
                        };

                        await db.insert(ProductImage).values(imageRecord as any);
                        uploadedImages.push(imageRecord);
                        uploadedCount++;
                        
                        console.log(`Imagen guardada en BD con ID: ${imageRecord.id}`);
                        
                    } catch (uploadError: any) {
                        console.error(`Error subiendo imagen ${file.name}:`, uploadError.message);
                    }
                }
                
                console.log(`Total de imágenes procesadas exitosamente: ${uploadedCount}`);
            }

            return { 
                success: true, 
                product: { id: productId, ...productData },
                uploadedImages,
                message: `Producto ${isEditing ? 'actualizado' : 'creado'} correctamente${uploadedCount > 0 ? ` con ${uploadedCount} imagen(es)` : ''}`
            };
            
        } catch (error: any) {
            console.error('Error en crateUpdateProduct:', error);
            
            if (!isEditing) {
                console.log('Iniciando rollback de imágenes...');
                try {
                    const images = await db
                        .select()
                        .from(ProductImage)
                        .where(eq(ProductImage.productId, productId));
                    
                    for (const img of images) {
                        try {
                            await ImageUpload.delete(img.image);
                            console.log(`Imagen eliminada de Cloudinary: ${img.image}`);
                        } catch (e) {
                            console.error('Error eliminando imagen en rollback:', e);
                        }
                    }
                    
                    await db.delete(ProductImage).where(eq(ProductImage.productId, productId));
                    await db.delete(Product).where(eq(Product.id, productId));
                } catch (cleanupError) {
                    console.error('Error en limpieza después del fallo:', cleanupError);
                }
            }
            
            throw new Error(`Error al guardar producto: ${error.message}`);
        }
    }
});

// ===== ELIMINAR IMAGEN DE PRODUCTO =====
export const deleteProductImage = defineAction({
    accept: 'json',
    input: z.string().min(1, "El ID de la imagen es requerido"),
    handler: async (imageId, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        if (!session?.user) {
            throw new Error('No autorizado');
        }

        try {
            const [image] = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.id, imageId));
            
            if (!image) {
                throw new Error('Imagen no encontrada');
            }

            console.log(`Eliminando imagen ${imageId} de Cloudinary...`);
            
            const deleted = await ImageUpload.delete(image.image);
            
            if (deleted) {
                console.log('Imagen eliminada de Cloudinary exitosamente');
            } else {
                console.warn('No se pudo eliminar la imagen de Cloudinary, pero continuando...');
            }

            await db.delete(ProductImage).where(eq(ProductImage.id, imageId));
            console.log('Imagen eliminada de la base de datos');

            return {
                success: true,
                message: 'Imagen eliminada correctamente'
            };

        } catch (error: any) {
            console.error('Error eliminando imagen:', error);
            throw new Error(`Error al eliminar imagen: ${error.message}`);
        }
    }
});

// ===== ELIMINAR PRODUCTO CON TODAS SUS IMÁGENES =====
export const deleteProduct = defineAction({
    accept: 'json',
    input: z.object({
        id: z.string().min(1, 'Se requiere el ID del producto.'),
    }),
    handler: async ({ id }, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        if (!session?.user) throw new Error('No autorizado');

        try {
            console.log(`Eliminando producto ${id} y todos sus recursos...`);
            
            const productImages = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.productId, id));
            
            console.log(`Encontradas ${productImages.length} imágenes del producto`);
            
            const variants = await db
                .select({ id: ProductVariant.id })
                .from(ProductVariant)
                .where(eq(ProductVariant.productId, id));
            
            let variantImages: any[] = [];
            if (variants.length > 0) {
                const variantIds = variants.map(v => v.id);
                variantImages = await db
                    .select()
                    .from(ProductImage)
                    .where(inArray(ProductImage.variantId, variantIds));
                
                console.log(`Encontradas ${variantImages.length} imágenes de variantes`);
            }
            
            const allImages = [...productImages, ...variantImages];
            console.log(`Total de imágenes a eliminar: ${allImages.length}`);
            
            if (allImages.length > 0) {
                const deletePromises = allImages.map(async (img) => {
                    try {
                        const result = await ImageUpload.delete(img.image);
                        if (result) {
                            console.log(`Imagen eliminada de Cloudinary: ${img.image}`);
                        }
                        return result;
                    } catch (err) {
                        console.error(`Error eliminando imagen ${img.image}:`, err);
                        return false;
                    }
                });
                
                await Promise.allSettled(deletePromises);
            }
            
            const batchQueries = [];
            
            const imageIds = allImages.map(img => img.id);
            if (imageIds.length > 0) {
                batchQueries.push(
                    db.delete(ProductImage).where(inArray(ProductImage.id, imageIds))
                );
            }
            
            batchQueries.push(
                db.delete(ProductVariantCombination).where(eq(ProductVariantCombination.productId, id))
            );
            
            if (variants.length > 0) {
                batchQueries.push(
                    db.delete(ProductVariant).where(eq(ProductVariant.productId, id))
                );
            }
            
            batchQueries.push(
                db.delete(Product).where(eq(Product.id, id))
            );
            
            if (batchQueries.length > 0) {
                await db.batch(batchQueries as any);
            }
            
            console.log('Producto eliminado exitosamente');
            
            return { 
                success: true, 
                message: 'Producto y todas sus imágenes han sido eliminados correctamente.' 
            };
            
        } catch (error: any) {
            console.error('Error eliminando producto:', error);
            throw new Error(`Error al eliminar el producto: ${error.message}`);
        }
    }
});

// ===== SUBIR IMAGEN DE VARIANTE =====
export const uploadVariantImage = defineAction({
    accept: 'form',
    input: z.object({
        variantId: z.string().min(1, "ID de variante requerido"),
        productId: z.string().min(1, "ID de producto requerido"),
        imageFile: z.instanceof(File).optional(),
    }),
    handler: async (form, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        if (!session?.user) {
            throw new Error('No autorizado');
        }

        try {
            const [variant] = await db
                .select()
                .from(ProductVariant)
                .where(eq(ProductVariant.id, form.variantId));

            if (!variant) {
                throw new Error('Variante no encontrada');
            }

            const imageFile = form.imageFile;

            if (!imageFile || imageFile.size === 0) {
                throw new Error('No se proporcionó ninguna imagen');
            }

            if (!imageFile.type.startsWith('image/')) {
                throw new Error('El archivo debe ser una imagen');
            }

            if (imageFile.size > 5 * 1024 * 1024) {
                throw new Error('La imagen no debe superar 5MB');
            }

            console.log(`Subiendo imagen para variante ${form.variantId}...`);

            const [existingImage] = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.variantId, form.variantId));

            if (existingImage) {
                console.log('Eliminando imagen anterior de Cloudinary...');
                await ImageUpload.delete(existingImage.image);
                await db
                    .delete(ProductImage)
                    .where(eq(ProductImage.id, existingImage.id));
            }

            const imageUrl = await ImageUpload.upload(imageFile);
            console.log(`Imagen subida: ${imageUrl}`);

            const imageRecord = {
                id: UUID(),
                productId: form.productId,
                variantId: form.variantId,
                image: imageUrl,
            };

            await db.insert(ProductImage).values(imageRecord as any);
            console.log('Imagen guardada en BD');

            return {
                success: true,
                imageUrl,
                message: 'Imagen de variante subida correctamente'
            };

        } catch (error: any) {
            console.error('Error subiendo imagen de variante:', error);
            throw new Error(`Error: ${error.message}`);
        }
    }
});

// ===== ELIMINAR IMAGEN DE VARIANTE =====
export const deleteVariantImage = defineAction({
    accept: 'json',
    input: z.string().min(1, "ID de variante requerido"),
    handler: async (variantId, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        if (!session?.user) {
            throw new Error('No autorizado');
        }

        try {
            const [variantImage] = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.variantId, variantId));

            if (!variantImage) {
                throw new Error('No hay imagen asociada a esta variante');
            }

            console.log(`Eliminando imagen de variante ${variantId}...`);

            await ImageUpload.delete(variantImage.image);

            await db
                .delete(ProductImage)
                .where(eq(ProductImage.id, variantImage.id));

            return {
                success: true,
                message: 'Imagen de variante eliminada'
            };

        } catch (error: any) {
            console.error('Error eliminando imagen de variante:', error);
            throw new Error(`Error: ${error.message}`);
        }
    }
});

// ===== ✅ NUEVO: SUBIR IMAGEN DE PERSONALIZACIÓN (reemplaza uploadEngravingImage) =====
export const uploadCustomizationImage = defineAction({
    accept: 'form',
    input: z.object({
        productId: z.string().min(1, "ID de producto requerido"),
        fieldId: z.string().min(1, "ID de campo requerido"),
        imageFile: z.instanceof(File),
    }),
    handler: async (form, context: ActionAPIContext) => {
        try {
            const imageFile = form.imageFile;

            if (!imageFile || imageFile.size === 0) {
                throw new Error('No se proporcionó ninguna imagen');
            }

            // Obtener el producto para validar contra sus campos configurados
            const [product] = await db
                .select()
                .from(Product)
                .where(eq(Product.id, form.productId));

            if (!product) {
                throw new Error('Producto no encontrado');
            }

            // Parsear los campos de personalización del producto
            let fields: any[] = [];
            try {
                fields = JSON.parse((product as any).customizationFields || '[]');
            } catch {
                fields = [];
            }

            // Buscar el campo específico
            const field = fields.find((f: any) => f.id === form.fieldId);
            if (!field || field.type !== 'image') {
                throw new Error('Campo de imagen no encontrado en la configuración del producto');
            }

            // Validar tipo de archivo contra la configuración del campo
            const allowedTypes = field.accept || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(imageFile.type)) {
                const friendlyTypes = allowedTypes.map((t: string) => t.split('/')[1]?.toUpperCase()).join(', ');
                throw new Error(`Formato no soportado. Usa: ${friendlyTypes}`);
            }

            // Validar tamaño contra la configuración del campo
            const maxSizeMB = field.maxSize || 10;
            const maxSizeBytes = maxSizeMB * 1024 * 1024;
            if (imageFile.size > maxSizeBytes) {
                throw new Error(`La imagen no debe superar ${maxSizeMB}MB`);
            }

            console.log(`[Personalización] Subiendo imagen para campo "${field.label}" del producto ${form.productId}...`);
            console.log(`[Personalización] Archivo: ${imageFile.name}, Tamaño: ${(imageFile.size / 1024 / 1024).toFixed(2)}MB, Tipo: ${imageFile.type}`);

            // Subir a Cloudinary
            const imageUrl = await ImageUpload.upload(imageFile);
            
            console.log(`[Personalización] Imagen subida exitosamente: ${imageUrl}`);

            return {
                success: true,
                fieldId: form.fieldId,
                imageUrl,
                fileName: imageFile.name,
                fileSize: imageFile.size,
                message: `Imagen para "${field.label}" subida correctamente`
            };

        } catch (error: any) {
            console.error('[Personalización] Error:', error);
            throw new Error(`Error al subir imagen: ${error.message}`);
        }
    }
});

// ===== ✅ NUEVO: ELIMINAR IMAGEN DE PERSONALIZACIÓN (reemplaza deleteEngravingImage) =====
export const deleteCustomizationImage = defineAction({
    accept: 'json',
    input: z.object({
        imageUrl: z.string().min(1, "URL de imagen requerida"),
    }),
    handler: async ({ imageUrl }, context: ActionAPIContext) => {
        try {
            console.log(`[Personalización] Eliminando imagen: ${imageUrl}`);

            const deleted = await ImageUpload.delete(imageUrl);

            if (deleted) {
                console.log('[Personalización] Imagen eliminada de Cloudinary');
            }

            return {
                success: true,
                message: 'Imagen eliminada'
            };

        } catch (error: any) {
            console.error('[Personalización] Error eliminando:', error);
            throw new Error(`Error al eliminar imagen: ${error.message}`);
        }
    }
});

// ===== ⚠️ DEPRECADOS: Mantener como wrappers durante la transición =====
// Eliminar cuando el storefront esté migrado a uploadCustomizationImage

export const uploadEngravingImage = defineAction({
    accept: 'form',
    input: z.object({
        productId: z.string().min(1, "ID de producto requerido"),
        imageFile: z.instanceof(File),
    }),
    handler: async (form, context: ActionAPIContext) => {
        try {
            const imageFile = form.imageFile;

            if (!imageFile || imageFile.size === 0) {
                throw new Error('No se proporcionó ninguna imagen');
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(imageFile.type)) {
                throw new Error('Formato no soportado. Usa JPG, PNG, WEBP o GIF.');
            }

            const MAX_SIZE = 10 * 1024 * 1024;
            if (imageFile.size > MAX_SIZE) {
                throw new Error('La imagen no debe superar 10MB');
            }

            console.log(`[Grabado Láser - DEPRECADO] Subiendo imagen para producto ${form.productId}...`);

            const imageUrl = await ImageUpload.upload(imageFile);
            
            console.log(`[Grabado Láser] Imagen subida exitosamente: ${imageUrl}`);

            return {
                success: true,
                engravingId: UUID(),
                imageUrl,
                fileName: imageFile.name,
                fileSize: imageFile.size,
                message: 'Imagen de grabado subida correctamente'
            };

        } catch (error: any) {
            console.error('[Grabado Láser] Error:', error);
            throw new Error(`Error al subir imagen de grabado: ${error.message}`);
        }
    }
});

export const deleteEngravingImage = defineAction({
    accept: 'json',
    input: z.object({
        imageUrl: z.string().min(1, "URL de imagen requerida"),
    }),
    handler: async ({ imageUrl }, context: ActionAPIContext) => {
        try {
            console.log(`[Grabado Láser - DEPRECADO] Eliminando imagen: ${imageUrl}`);

            const deleted = await ImageUpload.delete(imageUrl);

            if (deleted) {
                console.log('[Grabado Láser] Imagen eliminada de Cloudinary');
            }

            return {
                success: true,
                message: 'Imagen de grabado eliminada'
            };

        } catch (error: any) {
            console.error('[Grabado Láser] Error eliminando:', error);
            throw new Error(`Error al eliminar imagen: ${error.message}`);
        }
    }
});
// ===== ESTABLECER IMAGEN DE PORTADA =====
export const setProductCoverImage = defineAction({
    accept: 'json',
    input: z.object({
        productId: z.string().min(1),
        imageId: z.string().min(1),
    }),
    handler: async ({ productId, imageId }, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        if (!session?.user) throw new Error('No autorizado');

        const [image] = await db.select().from(ProductImage).where(eq(ProductImage.id, imageId));
        if (!image) throw new Error('Imagen no encontrada');

        await db.update(Product).set({ coverImageId: imageId } as any).where(eq(Product.id, productId));

        return { success: true, message: 'Portada actualizada' };
    }
});
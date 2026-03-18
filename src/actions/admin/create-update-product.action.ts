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
            // 1. Guardar o actualizar el producto
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
                allowsEngraving: form.allowsEngraving,
                user: user.id!,
            };

            console.log('Datos del producto a guardar:', productData);

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
                    // Validar que es un archivo válido
                    if (!file || file.size === 0) {
                        console.log('Archivo vacío, saltando...');
                        continue;
                    }
                    
                    // Validar tipo de archivo
                    if (!file.type.startsWith('image/')) {
                        console.warn(`Archivo ${file.name} no es una imagen válida (tipo: ${file.type})`);
                        continue;
                    }

                    // Validar tamaño (máx 5MB)
                    if (file.size > 5 * 1024 * 1024) {
                        console.warn(`Archivo ${file.name} excede el tamaño máximo de 5MB`);
                        continue;
                    }

                    try {
                        console.log(`Subiendo imagen ${file.name} a Cloudinary...`);
                        
                        // Subir a Cloudinary
                        const imageUrl = await ImageUpload.upload(file);
                        console.log(`Imagen subida exitosamente: ${imageUrl}`);
                        
                        // Guardar en base de datos
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
                        // Si falla una imagen, continuar con las demás
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
            
            // Rollback manual: Si es nuevo producto y falla, limpiar imágenes
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
            // Obtener la imagen de la base de datos
            const [image] = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.id, imageId));
            
            if (!image) {
                throw new Error('Imagen no encontrada');
            }

            console.log(`Eliminando imagen ${imageId} de Cloudinary...`);
            
            // Eliminar de Cloudinary
            const deleted = await ImageUpload.delete(image.image);
            
            if (deleted) {
                console.log('Imagen eliminada de Cloudinary exitosamente');
            } else {
                console.warn('No se pudo eliminar la imagen de Cloudinary, pero continuando...');
            }

            // Eliminar de la base de datos
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
            
            // 1. Obtener TODAS las imágenes del producto
            const productImages = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.productId, id));
            
            console.log(`Encontradas ${productImages.length} imágenes del producto`);
            
            // 2. Obtener variantes si existen
            const variants = await db
                .select({ id: ProductVariant.id })
                .from(ProductVariant)
                .where(eq(ProductVariant.productId, id));
            
            // 3. Si hay variantes, buscar sus imágenes también
            let variantImages: any[] = [];
            if (variants.length > 0) {
                const variantIds = variants.map(v => v.id);
                variantImages = await db
                    .select()
                    .from(ProductImage)
                    .where(inArray(ProductImage.variantId, variantIds));
                
                console.log(`Encontradas ${variantImages.length} imágenes de variantes`);
            }
            
            // 4. Combinar todas las imágenes
            const allImages = [...productImages, ...variantImages];
            console.log(`Total de imágenes a eliminar: ${allImages.length}`);
            
            // 5. Eliminar todas las imágenes de Cloudinary
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
            
            // 6. Construir array de queries dinámicamente para batch
            const batchQueries = [];
            
            // Eliminar imágenes de la BD
            const imageIds = allImages.map(img => img.id);
            if (imageIds.length > 0) {
                batchQueries.push(
                    db.delete(ProductImage).where(inArray(ProductImage.id, imageIds))
                );
            }
            
            // Eliminar combinaciones de variantes
            batchQueries.push(
                db.delete(ProductVariantCombination).where(eq(ProductVariantCombination.productId, id))
            );
            
            // Eliminar variantes
            if (variants.length > 0) {
                batchQueries.push(
                    db.delete(ProductVariant).where(eq(ProductVariant.productId, id))
                );
            }
            
            // Eliminar el producto
            batchQueries.push(
                db.delete(Product).where(eq(Product.id, id))
            );
            
            // Ejecutar todas las queries en batch
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
            // Verificar que la variante existe
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

            // Validar tipo de archivo
            if (!imageFile.type.startsWith('image/')) {
                throw new Error('El archivo debe ser una imagen');
            }

            // Validar tamaño (máx 5MB)
            if (imageFile.size > 5 * 1024 * 1024) {
                throw new Error('La imagen no debe superar 5MB');
            }

            console.log(`Subiendo imagen para variante ${form.variantId}...`);

            // Verificar si ya existe una imagen para esta variante
            const [existingImage] = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.variantId, form.variantId));

            // Si existe, eliminar la imagen anterior de Cloudinary
            if (existingImage) {
                console.log('Eliminando imagen anterior de Cloudinary...');
                await ImageUpload.delete(existingImage.image);
                
                // Eliminar registro de la BD
                await db
                    .delete(ProductImage)
                    .where(eq(ProductImage.id, existingImage.id));
            }

            // Subir nueva imagen a Cloudinary
            const imageUrl = await ImageUpload.upload(imageFile);
            console.log(`Imagen subida: ${imageUrl}`);

            // Guardar en base de datos
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
            // Buscar imagen asociada a la variante
            const [variantImage] = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.variantId, variantId));

            if (!variantImage) {
                throw new Error('No hay imagen asociada a esta variante');
            }

            console.log(`Eliminando imagen de variante ${variantId}...`);

            // Eliminar de Cloudinary
            await ImageUpload.delete(variantImage.image);

            // Eliminar de BD
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

// ===== SUBIR IMAGEN DE GRABADO LÁSER =====
export const uploadEngravingImage = defineAction({
    accept: 'form',
    input: z.object({
        productId: z.string().min(1, "ID de producto requerido"),
        imageFile: z.instanceof(File),
    }),
    handler: async (form, context: ActionAPIContext) => {
        try {
            const imageFile = form.imageFile;

            // Validar que existe el archivo
            if (!imageFile || imageFile.size === 0) {
                throw new Error('No se proporcionó ninguna imagen');
            }

            // Validar tipo de archivo - solo imágenes
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(imageFile.type)) {
                throw new Error('Formato no soportado. Usa JPG, PNG, WEBP o GIF.');
            }

            // Validar tamaño (máx 10MB para grabado láser - necesitan buena resolución)
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            if (imageFile.size > MAX_SIZE) {
                throw new Error('La imagen no debe superar 10MB');
            }

            console.log(`[Grabado Láser] Subiendo imagen para producto ${form.productId}...`);
            console.log(`[Grabado Láser] Archivo: ${imageFile.name}, Tamaño: ${(imageFile.size / 1024 / 1024).toFixed(2)}MB, Tipo: ${imageFile.type}`);

            // Subir a Cloudinary
            const imageUrl = await ImageUpload.upload(imageFile);
            
            console.log(`[Grabado Láser] Imagen subida exitosamente: ${imageUrl}`);

            // Generar un ID único para esta imagen de grabado
            const engravingId = UUID();

            return {
                success: true,
                engravingId,
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

// ===== ELIMINAR IMAGEN DE GRABADO LÁSER =====
export const deleteEngravingImage = defineAction({
    accept: 'json',
    input: z.object({
        imageUrl: z.string().min(1, "URL de imagen requerida"),
    }),
    handler: async ({ imageUrl }, context: ActionAPIContext) => {
        try {
            console.log(`[Grabado Láser] Eliminando imagen: ${imageUrl}`);

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
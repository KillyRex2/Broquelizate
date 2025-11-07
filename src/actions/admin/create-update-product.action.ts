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
        // CORRECCIÓN: Manejar piercing_name como array o string
        piercing_name: z.preprocess((val) => {
            // Si es un array (múltiples checkboxes seleccionados)
            if (Array.isArray(val)) {
                // Filtrar valores vacíos y unir con comas
                return val.filter(v => v && v !== '').join(',');
            }
            // Si es un string único
            if (typeof val === 'string') {
                return val;
            }
            // Si no hay valores, retornar string vacío
            return '';
        }, z.string().optional()),
        hasVariants: z.preprocess((val) => val === 'on' || val === true, z.boolean().default(false)),
    }),
    handler: async (form, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        const user = session?.user;

        if (!user) {
            throw new Error('No autorizado');
        }

        // Obtener el FormData original para procesar piercing_name correctamente
        const originalFormData = await context.request.formData();
        const piercingValues = originalFormData.getAll('piercing_name');
        
        // Procesar los valores de piercing_name
        let piercingNameString = '';
        if (piercingValues && piercingValues.length > 0) {
            // Filtrar valores vacíos y unir con comas
            piercingNameString = piercingValues
                .filter(v => v && v !== '')
                .join(',');
        }

        console.log('Valores de piercing_name recibidos:', piercingValues);
        console.log('String final de piercing_name:', piercingNameString);

        return await db.transaction(async (tx) => {
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
                    piercing_name: piercingNameString || form.piercing_name || '', // Usar el string procesado
                    cost: form.cost,
                    hasVariants: form.hasVariants,
                    user: user.id!,
                };

                console.log('Datos del producto a guardar:', productData);

                if (isEditing) {
                    await tx.update(Product).set(productData).where(eq(Product.id, productId));
                    console.log(`Producto ${productId} actualizado con piercing_name: ${productData.piercing_name}`);
                } else {
                    await tx.insert(Product).values({ id: productId, ...productData } as any);
                    console.log(`Producto ${productId} creado con piercing_name: ${productData.piercing_name}`);
                }

                // 2. Procesar las imágenes nuevas del formulario
                const imageFiles = originalFormData.getAll('imageFiles') as File[];
                
                let uploadedCount = 0;
                const uploadedImages = [];
                
                if (imageFiles && imageFiles.length > 0) {
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
                            console.warn(`Archivo ${file.name} excede el tamaño máximo de 5MB (tamaño: ${file.size} bytes)`);
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

                            await tx.insert(ProductImage).values(imageRecord as any);
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
                
                // Rollback: Si es nuevo producto y falla, limpiar imágenes
                if (!isEditing) {
                    console.log('Iniciando rollback de imágenes...');
                    try {
                        const images = await tx
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
                        
                        await tx.delete(ProductImage).where(eq(ProductImage.productId, productId));
                    } catch (cleanupError) {
                        console.error('Error en limpieza después del fallo:', cleanupError);
                    }
                }
                
                throw new Error(`Error al guardar producto: ${error.message}`);
            }
        });
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
export const deleteProduct = defineAction({
    accept: 'json',
    input: z.object({
        id: z.string().min(1, 'Se requiere el ID del producto.'),
    }),
    handler: async ({ id }, context: ActionAPIContext) => {
        const session = await getSession(context.request);
        if (!session?.user) throw new Error('No autorizado');

        return await db.transaction(async (tx) => {
            try {
                console.log(`Eliminando producto ${id} y todos sus recursos...`);
                
                // 1. Obtener TODAS las imágenes del producto
                const productImages = await tx
                    .select()
                    .from(ProductImage)
                    .where(eq(ProductImage.productId, id));
                
                console.log(`Encontradas ${productImages.length} imágenes del producto`);
                
                // 2. Obtener variantes si existen
                const variants = await tx
                    .select({ id: ProductVariant.id })
                    .from(ProductVariant)
                    .where(eq(ProductVariant.productId, id));
                
                // 3. Si hay variantes, buscar sus imágenes también
                let variantImages: any[] = [];
                if (variants.length > 0) {
                    const variantIds = variants.map(v => v.id);
                    variantImages = await tx
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
                    
                    // 6. Eliminar registros de imágenes de la BD
                    const imageIds = allImages.map(img => img.id);
                    await tx.delete(ProductImage).where(inArray(ProductImage.id, imageIds));
                    console.log('Registros de imágenes eliminados de la BD');
                }
                
                // 7. Eliminar combinaciones de variantes
                await tx.delete(ProductVariantCombination).where(eq(ProductVariantCombination.productId, id));
                
                // 8. Eliminar variantes
                if (variants.length > 0) {
                    await tx.delete(ProductVariant).where(eq(ProductVariant.productId, id));
                    console.log(`${variants.length} variantes eliminadas`);
                }
                
                // 9. Finalmente, eliminar el producto
                await tx.delete(Product).where(eq(Product.id, id));
                console.log('Producto eliminado exitosamente');
                
                return { 
                    success: true, 
                    message: 'Producto y todas sus imágenes han sido eliminados correctamente.' 
                };
                
            } catch (error: any) {
                console.error('Error eliminando producto:', error);
                throw new Error(`Error al eliminar el producto: ${error.message}`);
            }
        });
    }
});

export const uploadVariantImage = defineAction({
    accept: 'form',
    input: z.object({
        variantId: z.string().min(1, "ID de variante requerido"),
        productId: z.string().min(1, "ID de producto requerido"),
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

            // Obtener el archivo de imagen del FormData
            const formData = await context.request.formData();
            const imageFile = formData.get('imageFile') as File;

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
                variantId: form.variantId, // ✅ Asociada a la variante
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

/**
 * Acción para eliminar la imagen de una variante
 */
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


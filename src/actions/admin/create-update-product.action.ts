import { ImageUpload } from '@/utils/image-upload';
import {defineAction} from 'astro:actions';
import { db, eq, Product, ProductImage } from 'astro:db';
import { z } from 'astro:schema'
import { getSession } from 'auth-astro/server';
import { v4 as UUID } from 'uuid';

const MAX_FILE_SIZE = 5_000_000 // 5 MB
const ACCEPTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml',
]


export const crateUpdateProduct = defineAction({
    accept: 'form',
    input: z.object({
        id: z.string().optional(),
        name: z.string().min(1, "Nombre es requerido"), 
        price: z.number(),
        description: z.string(),
        category: z.string(),
        slug: z.string(),
        type: z.string(),
        stock: z.number(),

        imageFiles: z.array(
            z.instanceof(File)
            .refine( file => file.size <= MAX_FILE_SIZE, 'Max image size 5MB')
            .refine( file => {
                if ( file.size === 0) return true;
                return ACCEPTED_IMAGE_TYPES.includes(file.type);
            }, `Only supported image files are valid, ${ACCEPTED_IMAGE_TYPES.join(',')}`)
        ).optional(),

    }),
    handler: async(form, {request}) => {

        const session = await getSession(request);
        const user = session?.user;
        //TODO
        // En este punto podemos aplicar diferentes validaciones revisar que el usuario tenga los roles respectivos aplicar un middleware antes de entrar a la pantalla

        if(!user) {
            throw new Error('Unauthorized')
        }

        const { id = UUID(), imageFiles, ...rest } = form;
        rest.slug = rest.slug.toLowerCase().replaceAll(' ', '-').trim();

        const product = {
            id: id,
            user: user.id!,
            ...rest,
        };


        const queries: any = [];

        if (!form.id){
            queries.push(
                db.insert(Product).values(product)
            )
        } else {
            queries.push (
                db.update(Product).set(product).where(eq(Product.id, id))
            )
             
        }

        // Imagenes
        const secureUrls:string[] = [];
        if (form.imageFiles && form.imageFiles.length > 0 && form.imageFiles[0].size > 0) {
            const urls = await Promise.all(
                form.imageFiles?.map(file => ImageUpload.upload(file))
            );

            
            secureUrls.push(...urls)
        }

        secureUrls.forEach(imageUrl => {
            const imageObj = {
                id: UUID(),
                productId: product.id,
                image: imageUrl,
            }

            queries.push(db.insert(ProductImage).values(imageObj));
        })
        
        // imageFiles?.forEach(async (imageFile) => {
        //     if (imageFile.size <= 0 ) return;


            
        //     const url = await ImageUpload.upload(imageFile)
        // });

        await db.batch(queries);

        return product;
    }
})

// Acción para eliminar productos
export const deleteProduct = defineAction({
    accept: 'json',
    input: z.object({
        id: z.string().min(1, 'ID is required'),
    }),
    handler: async (input, { request }) => {
        const session = await getSession(request);
        const user = session?.user;

        if (!user) {
            throw new Error('Unauthorized');
        }

        const { id } = input;

        try {
            // Verificar que el producto exista y pertenezca al usuario
            const [product] = await db
                .select()
                .from(Product)
                .where(eq(Product.id, id))
                .limit(1);

            if (!product) {
                throw new Error('Product not found');
            }

            // Obtener las imágenes asociadas al producto
            const images = await db
                .select()
                .from(ProductImage)
                .where(eq(ProductImage.productId, id));

            // Eliminar las imágenes físicas si es necesario
            if (images.length > 0) {
                await Promise.all(
                    images.map(image => ImageUpload.delete(image.image))
                ).catch(error => {
                    console.error('Error deleting images:', error);
                    // Continuar aun si falla la eliminación de imágenes
                });
            }

            // Eliminar registros de la base de datos
            await db.transaction(async (tx) => {
                // Eliminar imágenes asociadas
                await tx.delete(ProductImage)
                    .where(eq(ProductImage.productId, id));
                
                // Eliminar producto
                await tx.delete(Product)
                    .where(eq(Product.id, id));
            });

            return { success: true, message: 'Product deleted successfully' };
        } catch (error) {
            console.error('Error deleting product:', error);
            throw new Error('Failed to delete product');
        }
    }
});
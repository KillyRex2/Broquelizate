import { defineAction } from "astro:actions";
import { db, eq, Product, ProductImage } from "astro:db";
import { z } from "astro:schema";

const newProduct = {
    id: '',
    name: 'Broquel perron',
    price: 100,
    description: `Elegante arete que realza tu estilo con sofisticación y calidad excepcional.`,
    category: 'Titanio',
    slug: 'nuevo-producto',
    type: 'Broqueles',
    stock: 1,
    piercing_name: 'Lóbulo', // Cambiado de array a string para consistencia
    cost: 50.2,
    hasVariants: false,
    user: ''
}

export const getProductBySlug = defineAction({
    accept: 'json',
    input: z.string(),
    handler: async(slug) => {
        // Caso especial para nuevo producto
        if(slug === 'new') {
            return {
                product: newProduct,
                images: [],
            }
        }

        // Obtener producto existente con todos los campos necesarios
        const [product] = await db
            .select({
                id: Product.id,
                name: Product.name,
                price: Product.price,
                description: Product.description,
                category: Product.category,
                slug: Product.slug,
                type: Product.type,
                stock: Product.stock,
                piercing_name: Product.piercing_name,
                cost: Product.cost,
                hasVariants: Product.hasVariants,
                user: Product.user
            })
            .from(Product)
            .where(eq(Product.slug, slug))

        if (!product){
            throw new Error(`Product with slug ${slug} not found`)
        }

        // ✅ CORRECCIÓN CRÍTICA: Buscar imágenes por productId, NO por variantId
        const images = await db
            .select()
            .from(ProductImage)
            .where(eq(ProductImage.productId, product.id)) // CORREGIDO - Ahora busca por productId

        console.log(`Producto encontrado: ${product.name}, Imágenes: ${images.length}`);

        return {
            product: {
                ...product,
                hasVariants: product.hasVariants ?? false, // Garantizar que nunca sea null/undefined
            },
            images: images.map(img => ({
                id: img.id,
                productId: img.productId,
                variantId: img.variantId,
                image: img.image
            })),
        };
    }
})
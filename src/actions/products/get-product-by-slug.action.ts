import { defineAction } from "astro:actions";
import { db, eq, Product, ProductImage } from "astro:db";
import { z } from "astro:schema"

export const  getProductBySlug = defineAction({
    accept: 'json',
    input: z.string(),
    handler: async(slug) => {
        const [product] = await db
            .select()
            .from(Product)
            .where(eq(Product.slug, slug))
        
        if (!product){
            throw new Error(`Product with slug ${slug} not found`)
        }

        const images = await db
            .select()
            .from(ProductImage)
            .where(eq(ProductImage.productId, product.id))

        return{
            product: product,
            images: images.map( i => i.image),
        };
    }
})
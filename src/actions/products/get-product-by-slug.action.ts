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

}

export const  getProductBySlug = defineAction({
    accept: 'json',
    input: z.string(),
    handler: async(slug) => {
        if(slug === 'new') {
            return {
                product: newProduct,
                images: [],
            }
        }
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
            images: images,
            // images: images.map( i => i.image),
        };
    }
})
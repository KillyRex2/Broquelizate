import { defineAction } from "astro:actions";
import { db, eq, Product, ProductImage, ProductVariant } from "astro:db";
import { z } from "astro:schema";

// ✅ NUEVO: Definir tipos para las variantes
interface VariantData {
    id: string;
    variantName: string;
    variantValue: string;
    priceAdjustment: number;
    stock: number;
    sku: string | null;
    isDefault: boolean;
    isActive: boolean;
}

interface ImageData {
    id: string;
    productId: string;
    variantId: string | null;
    image: string;
}

const newProduct = {
    id: '',
    name: 'Broquel perron',
    price: 100,
    description: `Elegante arete que realza tu estilo con sofisticación y calidad excepcional.`,
    category: 'Titanio',
    slug: 'nuevo-producto',
    type: 'Broqueles',
    stock: 1,
    piercing_name: 'Lóbulo',
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
                generalImages: [],
                variantImages: [],
                variants: [] as VariantData[], // ✅ Tipo explícito
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
                allowsEngraving: Product.allowsEngraving, 
                user: Product.user
            })
            .from(Product)
            .where(eq(Product.slug, slug))

        if (!product){
            throw new Error(`Product with slug ${slug} not found`)
        }

        // ✅ Obtener TODAS las imágenes del producto (generales + variantes)
        const allImages = await db
            .select()
            .from(ProductImage)
            .where(eq(ProductImage.productId, product.id));

        // ✅ Separar imágenes generales de imágenes de variantes
        const generalImages = allImages.filter(img => !img.variantId);
        const variantImages = allImages.filter(img => img.variantId);

        console.log(`Producto: ${product.name}`);
        console.log(`Imágenes generales: ${generalImages.length}`);
        console.log(`Imágenes de variantes: ${variantImages.length}`);

        // ✅ Si el producto tiene variantes, obtener la información de las variantes
        let variants: VariantData[] = []; // ✅ CORRECCIÓN: Tipo explícito
        if (product.hasVariants) {
            variants = await db
                .select({
                    id: ProductVariant.id,
                    variantName: ProductVariant.variantName,
                    variantValue: ProductVariant.variantValue,
                    priceAdjustment: ProductVariant.priceAdjustment,
                    stock: ProductVariant.stock,
                    sku: ProductVariant.sku,
                    isDefault: ProductVariant.isDefault,
                    isActive: ProductVariant.isActive,
                })
                .from(ProductVariant)
                .where(eq(ProductVariant.productId, product.id));
        }

        return {
            product: {
                ...product,
                hasVariants: product.hasVariants ?? false,
            },
            images: allImages.map(img => ({
                id: img.id,
                productId: img.productId,
                variantId: img.variantId,
                image: img.image
            })),
            // ✅ NUEVO: Imágenes separadas por tipo
            generalImages: generalImages.map(img => ({
                id: img.id,
                productId: img.productId,
                image: img.image
            })),
            variantImages: variantImages.map(img => ({
                id: img.id,
                productId: img.productId,
                variantId: img.variantId,
                image: img.image
            })),
            // ✅ NUEVO: Lista de variantes para el selector
            variants: variants,
        };
    }
})
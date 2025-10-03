// src/actions/load-products-from-cart.action.ts
import type { CartItem, CartProductItem } from '@/interfaces';
import { defineAction } from 'astro:actions';
import { db, eq, inArray, Product, ProductImage, ProductVariantCombination } from 'astro:db';

export const loadProductsFromCart = defineAction({
    accept: 'json',
    handler: async(_, {cookies}) => {
        // Leer directamente de las cookies
        const cart = JSON.parse(cookies.get('cart')?.value ?? '[]') as CartItem[];
        
        if (cart.length === 0) return [];
        
        console.log("Cart items desde cookies:", cart);

        // Obtener IDs únicos
        const productIds = [...new Set(cart.map(item => item.productId))];
        const combinationIds = cart
            .filter(item => item.combinationId)
            .map(item => item.combinationId as string);

        // Cargar productos con imágenes
        const dbProducts = await db
            .select()
            .from(Product)
            .leftJoin(ProductImage, eq(Product.id, ProductImage.productId))
            .where(inArray(Product.id, productIds));

        // Cargar combinaciones de variantes si existen
        let variantCombinations: any[] = [];
        if (combinationIds.length > 0) {
            variantCombinations = await db
                .select()
                .from(ProductVariantCombination)
                .where(inArray(ProductVariantCombination.id, combinationIds));
        }

        console.log("Productos encontrados:", dbProducts.length);
        console.log("Combinaciones encontradas:", variantCombinations.length);

        // Mapear cada item del carrito
        const productsWithDetails: CartProductItem[] = cart.map(item => {
            // Buscar el producto base
            const dbProduct = dbProducts.find(p => p.Product.id === item.productId);
            if (!dbProduct) {
                throw new Error(`Product with id ${item.productId} not found`);
            }

            const { name, price: basePrice, slug, category, stock: baseStock } = dbProduct.Product;
            const image = dbProduct.ProductImage?.image || '/placeholder.jpg';

            // Inicializar con valores base
            let finalPrice = basePrice;
            let variantPrice: number | undefined = undefined;
            let variantStock = baseStock;
            let variantSku = item.variantSku;
            let variantCombination = item.variantName;

            // Si tiene combinationId, buscar la información de la combinación
            if (item.combinationId) {
                const combination = variantCombinations.find(c => c.id === item.combinationId);
                console.log(`Buscando combinación ${item.combinationId}:`, combination);
                
                if (combination) {
                    // Usar el precio de la combinación
                    finalPrice = combination.price;
                    variantPrice = combination.price;
                    variantStock = combination.stock;
                    
                    // Usar el SKU de la combinación si existe
                    if (combination.sku) {
                        variantSku = combination.sku;
                    }
                    
                    // Usar el nombre de la combinación si existe
                    if (combination.combinationName) {
                        variantCombination = combination.combinationName;
                    }
                    
                    console.log(`Precio ajustado para variante: ${basePrice} -> ${variantPrice}`);
                }
            } 
            // Si no hay combinación pero hay ajuste de precio de variante simple
            else if (item.variantPriceAdjustment !== undefined) {
                finalPrice = basePrice + item.variantPriceAdjustment;
                variantPrice = finalPrice;
                console.log(`Precio con ajuste simple: ${basePrice} + ${item.variantPriceAdjustment} = ${variantPrice}`);
            }

            return {
                // Información básica del producto
                productId: item.productId,
                name: name,
                category: category,
                quantity: item.quantity,
                slug: slug,
                
                // Imagen
                image: image.startsWith('http')
                    ? image
                    : `${import.meta.env.PUBLIC_URL}/images/products/${image}`,
                
                // Precios
                price: basePrice,           // Precio base del producto
                variantPrice: variantPrice, // Precio con variante (si aplica)
                
                // Información de variantes
                variantId: item.variantId,
                combinationId: item.combinationId,
                variantName: item.variantName,
                variantCombination: variantCombination,
                variantSku: variantSku,
                
                // Stock
                stock: variantStock,
                
                // Flags
                hasVariant: !!(item.combinationId || item.variantId)
            };
        });

        console.log("Productos procesados:", productsWithDetails);
        return productsWithDetails;
    },
});
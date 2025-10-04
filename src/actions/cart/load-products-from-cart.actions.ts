// src/actions/load-products-from-cart.action.ts
import type { CartItem, CartProductItem } from '@/interfaces';
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { db, eq, inArray, Product, ProductImage, ProductVariantCombination } from 'astro:db';

export const loadProductsFromCart = defineAction({
    input: z.any().optional(), // Aceptar cualquier input u opcional
    handler: async(input, {cookies}): Promise<CartProductItem[]> => { // ⭐ AGREGAR tipo de retorno explícito
        const cart = JSON.parse(cookies.get('cart')?.value ?? '[]') as CartItem[];
        
        if (cart.length === 0) return [];
        
        console.log("Cart items desde cookies:", cart);

        const productIds = [...new Set(cart.map(item => item.productId))];
        const combinationIds = cart
            .filter(item => item.combinationId)
            .map(item => item.combinationId as string);

        const dbProducts = await db
            .select()
            .from(Product)
            .leftJoin(ProductImage, eq(Product.id, ProductImage.productId))
            .where(inArray(Product.id, productIds));

        let variantCombinations: any[] = [];
        if (combinationIds.length > 0) {
            variantCombinations = await db
                .select()
                .from(ProductVariantCombination)
                .where(inArray(ProductVariantCombination.id, combinationIds));
        }

        console.log("Productos encontrados:", dbProducts.length);
        console.log("Combinaciones encontradas:", variantCombinations.length);

        const productsWithDetails: CartProductItem[] = cart.map((item): CartProductItem => { // ⭐ Tipo explícito en map
            const dbProduct = dbProducts.find(p => p.Product.id === item.productId);
            if (!dbProduct) {
                throw new Error(`Product with id ${item.productId} not found`);
            }

            const { name, price: basePrice, slug, category, stock: baseStock } = dbProduct.Product;
            const image = dbProduct.ProductImage?.image || '/placeholder.jpg';

            let finalPrice = basePrice;
            let variantPrice: number | undefined = undefined;
            let variantStock = baseStock;
            let variantSku = item.variantSku;
            let variantCombination = item.variantName;

            // PRIORIDAD 1: Si tiene combinationId, buscar en la BD
            if (item.combinationId) {
                const combination = variantCombinations.find(c => c.id === item.combinationId);
                console.log(`Buscando combinación ${item.combinationId}:`, combination);
                
                if (combination) {
                    finalPrice = combination.price;
                    variantPrice = combination.price;
                    variantStock = combination.stock;
                    
                    if (combination.sku) {
                        variantSku = combination.sku;
                    }
                    
                    if (combination.combinationName) {
                        variantCombination = combination.combinationName;
                    }
                    
                    console.log(`Precio de combinación: ${variantPrice}`);
                } 
                // Fallback: Si la combinación no se encuentra pero tenemos variantPrice en cookies
                else if (item.variantPrice !== undefined) {
                    variantPrice = item.variantPrice;
                    finalPrice = item.variantPrice;
                    console.log(`Usando variantPrice de cookies: ${variantPrice}`);
                }
            } 
            // PRIORIDAD 2: Si tiene variantPrice directo en cookies (sin combinationId)
            else if (item.variantPrice !== undefined) {
                variantPrice = item.variantPrice;
                finalPrice = item.variantPrice;
                console.log(`Precio de cookies: ${variantPrice}`);
            }
            // PRIORIDAD 3: Si tiene ajuste de precio de variante simple
            else if (item.variantPriceAdjustment !== undefined) {
                finalPrice = basePrice + item.variantPriceAdjustment;
                variantPrice = finalPrice;
                console.log(`Precio con ajuste: ${basePrice} + ${item.variantPriceAdjustment} = ${variantPrice}`);
            }

            return { // ⭐ Return explícito del objeto
                productId: item.productId,
                name: name,
                category: category,
                quantity: item.quantity,
                slug: slug,
                
                image: image.startsWith('http')
                    ? image
                    : `${import.meta.env.PUBLIC_URL}/images/products/${image}`,
                
                price: basePrice,
                variantPrice: variantPrice,
                
                variantId: item.variantId,
                combinationId: item.combinationId,
                variantName: item.variantName,
                variantCombination: variantCombination,
                variantSku: variantSku,
                
                stock: variantStock,
                hasVariant: !!(item.combinationId || item.variantId)
            };
        });

        console.log("Productos procesados con precios:", productsWithDetails.map(p => ({
            name: p.name,
            basePrice: p.price,
            variantPrice: p.variantPrice,
            combinationId: p.combinationId
        })));
        
        return productsWithDetails;
    },
});
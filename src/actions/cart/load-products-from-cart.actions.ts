// src/actions/load-products-from-cart.action.ts
import type { CartItem, CartProductItem } from '@/interfaces';
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { 
  db, 
  eq, 
  inArray, 
  Product, 
  ProductImage, 
  ProductVariantCombination,
  VariantCombinationItem 
} from 'astro:db';

export const loadProductsFromCart = defineAction({
    input: z.any().optional(),
    handler: async(input, {cookies}): Promise<CartProductItem[]> => {
        let cart: CartItem[] = [];
        try {
            const raw = JSON.parse(cookies.get('cart')?.value ?? '[]');
            if (!Array.isArray(raw)) return [];
            // Sanitizar: solo permitir campos esperados con tipos correctos
            cart = raw.filter((item: any) => 
                item && 
                typeof item.productId === 'string' && 
                typeof item.quantity === 'number' && 
                item.quantity > 0 && 
                item.quantity <= 100 &&
                item.productId.length <= 50
            ).slice(0, 50); // Máximo 50 items
        } catch {
            return [];
        }
        
        if (cart.length === 0) return [];
        

        const productIds = [...new Set(cart.map(item => item.productId))];
        const combinationIds = cart
            .filter(item => item.combinationId)
            .map(item => item.combinationId as string);

        // ✅ OBTENER PRODUCTOS
        const allImages = await db
            .select()
            .from(ProductImage)
            .where(inArray(ProductImage.productId, productIds));

        // ✅ OBTENER PRODUCTOS
        const dbProducts = await db
            .select()
            .from(Product)
            .where(inArray(Product.id, productIds));

        // ✅ OBTENER COMBINACIONES DE VARIANTES
        let variantCombinations: any[] = [];
        let variantCombinationItems: any[] = [];
        
        if (combinationIds.length > 0) {
            variantCombinations = await db
                .select()
                .from(ProductVariantCombination)
                .where(inArray(ProductVariantCombination.id, combinationIds));

            // ✅ OBTENER LOS ITEMS DE CADA COMBINACIÓN (para saber qué variantIds tiene cada combinación)
            variantCombinationItems = await db
                .select()
                .from(VariantCombinationItem)
                .where(inArray(VariantCombinationItem.combinationId, combinationIds));

        }

        // ✅ PROCESAR CADA ITEM DEL CARRITO
        const productsWithDetails: CartProductItem[] = cart.map((item): CartProductItem => {
            const dbProduct = dbProducts.find(p => p.id === item.productId);
            if (!dbProduct) {
                throw new Error(`Product with id ${item.productId} not found`);
            }

            const { name, price: basePrice, slug, category, stock: baseStock } = dbProduct;

            // ✅ OBTENER IMÁGENES DE ESTE PRODUCTO
            const productImages = allImages.filter(img => img.productId === item.productId);
            
            // Imagen general: priorizar cover image, luego primera sin variantId
            const coverImageId = (dbProduct as any).coverImageId;
            const coverImage = coverImageId 
                ? productImages.find(img => img.id === coverImageId)
                : null;
            const generalImage = coverImage || productImages.find(img => !img.variantId);
            const baseImageUrl = generalImage?.image || 'https://placehold.co/400x400/1a1a1a/eab308?text=Sin+Imagen';

            // ✅ BUSCAR IMAGEN ESPECÍFICA DE VARIANTE
            let variantImageUrl: string | undefined;
            
            if (item.combinationId) {
                // Obtener los variantIds que forman esta combinación
                const combinationVariantIds = variantCombinationItems
                    .filter(vci => vci.combinationId === item.combinationId)
                    .map(vci => vci.variantId);


                // Buscar si alguna de las variantes de esta combinación tiene imagen específica
                const variantImage = productImages.find(img => 
                    img.variantId && combinationVariantIds.includes(img.variantId)
                );

                if (variantImage) {
                    variantImageUrl = variantImage.image;
                    
                } else {
                    
                }
            }

            // ✅ FORMATEAR URL DE IMAGEN GENERAL
            const formattedBaseImage = baseImageUrl.startsWith('http')
                ? baseImageUrl
                : `${import.meta.env.PUBLIC_URL}/images/products/${baseImageUrl}`;

            // ✅ FORMATEAR URL DE IMAGEN DE VARIANTE (si existe)
            const formattedVariantImage = variantImageUrl 
                ? (variantImageUrl.startsWith('http')
                    ? variantImageUrl
                    : `${import.meta.env.PUBLIC_URL}/images/products/${variantImageUrl}`)
                : undefined;

            // ✅ CALCULAR PRECIOS
            let finalPrice = basePrice;
            let variantPrice: number | undefined = undefined;
            let variantStock = baseStock;
            let variantSku = item.variantSku;
            let variantCombination = item.variantName;

            // PRIORIDAD 1: Si tiene combinationId, buscar en la BD
            if (item.combinationId) {
                const combination = variantCombinations.find(c => c.id === item.combinationId);
                
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
                    
                } 
                // Fallback: Si la combinación no se encuentra pero tenemos variantPrice en cookies
                else if (item.variantPrice !== undefined) {
                    variantPrice = item.variantPrice;
                    finalPrice = item.variantPrice;
                }
            } 
            // PRIORIDAD 2: Si tiene variantPrice directo en cookies (sin combinationId)
            else if (item.variantPrice !== undefined) {
                variantPrice = item.variantPrice;
                finalPrice = item.variantPrice;
            }
            // PRIORIDAD 3: Si tiene ajuste de precio de variante simple
            else if (item.variantPriceAdjustment !== undefined) {
                finalPrice = basePrice + item.variantPriceAdjustment;
                variantPrice = finalPrice;
            }

            // ✅ RETORNAR OBJETO COMPLETO CON IMAGEN DE VARIANTE
            return {
                productId: item.productId,
                name: name,
                category: category,
                quantity: item.quantity,
                slug: slug,
                
                // ✅ Imagen general (siempre presente)
                image: formattedBaseImage,
                
                // ✅ Imagen de variante (opcional)
                variantImage: formattedVariantImage,
                
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
        
        return productsWithDetails;
    },
});
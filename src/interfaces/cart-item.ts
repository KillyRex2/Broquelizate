// src/interfaces/cart-item.ts

export interface CartItem {
    productId: string;
    quantity: number;
    
    // Campos opcionales para variantes
    variantId?: string;
    combinationId?: string;
    variantName?: string;
    variantSku?: string;
    variantPriceAdjustment?: number;
    variantPrice?: number; // ⭐ AGREGAR ESTA LÍNEA
}

// Tipo para el producto cargado desde el carrito con toda la información
export interface CartProductItem {
    // Información básica del producto
    productId: string;
    name: string;
    category: string;
    quantity: number;
    slug: string;
    
    // Imagen
    image: string;
    
    // Precios
    price: number;           // Precio base del producto
    variantPrice?: number;   // Precio con variante (si aplica)
    
    // Información de variantes
    variantId?: string;
    combinationId?: string;
    variantName?: string;
    variantCombination?: string;
    variantSku?: string;
    
    // Stock
    stock: number;
    
    // Flags
    hasVariant: boolean;
}
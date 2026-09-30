// src/interfaces/cart-item.ts

import type { CustomizationValue } from "@/utils/customization";

export interface CartItem {
    productId: string;
    quantity: number;
    
    // Campos opcionales para variantes
    variantId?: string;
    combinationId?: string;
    variantName?: string;
    variantSku?: string;
    variantPriceAdjustment?: number;
    variantPrice?: number;

    // ✅ NUEVO: Valores de personalización del cliente
    customizationValues?: CustomizationValue[];

    // ⚠️ DEPRECADO: Mantener durante la transición
    engraving?: {
        id: string;
        imageUrl: string;
        notes: string;
    };
}

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
    price: number;
    variantPrice?: number;
    
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
    variantImage?: string;

    // ✅ NUEVO: Valores de personalización del cliente
    customizationValues?: CustomizationValue[];

    // ⚠️ DEPRECADO: Mantener durante la transición
    engraving?: {
        id: string;
        imageUrl: string;
        notes: string;
    };
}
// src/interfaces/product-with-variants.interface.ts

import type { ProductWithImages } from "./index";

export interface ProductVariant {
  id: string;
  productId: string;
  variantName: string; // "Color", "Tamaño de Poste", etc.
  variantValue: string; // "Dorado", "6mm", etc.
  priceAdjustment: number; // diferencia vs precio base
  cost: number | null;
  stock: number;
  sku: string | null; // Cambiado para coincidir con DB
  isDefault: boolean;
  isActive: boolean; // Agregado para coincidir con DB
  createdAt: Date;
}

export interface ProductVariantCombination {
  id: string;
  productId: string;
  combinationName: string | null; // Cambiado para coincidir con DB
  price: number; // precio final de esta combinación
  cost: number | null;
  stock: number;
  sku: string | null; // Cambiado para coincidir con DB
  isActive: boolean;
  createdAt: Date;
}

export interface VariantCombinationItem {
  id: string;
  combinationId: string;
  variantId: string;
}

// Extendemos la interfaz existente
export interface ProductWithVariants extends ProductWithImages {
  // hasVariants ya está en ProductWithImages, no necesitamos redefinirlo
  // variants de ProductWithImages se mantiene como ProductVariantInfo[]
  
  // Usamos nombres diferentes para evitar conflicto
  productVariants?: ProductVariant[]; // Cambiado de 'variants' a 'productVariants'
  combinations?: ProductVariantCombination[];
  selectedCombination?: ProductVariantCombination; // Para el carrito
}

// Para el carrito, extendemos CartItem
export interface CartItemWithVariants {
  productId: string;
  quantity: number;
  variantCombinationId?: string; // ID de la combinación seleccionada
  variantDescription?: string; // Descripción legible: "Dorado - 6mm"
}

// Interface para organizar variantes por tipo en el frontend
export interface GroupedVariants {
  [variantName: string]: {
    name: string; // "Color", "Tamaño de Poste"
    options: {
      id: string;
      value: string; // "Dorado", "6mm"
      priceAdjustment: number;
      cost: number | null;
      stock: number;
      isDefault: boolean;
      isActive: boolean; // Agregado para consistencia
    }[];
  };
}

// Para el formulario de administración
export interface VariantFormData {
  variantName: string;
  variantValue: string;
  priceAdjustment: number;
  stock: number;
  sku: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface CombinationFormData {
  variants: string[]; // IDs de las variantes que forman esta combinación
  price: number;
  stock: number;
  sku: string | null;
  isActive: boolean;
  combinationName: string | null;
}

// Helper type para el selector de variantes en el frontend
export interface VariantSelection {
  [variantName: string]: string; // ej: { "Color": "var_1", "Tamaño": "var_4" }
}

// Para mostrar información completa en el producto
export interface ProductWithCompleteVariants extends ProductWithImages {
  // hasVariants ya está en ProductWithImages
  groupedVariants: GroupedVariants;
  availableCombinations: ProductVariantCombination[];
  defaultCombination?: ProductVariantCombination;
}

// Si necesitas un tipo que tenga ambos tipos de variantes, puedes crear uno adicional
export interface ProductWithAllVariants extends ProductWithImages {
  // variants viene de ProductWithImages como ProductVariantInfo[]
  productVariants?: ProductVariant[];
  combinations?: ProductVariantCombination[];
  selectedCombination?: ProductVariantCombination;
}
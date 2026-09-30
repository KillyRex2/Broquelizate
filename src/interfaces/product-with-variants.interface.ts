// src/interfaces/product-with-variants.interface.ts

import type { CustomizationField, CustomizationValue } from "@/utils/customization";
 
export interface ProductVariant {
  id: string;
  productId: string;
  variantName: string;
  variantValue: string;
  priceAdjustment: number;
  cost: number | null;
  stock: number;
  sku: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}
 
export interface ProductVariantInfo {
  id: string;
  name: string;
  sku: string;
  priceAdjustment: number;
  cost: number | null;
  stock: number;
  images: string[];
  finalPrice: number;
}
 
export interface ProductWithImages {
  id: string;
  name: string;
  price: number;
  basePrice?: number;
  description: string | null;
  category: string | null;
  slug: string;
  type: string | null;
  stock: number;
  user: string;
  cost?: number;
  piercing_name: string[];
  images: string[];
  hasVariants: boolean;
 
  // ✅ NUEVO: Campos de personalización configurables
  customizationFields: CustomizationField[];
 
  // ⚠️ DEPRECADO: Mantener durante la transición
  allowsEngraving: boolean;
 
  variants?: ProductVariantInfo[];
}
 
export interface ProductVariantCombination {
  id: string;
  productId: string;
  combinationName: string | null;
  price: number;
  cost: number | null;
  stock: number;
  sku: string | null;
  isActive: boolean;
  createdAt: Date;
}
 
export interface VariantCombinationItem {
  id: string;
  combinationId: string;
  variantId: string;
}
 
export interface ProductWithVariants extends ProductWithImages {
  productVariants?: ProductVariant[];
  combinations?: ProductVariantCombination[];
  selectedCombination?: ProductVariantCombination;
}
 
export interface CartItemWithVariants {
  productId: string;
  quantity: number;
  variantCombinationId?: string;
  variantDescription?: string;
 
  // ✅ NUEVO: Valores de personalización del cliente
  customizationValues?: CustomizationValue[];
 
  // ⚠️ DEPRECADO: Mantener durante la transición
  engraving?: {
    id: string;
    imageUrl: string;
    notes: string;
  };
}
 
export interface GroupedVariants {
  [variantName: string]: {
    name: string;
    options: {
      id: string;
      value: string;
      priceAdjustment: number;
      cost: number | null;
      stock: number;
      isDefault: boolean;
      isActive: boolean;
    }[];
  };
}
 
// ✅ NUEVO: Resultado de getGroupedProductVariants con imágenes de combinaciones
export interface GroupedVariantsResult {
  hasVariants: boolean;
  groupedVariants: GroupedVariants;
  combinations: ProductVariantCombination[];
  combinationImages: Record<string, { id: string; image: string }>;
}
 
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
  variants: string[];
  price: number;
  stock: number;
  sku: string | null;
  isActive: boolean;
  combinationName: string | null;
}
 
export interface VariantSelection {
  [variantName: string]: string;
}
 
export interface ProductWithCompleteVariants extends ProductWithImages {
  groupedVariants: GroupedVariants;
  availableCombinations: ProductVariantCombination[];
  defaultCombination?: ProductVariantCombination;
}
 
export interface ProductWithAllVariants extends ProductWithImages {
  productVariants?: ProductVariant[];
  combinations?: ProductVariantCombination[];
  selectedCombination?: ProductVariantCombination;
}
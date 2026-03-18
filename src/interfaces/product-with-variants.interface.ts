// src/interfaces/product-with-variants.interface.ts

import type { ProductWithImages } from "./index";

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
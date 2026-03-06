// src/interfaces/product-for-pos.interface.ts

import type { ProductWithVariants } from "./product-with-variants.interface";

/**
 * Información simplificada de variante para el POS
 */
export interface VariantOption {
  id: string;
  name: string;
  sku: string;
  priceAdjustment: number;
  cost: number | null; 
  stock: number;
  images: string[];
  finalPrice: number;
}

/**
 * Producto optimizado para el punto de venta
 * Contiene toda la información necesaria para mostrar y vender
 */
export interface ProductForPOS {
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
  variantOptions?: VariantOption[]; // Solo presente si hasVariants es true
}

/**
 * Convierte un ProductWithVariants al formato simplificado para POS
 */
export function convertToProductForPOS(product: ProductWithVariants): ProductForPOS {
  const variantOptions: VariantOption[] = [];

  if (product.combinations && product.combinations.length > 0) {
    // Usar combinaciones si existen
    product.combinations.forEach(combo => {
      if (combo.isActive) {
        variantOptions.push({
          id: combo.id,
          name: combo.combinationName || 'Variante',
          sku: combo.sku || '',
          priceAdjustment: combo.price - product.price,
          cost: combo.cost || null,
          stock: combo.stock,
          images: (combo as any).images || product.images, // TODO: Las imágenes se agregan dinámicamente cuando esté disponible
          finalPrice: combo.price
        });
      }
    });
  } else if (product.productVariants && product.productVariants.length > 0) {
    // Si solo hay variantes simples sin combinaciones
    // Solo incluir variantes activas
    product.productVariants
      .filter(variant => variant.isActive)
      .forEach(variant => {
        variantOptions.push({
          id: variant.id,
          name: `${variant.variantName}: ${variant.variantValue}`,
          sku: variant.sku || '',
          priceAdjustment: variant.priceAdjustment,
          cost: variant.cost ?? null, // ✅ FALTA ESTA LÍNEA
          stock: variant.stock,
          images: product.images,
          finalPrice: product.price + variant.priceAdjustment
        });
      });
  }

  // Retornar el producto en formato POS
  const productForPOS: ProductForPOS = {
    id: product.id,
    name: product.name,
    price: product.price,
    basePrice: product.basePrice,
    description: product.description,
    category: product.category,
    slug: product.slug,
    type: product.type,
    stock: product.stock,
    user: product.user,
    cost: product.cost,
    piercing_name: product.piercing_name,
    images: product.images,
    hasVariants: product.hasVariants
  };

  // Solo agregar variantOptions si hay variantes
  if (variantOptions.length > 0) {
    productForPOS.variantOptions = variantOptions;
  }

  return productForPOS;
}
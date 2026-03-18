// interfaces/product-with-images.interface.ts

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
  allowsEngraving: boolean;
  variants?: ProductVariantInfo[];
}
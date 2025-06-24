import type { ProductWithImages } from "@/interfaces";
import { defineAction } from "astro:actions";
import { and, count, db, eq, gt, inArray, lte, Product, ProductImage, sql } from "astro:db";
import { z } from "astro:schema";

// Lista de categorías válidas
const validCategories = [
  "Titanio", "Acero Quirúrgico", "Oro 10k", "Oro 14k", "Oro 18k",
  "Chapa de Oro 14K", "Chapa de Oro 18K", "Acero Inoxidable",
  "Plástico", "Plata", "Rodio"
];

export const inputSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(12),
  category: z.string().optional().default('all'),
  maxPrice: z.number().optional().default(5000),
  inStock: z.boolean().optional().default(false)
});

export const handler = async ({ 
  page, 
  limit, 
  category, 
  maxPrice, 
  inStock 
}: z.infer<typeof inputSchema>) => {
  try {
    page = Math.max(page, 1);
    
    // Construir condiciones de filtro
    const filters = [];
    let filteredCategory = category;
    
    // Validar categoría
    if (category !== 'all' && !validCategories.includes(category)) {
      filteredCategory = 'all';
    }
    
    // Aplicar filtros
    if (filteredCategory !== 'all') {
      filters.push(eq(Product.category, filteredCategory));
    }
    
    if (maxPrice > 0) {
      filters.push(lte(Product.price, maxPrice));
    }
    
    if (inStock) {
      filters.push(gt(Product.stock, 0));
    }
    
    // Consulta para el conteo total
    const countQuery = db
      .select({ count: count() })
      .from(Product);
      
    if (filters.length > 0) {
      countQuery.where(and(...filters));
    }
    
    const countResult = await countQuery;
    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);
    
    // Manejar páginas inválidas
    if (page > totalPages && totalPages > 0) {
      return {
        products: [] as ProductWithImages[],
        totalPages
      };
    }
    
    // Consulta principal para productos
    const baseProductsQuery = db
      .select({
        id: Product.id,
        name: Product.name,
        price: Product.price,
        description: Product.description,
        category: Product.category,
        slug: Product.slug,
        type: Product.type,
        stock: Product.stock,
        user: Product.user
      })
      .from(Product)
      .limit(limit)
      .offset((page - 1) * limit);
    
    if (filters.length > 0) {
      baseProductsQuery.where(and(...filters));
    }
    
    const products = await baseProductsQuery;
    
    // Obtener IDs de productos para buscar imágenes
    const productIds = products.map(p => p.id);
    
    // Consulta para imágenes
    const imagesQuery = await db
      .select({
        productId: ProductImage.productId,
        image: ProductImage.image
      })
      .from(ProductImage)
      .where(inArray(ProductImage.productId, productIds));
    
    // Agrupar imágenes por producto
    const imagesMap = new Map<string, string[]>();
    imagesQuery.forEach(img => {
      if (!imagesMap.has(img.productId)) {
        imagesMap.set(img.productId, []);
      }
      imagesMap.get(img.productId)!.push(img.image);
    });
    
    // Combinar productos con imágenes
    const formattedProducts = products.map(product => {
      const images = imagesMap.get(product.id)?.slice(0, 2) || ['no-image.png'];
      return {
        ...product,
        images
      };
    });
    
    return {
      products: formattedProducts,
      totalPages
    };
    
  } catch (error) {
    console.error("Error en getProductsByPage:", error);
    throw new Error("Error al obtener productos");
  }
};

export const getProductsByPage = defineAction({
  accept: 'json',
  input: inputSchema,
  handler
});
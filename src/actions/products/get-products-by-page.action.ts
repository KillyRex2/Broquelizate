import type { ProductWithImages } from "@/interfaces";
import { defineAction } from "astro:actions";
import { and, count, db, eq, gt, inArray, lte, Product, ProductImage, sql, asc, desc } from "astro:db";
import { z } from "astro:schema";

// Lista de categorías válidas
const validCategories = [
  "Titanio", "Acero Quirúrgico", "Oro 10k", "Oro 14k", "Oro 18k",
  "Chapa de Oro 14K", "Chapa de Oro 18K", "Acero Inoxidable",
  "Plástico", "Plata", "Rodio", "Oro 10k cadenas", "Oro 10k anillos",
  "Oro 10k arracadas", "Plata .925"
];

const validPiercings = [
  'Lóbulo', 'Lóbulo Superior', 'Hélix', 'Antihelix', 'Tragus', 
  'Antitragus', 'Rook', 'Conch', 'Daith', 'Industrial', 
  'Séptum', 'Nóstril', 'Navel', 'Flat'
];

// Columnas válidas para ordenamiento
const validSortColumns = ['name', 'price', 'stock', 'category', 'createdAt'];
const validSortOrders = ['asc', 'desc'];

// ✅ CORREGIDO: Añadida opción 'inStock' para filtrar productos con stock > 0
const stockFilters = ['all', 'inStock', 'out', 'low', 'available', 'high'] as const;

export const inputSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(12),
  category: z.string().optional().default('all'),
  maxPrice: z.number().optional().default(99999),
  minPrice: z.number().optional().default(0),
  stockFilter: z.enum(stockFilters).optional().default('all'),
  search: z.string().optional().default(''),
  piercing: z.string().optional().default('all'),
  sortBy: z.string().optional().default('name'),
  sortOrder: z.string().optional().default('asc'),
});

export const handler = async ({ 
  page, 
  limit, 
  category, 
  maxPrice,
  minPrice,
  stockFilter,
  search,
  piercing,
  sortBy,
  sortOrder,
}: z.infer<typeof inputSchema>) => {
  console.log("Parámetros de búsqueda recibidos:", {
    search,
    category,
    minPrice,
    maxPrice,
    stockFilter,
    page,
    limit,
    piercing,
    sortBy,
    sortOrder
  });

  try {
    page = Math.max(page, 1);
    
    // Validar ordenamiento
    if (!validSortColumns.includes(sortBy)) {
      sortBy = 'name';
    }
    if (!validSortOrders.includes(sortOrder)) {
      sortOrder = 'asc';
    }
    
    // Construir condiciones de filtro
    const filters = [];
    filters.push(sql`(${Product.isDeleted} = 0 OR ${Product.isDeleted} IS NULL)`);
    let filteredCategory = category;
    
    // Validar categoría
    if (category !== 'all' && !validCategories.includes(category)) {
      filteredCategory = 'all';
    }
    
    // Aplicar filtros
    if (filteredCategory !== 'all') {
      filters.push(eq(Product.category, filteredCategory));
    }
    
    // Filtro de precio mínimo
    if (minPrice > 0) {
      filters.push(sql`${Product.price} >= ${minPrice}`);
    }
    
    // Filtro de precio máximo
    if (maxPrice > 0 && maxPrice < 99999) {
      filters.push(lte(Product.price, maxPrice));
    }
    
    // ✅ FILTRO DE STOCK MEJORADO - Añadido caso 'inStock'
    switch (stockFilter) {
      case 'inStock': // ✅ NUEVO: Solo productos con stock > 0
        filters.push(gt(Product.stock, 0));
        break;
      case 'out': // Agotado (0)
        filters.push(eq(Product.stock, 0));
        break;
      case 'low': // Mínimo (1-5)
        filters.push(gt(Product.stock, 0));
        filters.push(lte(Product.stock, 5));
        break;
      case 'available': // Arriba del mínimo (6-20)
        filters.push(gt(Product.stock, 5));
        filters.push(lte(Product.stock, 20));
        break;
      case 'high': // Alto stock (>20)
        filters.push(gt(Product.stock, 20));
        break;
      // 'all' no aplica filtro
    }
    
    // FILTRO POR PIERCING
    if (piercing && piercing !== 'all' && validPiercings.includes(piercing)) {
      console.log(`Filtrando por piercing: ${piercing}`);
      const piercingPattern = `%${piercing}%`;
      filters.push(sql`${Product.piercing_name} LIKE ${piercingPattern}`);
    }

    // FILTRO POR BÚSQUEDA
    if (search && search.trim() !== '') {
      console.log(`Filtrando por término de búsqueda: ${search}`);
      const searchPattern = `%${search.toLowerCase()}%`;
      filters.push(
        sql`(LOWER(${Product.name}) LIKE ${searchPattern} OR LOWER(${Product.description}) LIKE ${searchPattern})`
      );
    }
    
    // Consulta para el conteo total
    const countQuery = db
      .select({ count: count() })
      .from(Product);
      
    if (filters.length > 0) {
      countQuery.where(and(...filters));
    }

    console.log(`Número de filtros aplicados: ${filters.length}`);
    
    const countResult = await countQuery;
    const totalItems = countResult[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    console.log(`Total de productos encontrados: ${totalItems}`);
    
    // Manejar páginas inválidas
    if (page > totalPages && totalPages > 0) {
      return {
        products: [] as ProductWithImages[],
        totalPages,
        totalItems
      };
    }
    
    // Determinar columna de ordenamiento
    const getSortColumn = () => {
      switch (sortBy) {
        case 'name': return Product.name;
        case 'price': return Product.price;
        case 'stock': return Product.stock;
        case 'category': return Product.category;
        default: return Product.name;
      }
    };
    
    // Consulta principal para productos con ordenamiento
    const sortColumn = getSortColumn();
    const orderFn = sortOrder === 'desc' ? desc : asc;
    
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
        piercing_name: Product.piercing_name,
        cost: Product.cost,
        coverImageId: Product.coverImageId,
        user: Product.user
      })
      .from(Product)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset((page - 1) * limit);
    
    if (filters.length > 0) {
      baseProductsQuery.where(and(...filters));
    }
    
    const products = await baseProductsQuery;
    
    // Obtener IDs de productos para buscar imágenes
    const productIds = products.map(p => p.id);
    
    // Consulta para imágenes
    let imagesQuery: Array<{ id: string; productId: string; image: string }> = [];
    if (productIds.length > 0) {
      const rawImagesQuery = await db
        .select({
          id: ProductImage.id,
          productId: ProductImage.productId,
          image: ProductImage.image
        })
        .from(ProductImage)
        .where(inArray(ProductImage.productId, productIds));
      
      imagesQuery = rawImagesQuery
        .filter((img): img is { id: string; productId: string; image: string } => 
          img.productId !== null
        );
    }
    
    // Agrupar imágenes por producto
    const imagesMap = new Map<string, Array<{ id: string; image: string }>>();
    imagesQuery.forEach(img => {
      if (!imagesMap.has(img.productId)) {
        imagesMap.set(img.productId, []);
      }
      imagesMap.get(img.productId)!.push({ id: img.id, image: img.image });
    });
    
    // Crear mapa de coverImageId por producto
    const coverMap = new Map<string, string>();
    products.forEach(p => {
      if ((p as any).coverImageId) {
        coverMap.set(p.id, (p as any).coverImageId);
      }
    });
    
    // Combinar productos con imágenes (portada primero)
    const formattedProducts = products.map(product => {
      const productImages = imagesMap.get(product.id) || [];
      const coverId = coverMap.get(product.id);
      
      // Ordenar: portada primero
      const sorted = coverId 
        ? [...productImages].sort((a, b) => {
            if (a.id === coverId) return -1;
            if (b.id === coverId) return 1;
            return 0;
          })
        : productImages;
      
      const images = sorted.length > 0 
        ? sorted.slice(0, 2).map(img => img.image) 
        : ['no-image.png'];
      
      return {
        ...product,
        images
      };
    });
    
    return {
      products: formattedProducts,
      totalPages,
      totalItems
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

export const getInventoryStats = defineAction({
  handler: async () => {
    const allProducts = await db.select().from(Product);
    const LOW_STOCK_THRESHOLD = 5;

    const stats = allProducts.reduce((acc, product) => {
      const stock = product.stock ?? 0;
      const price = product.price ?? 0;
      const cost = product.cost ?? 0;

      if (stock > 0) {
        acc.totalValue += price * stock;
        acc.totalCost += cost * stock;
        acc.inStockCount++;
      }

      if (stock === 0) {
        acc.outOfStockCount++;
      }

      if (stock > 0 && stock <= LOW_STOCK_THRESHOLD) {
        acc.lowStockCount++;
      }
      
      if (stock > 20) {
        acc.highStockCount++;
      }

      return acc;
    }, {
      totalValue: 0,
      totalCost: 0,
      inStockCount: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      highStockCount: 0,
    });

    const estimatedProfit = stats.totalValue - stats.totalCost;

    return {
      ...stats,
      estimatedProfit,
      totalProducts: allProducts.length
    };
  }
});
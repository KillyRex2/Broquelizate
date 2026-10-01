import type { ProductWithImages } from "@/interfaces";
import { defineAction } from "astro:actions";
import { and, or, count, db, eq, gt, inArray, lte, Product, ProductImage, ProductVariant, ProductVariantCombination, sql, asc, desc } from "astro:db";
import { z } from "astro:schema";

// Lista de categorías válidas
const validCategories = [
  "Titanio", "Acero Quirúrgico", "Oro 10k", "Oro 14k", "Oro 18k",
  "Chapa de Oro 14K", "Chapa de Oro 18K", "Acero Inoxidable",
  "Plástico", "Plata", "Rodio", "Oro 10k cadenas", "Oro 10k anillos",
  "Oro 10k arracadas", "Plata .925", "Otros"
];

const validPiercings = [
  'Lóbulo', 'Lóbulo Superior', 'Hélix', 'Antihelix', 'Tragus', 
  'Antitragus', 'Rook', 'Conch', 'Daith', 'Industrial', 
  'Séptum', 'Nóstril', 'Navel', 'Flat'
];

// Columnas válidas para ordenamiento
const validSortColumns = ['name', 'price', 'stock', 'category', 'createdAt'];
const validSortOrders = ['asc', 'desc'];

// Valores de stock admitidos. Pueden llegar combinados: "out,low"
const validStockFilters = ['inStock', 'out', 'low', 'available', 'high'];

export const inputSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().optional().default(12),
  category: z.string().optional().default('all'),
  maxPrice: z.number().optional().default(99999),
  minPrice: z.number().optional().default(0),
  // Ya no es enum: acepta listas separadas por coma ("out,low")
  stockFilter: z.string().optional().default('all'),
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
    // Categorías: una o varias separadas por coma. Solo se aceptan las
    // de la lista válida; cualquier valor desconocido se descarta.
    const selectedCategories = category && category !== 'all'
      ? category.split(',').map(c => c.trim()).filter(c => validCategories.includes(c))
      : [];

    if (selectedCategories.length > 0) {
      filters.push(inArray(Product.category, selectedCategories));
    }
    
    // Filtro de precio mínimo
    if (minPrice > 0) {
      filters.push(sql`${Product.price} >= ${minPrice}`);
    }
    
    // Filtro de precio máximo
    if (maxPrice > 0 && maxPrice < 99999) {
      filters.push(lte(Product.price, maxPrice));
    }
    
    // Stock real. En productos con variantes el inventario vive en las
    // combinaciones (activas) o en las variantes, no en Product.stock, que se
    // desincroniza tras ventas en el POS. Antes el filtro y el conteo usaban
    // Product.stock y la card el stock real: se contaban productos que luego
    // la lista ocultaba por estar agotados ("16 resultados" / "15 productos").
    // Ahora filtro, conteo, paginación, orden y card usan este mismo valor.
    // SQL escrito a mano con alias: Drizzle deja las columnas sin el nombre de
    // la tabla dentro del SELECT, y en la subconsulta "productId = id" terminaba
    // comparando la tabla de combinaciones consigo misma (stock = 0).
    const effectiveStock = sql<number>`${sql.raw(`(CASE
      WHEN "Product"."hasVariants" = 1 THEN (CASE
        WHEN EXISTS (SELECT 1 FROM "ProductVariantCombination" pvc WHERE pvc."productId" = "Product"."id")
          THEN (SELECT COALESCE(SUM(pvc."stock"), 0) FROM "ProductVariantCombination" pvc
                WHERE pvc."productId" = "Product"."id" AND pvc."isActive" = 1)
        WHEN EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = "Product"."id")
          THEN (SELECT COALESCE(SUM(pv."stock"), 0) FROM "ProductVariant" pv
                WHERE pv."productId" = "Product"."id")
        ELSE 0 END)
      ELSE COALESCE("Product"."stock", 0) END)`)}`;

     // Stock: uno o varios rangos, unidos con OR.
    // "out,low" = agotados O con 1–5 piezas.
    const stockConds: Record<string, any> = {
      inStock:   sql`${effectiveStock} > 0`,
      out:       sql`${effectiveStock} <= 0`,                            // incluye negativos del POS
      low:       sql`(${effectiveStock} > 0 AND ${effectiveStock} <= 5)`,
      available: sql`(${effectiveStock} > 5 AND ${effectiveStock} <= 20)`,
      high:      sql`${effectiveStock} > 20`,
    };

    const pickedStock = stockFilter && stockFilter !== 'all'
      ? stockFilter.split(',').map(s => s.trim()).filter(s => validStockFilters.includes(s))
      : [];

    if (pickedStock.length === 1) {
      filters.push(stockConds[pickedStock[0]]);
    } else if (pickedStock.length > 1) {
      filters.push(or(...pickedStock.map(s => stockConds[s])));
    }
    
       // Perforaciones: una o varias, unidas con OR.
    // Va con LIKE porque piercing_name guarda una lista separada por comas.
    const selectedPiercings = piercing && piercing !== 'all'
      ? piercing.split(',').map(p => p.trim()).filter(p => validPiercings.includes(p))
      : [];

    if (selectedPiercings.length === 1) {
      filters.push(sql`${Product.piercing_name} LIKE ${'%' + selectedPiercings[0] + '%'}`);
    } else if (selectedPiercings.length > 1) {
      filters.push(or(...selectedPiercings.map(p => sql`${Product.piercing_name} LIKE ${'%' + p + '%'}`)));
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
        case 'stock': return effectiveStock;
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
        stock: effectiveStock.mapWith(Number),
        piercing_name: Product.piercing_name,
        cost: Product.cost,
        coverImageId: Product.coverImageId,
        user: Product.user,
        hasVariants: Product.hasVariants,
        allowsEngraving: Product.allowsEngraving,
      })
      .from(Product)
      // Desempate por id: con nombres repetidos ("Piercing acero" ×7) el orden
      // entre páginas no estaba garantizado y podía repetir o saltar productos
      .orderBy(orderFn(sortColumn), asc(Product.id))
      .limit(limit)
      .offset((page - 1) * limit);
    
    if (filters.length > 0) {
      baseProductsQuery.where(and(...filters));
    }
    
    // `stock` ya viene como stock real (effectiveStock), igual que el filtro
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

      if (stock <= 0) {
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
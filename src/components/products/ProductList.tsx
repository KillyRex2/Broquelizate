// src/components/ProductList.tsx
import type { ProductWithImages } from "@/interfaces"
import { ProductCard } from "./ProductCard";

interface Props {
    products: ProductWithImages[];
}

export const ProductList = ({ products }: Props) => {
  // Filtrar productos con stock > 0
  const inStockProducts = products.filter(p => p.stock > 0);

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-8 px-4 items-stretch">
      {inStockProducts.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
      
      {inStockProducts.length === 0 && (
        <div className="col-span-full text-center py-12">
          <h3 className="text-xl font-semibold text-gray-200">
            No hay productos disponibles en este momento
          </h3>
          <p className="text-gray-500 mt-2">
            Pronto tendremos nuevos productos en stock
          </p>
        </div>
      )}
    </div>
  );
};
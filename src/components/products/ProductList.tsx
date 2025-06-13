import type { ProductWithImages } from "@/interfaces"
import { ProductCard } from "./ProductCard";

interface Props {
    products: ProductWithImages[];
}

export const ProductList = ({ products }: Props) => {
  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-8 px-4">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
    </div>
  );
};



// src/components/products/ProductCard.tsx
import type { ProductWithImages } from "@/interfaces";
import { useState } from "react";

interface Props {
  product: ProductWithImages;
}

export const ProductCard = ({ product }: Props) => {
  // Convertir images a array si es necesario y construir URLs completas
  const images = (Array.isArray(product.images) 
    ? product.images 
    : [product.images]
  ).map(img => 
    img.startsWith("http") || img.startsWith("/")
      ? img
      : `${import.meta.env.PUBLIC_URL || ''}/images/products/${img}`
  );

  const [currentImage, setCurrentImage] = useState(images[0]);

  return (
    <a href={`/products/${product.slug}`} className="block">
      <div className="w-full p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
        <img
          src={currentImage}
          alt={product.name}
          className="w-full h-40 object-cover rounded-t-lg"
          onMouseEnter={() => {
            if (images.length > 1) setCurrentImage(images[1])
          }}
          onMouseLeave={() => setCurrentImage(images[0])}
        />
        <div className="p-4">
          <h4 className="text-lg font-semibold text-black line-clamp-1">
            {product.name}
          </h4>
          <span className="text-sm font-medium text-yellow-500 block mb-2">
            {product.category}
          </span>
          <p className="text-lg font-bold text-gray-800">${product.price.toFixed(2)}</p>

          <div className="flex justify-end mt-4">
            <a 
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors"
              href={`/products/${product.slug}`}
            >
              Ver más
            </a>
          </div>
        </div>
      </div>
    </a>
  );
};

export default ProductCard;
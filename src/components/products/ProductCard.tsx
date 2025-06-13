// src/components/products/ProductCard.tsx
import type { ProductWithImages } from "@/interfaces";
import { useState } from "react";

interface Props {
  product: ProductWithImages;
}

export const ProductCard = ({ product }: Props) => {
  // Parse image URLs
  const images = product.images.split(",").map((img) =>
    img.startsWith("http")
      ? img
      : `${import.meta.env.PUBLIC_URL}/images/products/${img}`
  );

  const [currentImage, setCurrentImage] = useState(images[0]);

  return (
    <a href={`/products/${product.slug}`} className="block">
      <div className="w-full p-2 bg-white rounded-lg shadow-md">
        <img
          src={currentImage}
          alt={product.name}
          className="w-full h-40 object-cover rounded-t-lg"
          onMouseEnter={() => setCurrentImage(images[1] ?? images[0])}
          onMouseLeave={() => setCurrentImage(images[0])}
        />
        <div className="p-4">
          <h4 className="text-xl font-semibold text-black">
            {product.name}
          </h4>
          {/* Aquí, usamos span en lugar de un <a> para no anidar enlaces */}
          <span className="text-lg font-semibold text-yellow-500 block mb-2">
            {product.category}
          </span>
          <p className="text-gray-600">${product.price}</p>

          <div className="flex justify-end mt-4">
            <button className="bg-yellow-500 hover:bg-yellow-800 text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400">
              Ver más
            </button>
          </div>
        </div>
      </div>
    </a>
  );
};

export default ProductCard;

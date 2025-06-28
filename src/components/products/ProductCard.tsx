// src/components/products/ProductCard.tsx
import type { ProductWithImages } from "@/interfaces";
import { useState, useEffect } from "react";

interface Props {
  product: ProductWithImages;
}

export const ProductCard = ({ product }: Props) => {
  const [images, setImages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState("");
  
  useEffect(() => {
    const processedImages = (Array.isArray(product.images) 
      ? product.images 
      : [product.images]
    ).map(img => 
      img.startsWith("http") || img.startsWith("/")
        ? img
        : `${import.meta.env.PUBLIC_URL || ''}/images/products/${img}`
    );
    
    setImages(processedImages);
    setCurrentImage(processedImages[0] || "");
  }, [product.images]);

  if (!currentImage) return null;

  return (
    <div className="h-full flex flex-col p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      {/* Contenedor de imagen con enlace */}
      <a href={`/products/${product.slug}`} className="block">
        <div className="w-full h-40 overflow-hidden rounded-t-lg"> 
          <img
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover"
            onMouseEnter={() => {
              if (images.length > 1) setCurrentImage(images[1])
            }}
            onMouseLeave={() => setCurrentImage(images[0])}
          />
        </div>
      </a>
      
      {/* Contenido sin enlace externo */}
      <div className="flex-grow p-4 flex flex-col">
        <a href={`/products/${product.slug}`} className="block">
          <h4 className="text-lg font-semibold text-black line-clamp-1">
            {product.name}
          </h4>
        </a>
        
        <span className="text-sm font-medium text-yellow-500 block mb-2 min-h-[1.5rem]">
          {product.category}
        </span>
        
        <p className="text-lg font-bold text-gray-800 mb-4">
          ${product.price.toFixed(2)}
        </p>

        <div className="mt-auto">
          {product.stock > 0 ? (
            <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mb-2">
              En stock
            </span>
          ) : (
            <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mb-2">
              Agotado
            </span>
          )}
          
          {/* Botón como enlace independiente */}
          <a 
            className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors"
            href={`/products/${product.slug}`}
          >
            Ver más
          </a>
        </div>
      </div>
    </div>
  );
};
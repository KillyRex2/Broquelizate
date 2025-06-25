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
    <a href={`/products/${product.slug}`} className="block h-full"> {/* Añadido h-full */}
      <div className="h-full flex flex-col p-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"> {/* Flex y altura completa */}
        {/* Contenedor de imagen con altura fija */}
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
        
        {/* Contenedor de contenido flexible */}
        <div className="flex-grow p-4 flex flex-col"> {/* Flex-grow para ocupar espacio restante */}
          <h4 className="text-lg font-semibold text-black line-clamp-1">
            {product.name}
          </h4>
          
          {/* Altura mínima para categoría */}
          <span className="text-sm font-medium text-yellow-500 block mb-2 min-h-[1.5rem]">
            {product.category}
          </span>
          
          <p className="text-lg font-bold text-gray-800 mb-4"> {/* Añadido margen inferior */}
            ${product.price.toFixed(2)}
          </p>

          {/* Botón anclado al fondo */}
          <div className="mt-auto"> {/* mt-auto para empujar al final */}
            <a 
              className="inline-block bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-full transition-colors"
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
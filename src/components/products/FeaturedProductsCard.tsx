// src/components/FeaturedProductsCard.tsx
import React, { useState, useEffect } from 'react';

export interface Props {
  id: string;
  image: string;
  title: string;
  description: string;
  price: number;
  salePrice?: number;
  onAddLink: string;
}

const FeaturedProductsCard: React.FC<Props> = ({ id, image, title, description, price, salePrice, onAddLink }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('favorites') || '[]');
    setIsFavorite(stored.includes(id));
  }, [id]);

  const toggleFavorite = () => {
    const stored = JSON.parse(localStorage.getItem('favorites') || '[]');
    let updated;
    if (isFavorite) {
      updated = stored.filter((f: string) => f !== id);
    } else {
      updated = [...stored, id];
    }
    localStorage.setItem('favorites', JSON.stringify(updated));
    setIsFavorite(!isFavorite);
  };

  return (
    <article className="relative group overflow-hidden rounded-lg bg-black text-white shadow-lg transition-transform transform hover:scale-105">
      <img
        src={image}
        alt={title}
        className="w-full h-56 object-cover transition-transform duration-300 group-hover:scale-110"
      />

      {/* Botón favorito */}
      <button
        className="absolute top-3 right-3 p-1 focus:outline-none"
        onClick={toggleFavorite}
      >
        {isFavorite ? (
        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24"><path fill="currentColor" d="m12 19.654l-.758-.685q-2.448-2.236-4.05-3.828q-1.601-1.593-2.528-2.81t-1.296-2.2T3 8.15q0-1.908 1.296-3.204T7.5 3.65q1.32 0 2.475.675T12 6.289Q12.87 5 14.025 4.325T16.5 3.65q1.908 0 3.204 1.296T21 8.15q0 .996-.368 1.98q-.369.986-1.296 2.202t-2.519 2.809q-1.592 1.592-4.06 3.828z"></path></svg>
        ) : ( 
         <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
          <path fill="currentColor" d="m12 19.654l-.758-.685q-2.448-2.236-4.05-3.828q-1.601-1.593-2.528-2.81t-1.296-2.2T3 8.15q0-1.908 1.296-3.204T7.5 3.65q1.32 0 2.475.675T12 6.289Q12.87 5 14.025 4.325T16.5 3.65q1.908 0 3.204 1.296T21 8.15q0 .996-.368 1.98q-.369.986-1.296 2.202t-2.519 2.809q-1.592 1.592-4.06 3.828zm0-1.354q2.4-2.17 3.95-3.716t2.45-2.685t1.25-2.015Q20 9.006 20 8.15q0-1.5-1-2.5t-2.5-1q-1.194 0-2.204.682T12.49 7.385h-.978q-.817-1.39-1.817-2.063q-1-.672-2.194-.672q-1.48 0-2.49 1T4 8.15q0 .856.35 1.734t1.25 2.015t2.45 2.675T12 18.3m0-6.825"></path>
          </svg>
        )}
      </button>

      {/* Etiqueta oferta */}
      {salePrice && (
        <span className="absolute top-3 left-3 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded">
          OFERTA
        </span>
      )}

      <div className="p-4 space-y-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-gray-300 line-clamp-2">{description}</p>
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold text-white">
            {salePrice ? (
              <>
                <span>${salePrice}</span>
                <span className="text-sm line-through text-gray-500 ml-2">${price}</span>
              </>
            ) : (
              <span>${price}</span>
            )}
          </div>
          <a
            href={onAddLink}
            className="inline-flex items-center px-4 py-2 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-600 transition"
          >
            Ver más
          </a>
        </div>
      </div>
    </article>
  );
};

export default FeaturedProductsCard;

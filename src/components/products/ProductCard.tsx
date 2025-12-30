// src/components/products/ProductCard.tsx
import type { ProductWithImages } from "@/interfaces";
import { useState, useEffect } from "react";
import { FaEye, FaShoppingCart, FaCheck, FaTimes } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";

// Extender la interfaz para propiedades opcionales adicionales
interface ExtendedProduct extends ProductWithImages {
  originalPrice?: number;
  isNew?: boolean;
  createdAt?: string | Date;
}

interface Props {
  product: ExtendedProduct;
  index?: number;
}

export const ProductCard = ({ product, index = 0 }: Props) => {
  const [images, setImages] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const processedImages = (
      Array.isArray(product.images) ? product.images : [product.images]
    ).map((img) =>
      img.startsWith("http") || img.startsWith("/")
        ? img
        : `${import.meta.env.PUBLIC_URL || ""}/images/products/${img}`
    );

    setImages(processedImages);
    setCurrentImage(processedImages[0] || "");
  }, [product.images]);

  if (!currentImage) return null;

  const isInStock = product.stock > 0;
  
  // Verificar descuento de forma segura
  const hasDiscount = 
    typeof product.originalPrice === 'number' && 
    product.originalPrice > product.price;
  
  const discountPercent = hasDiscount && product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <article
      className="product-card"
      style={{ "--index": index } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <a 
        href={`/products/${product.slug}`} 
        className="image-container"
        data-astro-prefetch="hover"
      >
        {/* Skeleton loader */}
        {!imageLoaded && <div className="image-skeleton" />}
        
        <img
          src={currentImage}
          alt={product.name}
          className={`product-image ${imageLoaded ? "loaded" : ""}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onMouseEnter={() => images.length > 1 && setCurrentImage(images[1])}
          onMouseLeave={() => setCurrentImage(images[0])}
        />

        {/* Hover overlay */}
        <div className={`image-overlay ${isHovered ? "visible" : ""}`}>
          <span className="quick-view">
            <FaEye />
            <span>Ver detalles</span>
          </span>
        </div>

        {/* Badges */}
        <div className="badges">
          {hasDiscount && (
            <span className="badge badge-discount">
              <HiSparkles />
              -{discountPercent}%
            </span>
          )}
          {!isInStock && (
            <span className="badge badge-soldout">Agotado</span>
          )}
          {product.isNew && (
            <span className="badge badge-new">Nuevo</span>
          )}
        </div>

        {/* Image indicator dots */}
        {images.length > 1 && (
          <div className="image-dots">
            {images.slice(0, 4).map((img, i) => (
              <span
                key={i}
                className={`dot ${currentImage === img ? "active" : ""}`}
              />
            ))}
          </div>
        )}
      </a>

      {/* Card Content */}
      <div className="card-content">
        {/* Category tag */}
        <span className="product-category">{product.category}</span>

        {/* Product name */}
        <a 
          href={`/products/${product.slug}`} 
          className="product-name-link"
          data-astro-prefetch="hover"
        >
          <h3 className="product-name">{product.name}</h3>
        </a>

        {/* Price section */}
        <div className="price-row">
          <div className="price-container">
            <span className="current-price">${product.price.toFixed(2)}</span>
            {hasDiscount && product.originalPrice && (
              <span className="original-price">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          
          {/* Stock status */}
          <span className={`stock-badge ${isInStock ? "in-stock" : "out-stock"}`}>
            {isInStock ? (
              <>
                <FaCheck />
                <span>Stock: {product.stock}</span>
              </>
            ) : (
              <>
                <FaTimes />
                <span>Agotado</span>
              </>
            )}
          </span>
        </div>

        {/* Action buttons */}
        <div className="actions">
          <a
            href={`/products/${product.slug}`}
            className="btn-primary"
            data-astro-prefetch="hover"
          >
            <FaEye />
            <span>Ver más</span>
          </a>
          {isInStock && (
            <button className="btn-cart" aria-label="Añadir al carrito">
              <FaShoppingCart />
            </button>
          )}
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="card-glow" />

      <style>{`
        .product-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: #fff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
          border: 1px solid rgba(0, 0, 0, 0.05);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          animation: cardFadeIn 0.6s ease-out calc(var(--index) * 0.08s) both;
        }

        .product-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.12);
          border-color: rgba(234, 179, 8, 0.3);
        }

        @keyframes cardFadeIn {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Image Container */
        .image-container {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
          background: linear-gradient(135deg, #f8f8f8 0%, #f0f0f0 100%);
        }

        .image-skeleton {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e8e8e8 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
          opacity: 0;
        }

        .product-image.loaded {
          opacity: 1;
        }

        .product-card:hover .product-image {
          transform: scale(1.1);
        }

        .image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.7) 0%,
            rgba(0, 0, 0, 0.3) 50%,
            transparent 100%
          );
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.4s ease;
        }

        .image-overlay.visible {
          opacity: 1;
        }

        .quick-view {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          background: #fff;
          border-radius: 50px;
          color: #111;
          font-size: 0.9rem;
          font-weight: 700;
          transform: translateY(20px);
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .image-overlay.visible .quick-view {
          transform: translateY(0);
          opacity: 1;
        }

        /* Badges */
        .badges {
          position: absolute;
          top: 14px;
          left: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 3;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .badge-discount {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
        }

        .badge-soldout {
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
        }

        .badge-new {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff;
        }

        /* Image dots */
        .image-dots {
          position: absolute;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 3;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          transition: all 0.3s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .dot.active {
          width: 24px;
          border-radius: 4px;
          background: #fff;
        }

        /* Card Content */
        .card-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-grow: 1;
        }

        .product-category {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          padding: 6px 12px;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(245, 158, 11, 0.05));
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 8px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #b45309;
        }

        .product-name-link {
          text-decoration: none;
        }

        .product-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: #111;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          transition: color 0.25s ease;
          letter-spacing: -0.02em;
        }

        .product-name-link:hover .product-name {
          color: #b45309;
        }

        /* Price row */
        .price-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 12px;
        }

        .price-container {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }

        .current-price {
          font-size: 1.5rem;
          font-weight: 900;
          color: #111;
          letter-spacing: -0.02em;
        }

        .original-price {
          font-size: 1rem;
          color: #aaa;
          text-decoration: line-through;
        }

        .stock-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 0.75rem;
          font-weight: 700;
          border-radius: 8px;
        }

        .stock-badge.in-stock {
          background: rgba(34, 197, 94, 0.1);
          color: #16a34a;
        }

        .stock-badge.out-stock {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        }

        /* Actions */
        .actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn-primary {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          background: linear-gradient(135deg, #111 0%, #222 100%);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #eab308 0%, #f59e0b 100%);
          color: #000;
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(234, 179, 8, 0.35);
        }

        .btn-cart {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          background: rgba(234, 179, 8, 0.1);
          border: 2px solid rgba(234, 179, 8, 0.2);
          border-radius: 14px;
          color: #b45309;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-cart:hover {
          background: #eab308;
          border-color: #eab308;
          color: #000;
          transform: scale(1.05);
        }

        /* Glow effect */
        .card-glow {
          position: absolute;
          inset: 0;
          border-radius: 24px;
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
          box-shadow: inset 0 0 0 2px rgba(234, 179, 8, 0.4);
        }

        .product-card:hover .card-glow {
          opacity: 1;
        }

        @media (max-width: 768px) {
          .card-content {
            padding: 20px;
          }

          .product-name {
            font-size: 1rem;
          }

          .current-price {
            font-size: 1.3rem;
          }

          .actions {
            flex-direction: column;
          }

          .btn-cart {
            width: 100%;
            height: auto;
            padding: 14px;
          }
        }
      `}</style>
    </article>
  );
};
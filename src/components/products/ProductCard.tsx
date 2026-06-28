// src/components/products/ProductCard.tsx
import type { ProductWithImages } from "@/interfaces";
import { CartCookiesClient } from "@/utils/cart-cookies";
import { itemsInCart } from "@/store/cart.store";
import { useState, useEffect, useCallback } from "react";
import { FaEye, FaShoppingCart, FaCheck, FaTimes } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import "./ProductCard.css";

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
  const [addedToCart, setAddedToCart] = useState(false);

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

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Si tiene variantes, redirigir al detalle para elegir
      if (product.hasVariants) {
        window.location.href = `/products/${product.slug}`;
        return;
      }

      // Producto simple: agregar directo al carrito
      CartCookiesClient.addItem({
        productId: product.id,
        quantity: 1,
      });

      // Actualizar el counter del navbar
      itemsInCart.set(CartCookiesClient.getTotalItems());

      // Feedback visual
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    },
    [product.id, product.slug, product.hasVariants]
  );

  if (!currentImage) return null;

  const isInStock = product.stock > 0;

  // Verificar descuento de forma segura
  const hasDiscount =
    typeof product.originalPrice === "number" &&
    product.originalPrice > product.price;

  const discountPercent =
    hasDiscount && product.originalPrice
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) * 100
        )
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
            <button
              className={`btn-cart ${addedToCart ? "added" : ""}`}
              aria-label={
                product.hasVariants
                  ? "Seleccionar variante"
                  : "Añadir al carrito"
              }
              title={
                product.hasVariants
                  ? "Elige tu variante"
                  : "Añadir al carrito"
              }
              onClick={handleAddToCart}
            >
              {addedToCart ? <FaCheck /> : <FaShoppingCart />}
            </button>
          )}
        </div>
      </div>

      {/* Toast de confirmación */}
      {addedToCart && (
        <div className="cart-toast">
          <FaCheck />
          <span>Agregado al carrito</span>
        </div>
      )}

      {/* Hover glow effect */}
      <div className="card-glow" />
    </article>
  );
};

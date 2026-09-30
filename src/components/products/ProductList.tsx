// src/components/products/ProductList.tsx
import type { ProductWithImages } from "@/interfaces";
import { ProductCard } from "./ProductCard";
import { useState } from "react";
import { FaTh, FaList, FaSort, FaBox } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import { IoReloadOutline } from "react-icons/io5";

// Extender la interfaz para propiedades opcionales
interface ExtendedProduct extends ProductWithImages {
  originalPrice?: number;
  isNew?: boolean;
  createdAt?: string | Date;
}

interface Props {
  products: ExtendedProduct[];
  showOutOfStock?: boolean;
}

type SortOption = "default" | "price-asc" | "price-desc" | "name" | "newest";

export const ProductList = ({ products, showOutOfStock = false }: Props) => {
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter products
  const filteredProducts = showOutOfStock
    ? products
    : products.filter((p) => p.stock > 0);

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "name":
        return a.name.localeCompare(b.name);
      case "newest":
        // Manejar createdAt de forma segura
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      default:
        return 0;
    }
  });

  return (
    <div className="product-list-wrapper">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="results-badge">
            <HiSparkles className="badge-icon" />
            <span className="results-count">{sortedProducts.length}</span>
            <span className="results-text">
              {sortedProducts.length === 1 ? "producto" : "productos"}
            </span>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Sort Dropdown */}
          <div className="sort-wrapper">
            <FaSort className="sort-icon" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="sort-select"
            >
              <option value="default">Relevancia</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="name">Nombre A-Z</option>
              <option value="newest">Más recientes</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="view-toggle">
            <button
              onClick={() => setViewMode("grid")}
              className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
              aria-label="Vista cuadrícula"
            >
              <FaTh />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`view-btn ${viewMode === "list" ? "active" : ""}`}
              aria-label="Vista lista"
            >
              <FaList />
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {sortedProducts.length > 0 ? (
        <div className={`products-grid view-${viewMode}`}>
          {sortedProducts.map((product, index) => (
            <ProductCard key={product.slug} product={product} index={index} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <FaBox />
          </div>
          <h3 className="empty-title">No encontramos productos</h3>
          <p className="empty-description">
            No hay productos que coincidan con los filtros seleccionados.
            <br />
            Intenta ajustar tu búsqueda o limpiar los filtros.
          </p>
          <a href="/products" className="empty-btn">
            <IoReloadOutline />
            <span>Limpiar filtros</span>
          </a>
        </div>
      )}

      <style>{`
        .product-list-wrapper {
          width: 100%;
        }

        /* Toolbar */
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          margin-bottom: 32px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .toolbar-left {
          display: flex;
          align-items: center;
        }

        .results-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 18px;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.1), rgba(245, 158, 11, 0.05));
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 12px;
        }

        .badge-icon {
          color: #eab308;
          font-size: 1rem;
        }

        .results-count {
          font-size: 1.5rem;
          font-weight: 900;
          color: #111;
          letter-spacing: -0.02em;
        }

        .results-text {
          font-size: 0.9rem;
          color: #666;
          font-weight: 500;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Sort */
        .sort-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .sort-icon {
          position: absolute;
          left: 16px;
          color: #888;
          font-size: 0.85rem;
          pointer-events: none;
          z-index: 1;
        }

        .sort-select {
          appearance: none;
          padding: 14px 44px 14px 42px;
          background: #f8f8f8;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 14px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #333;
          cursor: pointer;
          transition: all 0.25s ease;
          min-width: 200px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 16px center;
        }

        .sort-select:hover {
          border-color: rgba(0, 0, 0, 0.15);
          background-color: #f4f4f4;
        }

        .sort-select:focus {
          outline: none;
          border-color: #eab308;
          box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.12);
        }

        /* View Toggle */
        .view-toggle {
          display: flex;
          background: #f4f4f4;
          border-radius: 14px;
          padding: 6px;
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .view-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #999;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .view-btn:hover {
          color: #666;
        }

        .view-btn.active {
          background: #fff;
          color: #111;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        /* Products Grid */
        .products-grid {
          display: grid;
          gap: 28px;
        }

        .products-grid.view-grid {
          grid-template-columns: repeat(1, 1fr);
        }

        @media (min-width: 640px) {
          .products-grid.view-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .products-grid.view-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .products-grid.view-list {
          grid-template-columns: 1fr;
          gap: 20px;
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 100px 32px;
          background: #fff;
          border-radius: 28px;
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
        }

        .empty-icon {
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(245, 158, 11, 0.08));
          border-radius: 50%;
          color: #b45309;
          font-size: 2.5rem;
          margin-bottom: 28px;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .empty-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #111;
          margin-bottom: 16px;
          letter-spacing: -0.02em;
        }

        .empty-description {
          font-size: 1.05rem;
          color: #666;
          line-height: 1.7;
          max-width: 420px;
          margin-bottom: 36px;
        }

        .empty-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 32px;
          background: linear-gradient(135deg, #111 0%, #222 100%);
          border-radius: 16px;
          color: #fff;
          font-size: 1rem;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .empty-btn:hover {
          background: linear-gradient(135deg, #eab308 0%, #f59e0b 100%);
          color: #000;
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(234, 179, 8, 0.35);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .toolbar {
            flex-direction: column;
            gap: 20px;
            padding: 20px;
          }

          .toolbar-left,
          .toolbar-right {
            width: 100%;
            justify-content: center;
          }

          .sort-select {
            min-width: 160px;
            padding-left: 38px;
            padding-right: 38px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
};
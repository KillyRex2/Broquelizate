// src/components/products/FilterSidebar.tsx
import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { FaGem, FaRegCircle, FaSearch, FaUndo } from "react-icons/fa";
import { AiFillGold } from "react-icons/ai";
import { BsEar, BsEarFill, BsThreeDots} from "react-icons/bs";
import { GiPlasticDuck, GiNoseFront, GiPearlEarring } from "react-icons/gi";
import { MdTitle, MdFilterList } from "react-icons/md";
import { FaRegRegistered, FaA, FaEarDeaf, FaEarListen } from "react-icons/fa6";
import { TbPointFilled } from "react-icons/tb";
import { IoChevronDown } from "react-icons/io5";
import { HiSparkles } from "react-icons/hi2";
import { navigate } from "astro:transitions/client";

// --- Interfaces ---
interface FilterSidebarProps {
  initialValues?: {
    selectedCat?: string;
    price?: number;
    inStock?: boolean;
    search?: string;
    piercing?: string;
  };
}

// --- Datos ---
const categories = [
  { label: "Todos", value: "all", icon: <FaGem /> },
  { label: "Titanio", value: "Titanio", icon: <MdTitle /> },
  { label: "Acero Quirúrgico", value: "Acero Quirúrgico", icon: <FaA /> },
  { label: "Oro 10k", value: "Oro 10k", icon: <AiFillGold /> },
  { label: "Oro 14k", value: "Oro 14k", icon: <AiFillGold /> },
  { label: "Oro 18k", value: "Oro 18k", icon: <AiFillGold /> },
  { label: "Chapa de Oro 14K", value: "Chapa de Oro 14K", icon: <AiFillGold /> },
  { label: "Chapa de Oro 18K", value: "Chapa de Oro 18K", icon: <AiFillGold /> },
  { label: "Acero Inoxidable", value: "Acero Inoxidable", icon: <FaA /> },
  { label: "Plástico", value: "Plástico", icon: <GiPlasticDuck /> },
  { label: "Plata", value: "Plata", icon: <FaRegCircle /> },
  { label: "Rodio", value: "Rodio", icon: <FaRegRegistered /> },
  { label: "Otros", value: "Otros", icon: <BsThreeDots /> },
];

const piercings = [
  { label: "Todos", value: "all", icon: <BsEar /> },
  { label: "Lóbulo", value: "Lóbulo", icon: <GiPearlEarring /> },
  { label: "Lóbulo Superior", value: "Lóbulo Superior", icon: <GiPearlEarring /> },
  { label: "Hélix", value: "Hélix", icon: <BsEar /> },
  { label: "Antihelix", value: "Antihelix", icon: <BsEar /> },
  { label: "Tragus", value: "Tragus", icon: <BsEar /> },
  { label: "Antitragus", value: "Antitragus", icon: <BsEarFill /> },
  { label: "Rook", value: "Rook", icon: <BsEarFill /> },
  { label: "Flat", value: "Flat", icon: <FaEarListen /> },
  { label: "Conch", value: "Conch", icon: <BsEarFill /> },
  { label: "Daith", value: "Daith", icon: <BsEarFill /> },
  { label: "Industrial", value: "Industrial", icon: <FaEarDeaf /> },
  { label: "Séptum", value: "Séptum", icon: <GiNoseFront /> },
  { label: "Nóstril", value: "Nóstril", icon: <GiNoseFront /> },
  { label: "Navel", value: "Navel", icon: <TbPointFilled /> },
];

// --- Accordion Component ---
const Accordion = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = true,
  count = 0
}: { 
  title: string; 
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion-section">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="accordion-header"
      >
        <div className="accordion-title">
          <span className="accordion-icon">{icon}</span>
          <span>{title}</span>
          {count > 0 && <span className="accordion-count">{count}</span>}
        </div>
        <IoChevronDown className={`accordion-chevron ${isOpen ? 'open' : ''}`} />
      </button>
      <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
        <div className="accordion-inner">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
export const FilterSidebar = ({ initialValues }: FilterSidebarProps) => {
  const getInitialState = () => ({
    category: initialValues?.selectedCat || "all",
    price: initialValues?.price || 5000,
    search: initialValues?.search || "",
    piercing: initialValues?.piercing || "all",
  });

  const [filters, setFilters] = useState(getInitialState());
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    setFilters(getInitialState());
  }, [initialValues]);

  const handleInputChange = (field: string, value: string | number) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    const defaultState = { category: "all", price: 5000, search: "", piercing: "all" };
    setFilters(defaultState);
    const queryParams = new URLSearchParams({ page: '1', ...defaultState, price: defaultState.price.toString() });
    navigate(`/products?${queryParams.toString()}`);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const queryParams = new URLSearchParams({
      page: '1',
      category: filters.category,
      maxPrice: filters.price.toString(),
      search: filters.search,
      piercing: filters.piercing,
    });
    navigate(`/products?${queryParams.toString()}`);
  };

  const activeFiltersCount = [
    filters.category !== 'all',
    filters.piercing !== 'all',
    filters.price < 5000,
    filters.search !== '',
  ].filter(Boolean).length;

  return (
    <aside className="filter-sidebar">
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="header-title">
            <div className="header-icon-wrapper">
              <MdFilterList className="header-icon" />
            </div>
            <h2>Filtros</h2>
            {activeFiltersCount > 0 && (
              <span className="active-badge">{activeFiltersCount}</span>
            )}
          </div>
          <button type="button" onClick={handleReset} className="reset-btn">
            <FaUndo />
            <span>Limpiar</span>
          </button>
        </div>

        {/* Search */}
        <div className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={filters.search}
            onChange={(e) => handleInputChange('search', e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="search-input"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => handleInputChange('search', '')}
              className="search-clear"
            >
              ×
            </button>
          )}
        </div>

        {/* Categories Accordion */}
        <Accordion 
          title="Material" 
          icon={<HiSparkles />}
          count={filters.category !== 'all' ? 1 : 0}
        >
          <div className="filter-grid">
            {categories.map(cat => (
              <label key={cat.value} className="filter-option">
                <input
                  type="radio"
                  name="category"
                  value={cat.value}
                  checked={filters.category === cat.value}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="sr-only"
                />
                <span className={`filter-chip ${filters.category === cat.value ? 'active' : ''}`}>
                  <span className="chip-icon">{cat.icon}</span>
                  <span className="chip-label">{cat.label}</span>
                </span>
              </label>
            ))}
          </div>
        </Accordion>

        {/* Piercings Accordion */}
        <Accordion 
          title="Tipo de Piercing" 
          icon={<BsEar />}
          count={filters.piercing !== 'all' ? 1 : 0}
        >
          <div className="filter-grid">
            {piercings.map(p => (
              <label key={p.value} className="filter-option">
                <input
                  type="radio"
                  name="piercing"
                  value={p.value}
                  checked={filters.piercing === p.value}
                  onChange={(e) => handleInputChange('piercing', e.target.value)}
                  className="sr-only"
                />
                <span className={`filter-chip ${filters.piercing === p.value ? 'active' : ''}`}>
                  <span className="chip-icon">{p.icon}</span>
                  <span className="chip-label">{p.label}</span>
                </span>
              </label>
            ))}
          </div>
        </Accordion>

        {/* Price Range */}
        <div className="price-section">
          <div className="price-header">
            <span className="price-label">Precio máximo</span>
            <span className="price-value">${filters.price.toLocaleString()}</span>
          </div>
          <div className="price-slider-wrapper">
            <input
              type="range"
              min={0}
              max={5000}
              step={100}
              value={filters.price}
              onChange={(e) => handleInputChange('price', Number(e.target.value))}
              className="price-slider"
            />
            <div 
              className="price-progress" 
              style={{ width: `${(filters.price / 5000) * 100}%` }}
            />
          </div>
          <div className="price-labels">
            <span>$0</span>
            <span>$5,000</span>
          </div>
        </div>

        {/* Submit Button */}
        <button type="submit" className="submit-btn">
          <span>Aplicar Filtros</span>
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
        </button>
      </form>

      <style>{`
        .filter-sidebar {
          background: linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 100%);
          border-radius: 24px;
          padding: 28px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        /* Header */
        .sidebar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon-wrapper {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(245, 158, 11, 0.1));
          border-radius: 14px;
          border: 1px solid rgba(234, 179, 8, 0.2);
        }

        .header-icon {
          font-size: 1.25rem;
          color: #eab308;
        }

        .header-title h2 {
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .active-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 8px;
          background: linear-gradient(135deg, #eab308, #f59e0b);
          color: #000;
          font-size: 0.75rem;
          font-weight: 800;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(234, 179, 8, 0.4);
        }

        .reset-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .reset-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        /* Search */
        .search-container {
          position: relative;
          margin-bottom: 28px;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.9rem;
          transition: all 0.25s ease;
        }

        .search-container.focused .search-icon {
          color: #eab308;
        }

        .search-input {
          width: 100%;
          padding: 16px 44px 16px 48px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: #fff;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.25s ease;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .search-input:focus {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(234, 179, 8, 0.5);
          box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.1);
        }

        .search-clear {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.5);
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .search-clear:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        /* Accordion */
        .accordion-section {
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .accordion-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 0;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
        }

        .accordion-title {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .accordion-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(234, 179, 8, 0.1);
          border-radius: 10px;
          color: #eab308;
          font-size: 1rem;
        }

        .accordion-count {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: #eab308;
          color: #000;
          font-size: 0.7rem;
          font-weight: 700;
          border-radius: 10px;
        }

        .accordion-chevron {
          color: rgba(255, 255, 255, 0.4);
          font-size: 1rem;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .accordion-chevron.open {
          transform: rotate(180deg);
        }

        .accordion-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .accordion-content.open {
          max-height: 600px;
        }

        .accordion-inner {
          padding-bottom: 20px;
        }

        /* Filter Grid */
        .filter-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .filter-option {
          cursor: pointer;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .filter-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #fff;
          transform: translateY(-2px);
        }

        .filter-chip.active {
          background: linear-gradient(135deg, #eab308, #f59e0b);
          border-color: transparent;
          color: #000;
          font-weight: 700;
          box-shadow: 0 4px 16px rgba(234, 179, 8, 0.35);
          transform: translateY(-2px);
        }

        .chip-icon {
          display: flex;
          align-items: center;
          font-size: 1rem;
        }

        .chip-label {
          white-space: nowrap;
        }

        /* Price Section */
        .price-section {
          padding: 24px 0;
        }

        .price-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .price-label {
          font-weight: 600;
          color: #fff;
          font-size: 0.95rem;
        }

        .price-value {
          font-size: 1.4rem;
          font-weight: 800;
          background: linear-gradient(135deg, #eab308, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .price-slider-wrapper {
          position: relative;
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .price-slider {
          position: absolute;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          z-index: 2;
        }

        .price-progress {
          position: absolute;
          height: 100%;
          background: linear-gradient(90deg, #eab308, #f59e0b);
          border-radius: 4px;
          transition: width 0.1s ease;
          box-shadow: 0 0 12px rgba(234, 179, 8, 0.4);
        }

        .price-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Submit Button */
        .submit-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 18px 28px;
          margin-top: 24px;
          background: linear-gradient(135deg, #eab308 0%, #f59e0b 100%);
          border: none;
          border-radius: 16px;
          color: #000;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(234, 179, 8, 0.35);
        }

        .submit-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 35px rgba(234, 179, 8, 0.45);
        }

        .submit-btn:active {
          transform: translateY(-1px);
        }

        .submit-btn svg {
          transition: transform 0.3s ease;
        }

        .submit-btn:hover svg {
          transform: translateX(4px);
        }

        @media (max-width: 768px) {
          .filter-sidebar {
            padding: 24px 20px;
            border-radius: 20px;
          }

          .filter-chip {
            padding: 8px 12px;
            font-size: 0.8rem;
          }

          .submit-btn {
            padding: 16px 24px;
          }
        }
      `}</style>
    </aside>
  );
};
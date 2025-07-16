import { useState, useEffect, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { FaGem, FaRegCircle, FaSearch, FaUndo } from "react-icons/fa";
import { AiFillGold } from "react-icons/ai";
import { BsEar, BsEarFill } from "react-icons/bs";
import { GiPlasticDuck, GiNoseFront, GiPearlEarring } from "react-icons/gi";
import { MdTitle } from "react-icons/md";
import { FaRegRegistered, FaA, FaEarDeaf, FaEarListen } from "react-icons/fa6";
import { TbPointFilled } from "react-icons/tb";
import { IoChevronDown } from "react-icons/io5";
import { navigate } from "astro:transitions/client";

// --- Interfaces y Datos ---
interface FilterSidebarProps {
  initialValues?: {
    selectedCat?: string;
    price?: number;
    inStock?: boolean;
    search?: string;
    piercing?: string;
  };
}

// ✅ Lista de categorías completa
const categories = [
  { label: "Todos los productos", value: "all", icon: <FaGem /> },
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
];

// ✅ Lista de perforaciones completa
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

// --- Componente de Acordeón Reutilizable ---
const Accordion = ({ title, children }: { title: string, children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true); // Abierto por defecto

  return (
    <div className="border-b border-gray-700">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-3 text-left font-semibold text-white"
      >
        <span>{title}</span>
        <IoChevronDown className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] py-2' : 'max-h-0'}`}>
        {children}
      </div>
    </div>
  );
};


// --- Componente Principal FilterSidebar ---
export const FilterSidebar = ({ initialValues }: FilterSidebarProps) => {
  const getInitialState = () => ({
    category: initialValues?.selectedCat || "all",
    price: initialValues?.price || 5000,
    search: initialValues?.search || "",
    piercing: initialValues?.piercing || "all",
  });

  const [filters, setFilters] = useState(getInitialState());

  // Sincronizar estado si los valores iniciales cambian (al navegar atrás/adelante)
  useEffect(() => {
    setFilters(getInitialState());
  }, [initialValues]);

  const handleInputChange = (field: string, value: string | number) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };
  
  const handleReset = () => {
    const defaultState = { category: "all", price: 5000, search: "", piercing: "all" };
    setFilters(defaultState);
    // Navegar para limpiar los parámetros de la URL
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

  return (
    // Se elimina el ancho fijo para que se adapte al contenedor padre
    <aside className="p-4 bg-gray-900 text-gray-300 h-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Encabezado y Botón de Limpiar */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Filtros</h2>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition"
            title="Limpiar filtros"
          >
            <FaUndo />
            <span>Limpiar</span>
          </button>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={filters.search}
            onChange={(e) => handleInputChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border-gray-700 bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Acordeón de Categorías */}
        <Accordion title="Categorías">
          <div className="space-y-2">
            {categories.map(cat => (
              <label key={cat.value} className="filter-label">
                <input
                  type="radio"
                  name="category"
                  value={cat.value}
                  checked={filters.category === cat.value}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="sr-only" // Oculta el radio button real
                />
                <span className={`filter-tag ${filters.category === cat.value ? 'filter-tag-active' : ''}`}>
                  {cat.icon} {cat.label}
                </span>
              </label>
            ))}
          </div>
        </Accordion>

        {/* Acordeón de Perforaciones */}
        <Accordion title="Perforaciones">
          <div className="space-y-2">
            {piercings.map(p => (
              <label key={p.value} className="filter-label">
                <input
                  type="radio"
                  name="piercing"
                  value={p.value}
                  checked={filters.piercing === p.value}
                  onChange={(e) => handleInputChange('piercing', e.target.value)}
                  className="sr-only"
                />
                <span className={`filter-tag ${filters.piercing === p.value ? 'filter-tag-active' : ''}`}>
                  {p.icon} {p.label}
                </span>
              </label>
            ))}
          </div>
        </Accordion>

        {/* Filtro de Precio */}
        <div className="pt-2">
          <label htmlFor="price-range" className="font-semibold text-white">
            Precio Máximo: <span className="font-bold text-blue-400">${filters.price.toLocaleString()}</span>
          </label>
          <input
            id="price-range"
            type="range"
            min={0}
            max={5000}
            step={100}
            value={filters.price}
            onChange={(e) => handleInputChange('price', Number(e.target.value))}
            className="w-full mt-3 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$0</span>
            <span>$5,000</span>
          </div>
        </div>

        {/* Botón de Aplicar Filtros */}
        <button
          type="submit"
          className="w-full bg-yellow-600 py-2.5 rounded-lg font-semibold text-white hover:bg-yellow-700 transition-all duration-200 shadow-lg hover:shadow-yellow-500/50"
        >
          Aplicar Filtros
        </button>
      </form>

      {/* Estilos para los tags de filtros */}
      <style>{`
        .filter-label {
          display: block;
          cursor: pointer;
        }
        .filter-tag {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          background-color: #374151; /* bg-gray-700 */
          color: #d1d5db; /* text-gray-300 */
          transition: all 0.2s ease-in-out;
          border: 1px solid transparent;
        }
        .filter-label:hover .filter-tag {
          background-color: #4b5563; /* bg-gray-600 */
          color: #ffffff;
        }
        .filter-tag-active {
          background-color:rgb(241, 198, 4); /* bg-blue-600 */
          color: #ffffff;
          font-weight: 600;
          border-color:rgb(240, 250, 96); /* border-blue-400 */
        }
      `}</style>
    </aside>
  );
};

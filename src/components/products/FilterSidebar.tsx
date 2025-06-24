import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { FaGem, FaRegCircle } from "react-icons/fa";
import { AiFillGold } from "react-icons/ai";
import { GiPlasticDuck } from "react-icons/gi";
import { MdTitle } from "react-icons/md";
import { FaRegRegistered, FaA } from "react-icons/fa6";
import { navigate } from "astro:transitions/client"; // Importar navigate

interface FilterValues {
  category: string;
  maxPrice: number;
  inStock: boolean;
}

interface FilterSidebarProps {
  initialValues?: {
    selectedCat?: string;
    price?: number;
    inStock?: boolean;
  };
}

const categories = [
  { label: "Todos los productos", value: "all", icon: <FaGem className="inline mr-2" /> },
  { label: "Titanio", value: "Titanio", icon: <MdTitle className="inline mr-2" /> },
  { label: "Acero Quirúrgico", value: "Acero Quirúrgico", icon: <FaA className="inline mr-2" /> },
  { label: "Oro 10k", value: "Oro 10k", icon: <AiFillGold className="inline mr-2" /> },
  { label: "Oro 14k", value: "Oro 14k", icon: <AiFillGold className="inline mr-2" /> },
  { label: "Oro 18k", value: "Oro 18k", icon: <AiFillGold className="inline mr-2" /> },
  { label: "Chapa de Oro 14K", value: "Chapa de Oro 14K", icon: <AiFillGold className="inline mr-2" /> },
  { label: "Chapa de Oro 18K", value: "Chapa de Oro 18K", icon: <AiFillGold className="inline mr-2" /> },
  { label: "Acero Inoxidable", value: "Acero Inoxidable", icon: <FaA className="inline mr-2" /> },
  { label: "Plástico", value: "Plástico", icon: <GiPlasticDuck className="inline mr-2" /> },
  { label: "Plata", value: "Plata", icon: <FaRegCircle className="inline mr-2" /> },
  { label: "Rodio", value: "Rodio", icon: <FaRegRegistered className="inline mr-2" /> },
];

export const FilterSidebar = ({
  initialValues
}: FilterSidebarProps) => {
  // Inicializar estado con valores iniciales
  const [selectedCat, setSelectedCat] = useState<string>(initialValues?.selectedCat || "all");
  const [price, setPrice] = useState<number>(initialValues?.price || 5000);
  const [inStock, setInStock] = useState<boolean>(initialValues?.inStock || false);

  // Actualizar estado cuando cambian los valores iniciales
  useEffect(() => {
    if (initialValues) {
      setSelectedCat(initialValues.selectedCat || "all");
      setPrice(initialValues.price || 5000);
      setInStock(initialValues.inStock || false);
    }
  }, [initialValues]);

  const onCategoryChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSelectedCat(e.target.value);

  const onPriceChange = (e: ChangeEvent<HTMLInputElement>) =>
    setPrice(Number(e.target.value));

  const onInStockChange = () => setInStock(prev => !prev);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const newFilters = {
      category: selectedCat,
      maxPrice: price,
      inStock: inStock
    };

    // Construir parámetros de consulta
    const queryParams = new URLSearchParams({
      page: '1', // Resetear a primera página
      category: newFilters.category,
      maxPrice: newFilters.maxPrice.toString(),
      inStock: newFilters.inStock.toString()
    });
    
    // Usar navigate para transición suave
    navigate(`/products?${queryParams.toString()}`);
  };

  return (
    <aside className="w-64 p-4 flex-shrink-0 rounded-lg shadow-md bg-gray-900 text-gray-200">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Filtros</h2>
          <hr className="border-gray-700" />
        </div>

        {/* Categorías */}
        <div className="space-y-2">
          <h3 className="font-medium">Categorías</h3>
          <hr className="border-gray-700" />
          {categories.map(cat => (
            <label
              key={cat.value}
              className="flex items-center space-x-2 hover:text-white transition-colors"
            >
              <input
                type="radio"
                name="category"
                value={cat.value}
                checked={selectedCat === cat.value}
                onChange={onCategoryChange}
                className="accent-blue-500"
              />
              {cat.icon}
              <span>{cat.label}</span>
            </label>
          ))}
        </div>

        <hr className="border-gray-700" />

        {/* Precio */}
        <div>
          <h3 className="font-medium">Precio máximo</h3>
          <input
            type="range"
            min={0}
            max={5000}
            value={price}
            onChange={onPriceChange}
            className="w-full mt-2 accent-blue-500"
          />
          <div className="flex justify-between text-sm text-gray-400">
            <span>$0 MXN</span>
            <span>${price.toLocaleString()} MXN</span>
            <span>$5,000 MXN</span>
          </div>
        </div>

        <hr className="border-gray-700" />

        {/* Disponibilidad */}
        <div>
          <h3 className="font-medium">Disponibilidad</h3>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={inStock}
              onChange={onInStockChange}
              className="accent-blue-500"
            />
            <span>En stock</span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 py-2 rounded hover:bg-blue-700 transition"
        >
          Aplicar filtros
        </button>
      </form>
    </aside>
  );
};
// src/components/products/FilterSidebar.tsx
//
// Cambios frente a la versión anterior:
//  · Selección múltiple en material y tipo de perforación (?category=A,B)
//  · Botón "Buscar" arriba y abajo: se aplica solo al pulsarlo
//  · Resumen de lo elegido arriba, para saber qué está activo de un vistazo
//  · Perforaciones agrupadas por zona (oreja / nariz / cuerpo)
//  · Muestras de color por material en vez de iconos genéricos
//  · Sin react-icons: SVG en línea. Menos peso y evita el 504 de Vite
//    que provocaban los nueve subpaquetes de iconos.
//  · Buscador + botón fijos arriba del panel: no se pierden al recorrer
//    los filtros. Panel redondeado y con más contraste en el buscador.

import { useState, useEffect, useMemo, type FormEvent, type ReactNode } from 'react';
import { navigate } from 'astro:transitions/client';

interface FilterSidebarProps {
  initialValues?: {
    selectedCat?: string;
    price?: number;
    inStock?: boolean;
    search?: string;
    piercing?: string;
  };
}

const MAX_PRICE = 5000;

// El color ayuda más que un icono: en joyería el material ES el color.
const materials = [
  { value: 'Titanio', swatch: '#b9bec6' },
  { value: 'Acero Quirúrgico', swatch: '#c6ccd4' },
  { value: 'Acero Inoxidable', swatch: '#bcc2ca' },
  { value: 'Plata', swatch: '#d2d7dc' },
  { value: 'Plata .925', swatch: '#dce1e6' },
  { value: 'Rodio', swatch: '#e2e6ea' },
  { value: 'Oro 10k', swatch: '#d7b471' },
  { value: 'Oro 14k', swatch: '#dcb45e' },
  { value: 'Oro 18k', swatch: '#e3bb48' },
  { value: 'Chapa de Oro 14K', swatch: 'linear-gradient(135deg,#dcb45e 50%,#c9ced6 50%)' },
  { value: 'Chapa de Oro 18K', swatch: 'linear-gradient(135deg,#e3bb48 50%,#c9ced6 50%)' },
  { value: 'Plástico', swatch: '#e9e4dd' },
  { value: 'Otros', swatch: '#cfcac3' },
];

// Agrupar por zona del cuerpo es mucho más útil que una lista de 14 nombres
const piercingGroups = [
  {
    zone: 'Oreja',
    items: ['Lóbulo', 'Lóbulo Superior', 'Hélix', 'Antihelix', 'Tragus', 'Antitragus', 'Rook', 'Conch', 'Daith', 'Industrial', 'Flat'],
  },
  { zone: 'Nariz', items: ['Séptum', 'Nóstril'] },
  { zone: 'Cuerpo', items: ['Navel'] },
];

const parseList = (v?: string): string[] =>
  v && v !== 'all' ? v.split(',').map(s => s.trim()).filter(Boolean) : [];

// ── Acordeón ──
function Accordion({
  title,
  children,
  defaultOpen = true,
  count = 0,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="acc">
      <button type="button" onClick={() => setIsOpen(!isOpen)} className="acc-head" aria-expanded={isOpen}>
        <span className="acc-title">{title}</span>
        {count > 0 && <span className="acc-count">{count}</span>}
        <svg className={`acc-chevron ${isOpen ? 'open' : ''}`} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`acc-body ${isOpen ? 'open' : ''}`}>
        <div className="acc-inner">{children}</div>
      </div>
    </section>
  );
}

export const FilterSidebar = ({ initialValues }: FilterSidebarProps) => {
  const initial = () => ({
    categories: parseList(initialValues?.selectedCat),
    piercings: parseList(initialValues?.piercing),
    price: initialValues?.price ?? MAX_PRICE,
    search: initialValues?.search ?? '',
    inStock: initialValues?.inStock ?? false,
  });

  const [filters, setFilters] = useState(initial);

  // Comparar por CONTENIDO, no por referencia: el padre recrea el objeto
  // initialValues en cada render y eso reiniciaba el estado en bucle
  // (setFilters → efecto de auto-aplicar → navigate → remontaje → repetir).
  const initialKey = JSON.stringify(initialValues ?? {});
  useEffect(() => {
    setFilters(initial());
  }, [initialKey]);

  // Alterna un valor dentro de una lista
  const toggle = (field: 'categories' | 'piercings', value: string) => {
    setFilters(prev => {
      const list = prev[field];
      return {
        ...prev,
        [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      };
    });
  };

  const set = <K extends keyof ReturnType<typeof initial>>(field: K, value: any) =>
    setFilters(prev => ({ ...prev, [field]: value }));

  const activeCount = useMemo(
    () =>
      filters.categories.length +
      filters.piercings.length +
      (filters.price < MAX_PRICE ? 1 : 0) +
      (filters.search ? 1 : 0) +
      (filters.inStock ? 1 : 0),
    [filters]
  );

  const buildQuery = (f: typeof filters) => {
    const q = new URLSearchParams({ page: '1' });
    if (f.categories.length) q.set('category', f.categories.join(','));
    if (f.piercings.length) q.set('piercing', f.piercings.join(','));
    if (f.price < MAX_PRICE) q.set('maxPrice', String(f.price));
    if (f.search.trim()) q.set('search', f.search.trim());
    if (f.inStock) q.set('stockFilter', 'inStock');
    return q.toString();
  };

  const apply = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    navigate(`/products?${buildQuery(filters)}`);
  };

  const reset = () => {
    setFilters({ categories: [], piercings: [], price: MAX_PRICE, search: '', inStock: false });
    navigate('/products?page=1');
  };

  // ¿Lo elegido difiere de lo que ya está en la URL?
  // Sirve para atenuar el botón cuando no hay nada nuevo que buscar.
  const isDirty = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const current = new URLSearchParams(window.location.search);
    current.delete('page');
    const target = new URLSearchParams(buildQuery(filters));
    target.delete('page');
    return current.toString() !== target.toString();
  }, [filters]);

  const ApplyButton = ({ position }: { position: 'top' | 'bottom' }) => (
    <button type="submit" className={`fs-apply fs-apply-${position} ${isDirty ? 'dirty' : ''}`}>
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span>Buscar</span>
      {activeCount > 0 && <span className="fs-apply-count">{activeCount}</span>}
    </button>
  );

  // Chips de resumen: lo que está elegido, sin abrir cada sección
  const summary = [
    ...filters.categories.map(v => ({ label: v, onRemove: () => toggle('categories', v) })),
    ...filters.piercings.map(v => ({ label: v, onRemove: () => toggle('piercings', v) })),
    ...(filters.price < MAX_PRICE
      ? [{ label: `Hasta $${filters.price.toLocaleString('es-MX')}`, onRemove: () => set('price', MAX_PRICE) }]
      : []),
    ...(filters.inStock ? [{ label: 'Solo disponibles', onRemove: () => set('inStock', false) }] : []),
  ];

  return (
    <aside className="fs">
      <form onSubmit={apply} className="fs-form">
        {/* Cabecera fija: buscador + botón siempre a la vista */}
        <div className="fs-top">
        <div className="fs-search">
          <svg className="fs-search-icon" width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar en el catálogo"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="fs-search-input"
          />
          {filters.search && (
            <button type="button" onClick={() => set('search', '')} className="fs-search-clear" aria-label="Limpiar">
              ×
            </button>
          )}
        </div>

        <ApplyButton position="top" />
        </div>

        {/* Resumen de selección */}
        {summary.length > 0 && (
          <div className="fs-summary">
            {summary.map(s => (
              <button key={s.label} type="button" className="fs-tag" onClick={s.onRemove}>
                {s.label}
                <span className="fs-tag-x">×</span>
              </button>
            ))}
            <button type="button" className="fs-clear" onClick={reset}>
              Limpiar todo
            </button>
          </div>
        )}

        {/* Disponibilidad */}
        <label className="fs-switch">
          <input type="checkbox" checked={filters.inStock} onChange={e => set('inStock', e.target.checked)} />
          <span className="fs-switch-track"><span className="fs-switch-thumb" /></span>
          <span className="fs-switch-label">Solo productos disponibles</span>
        </label>

        {/* Material */}
        <Accordion title="Material" count={filters.categories.length}>
          <div className="fs-grid">
            {materials.map(m => {
              const on = filters.categories.includes(m.value);
              return (
                <label key={m.value} className={`fs-opt ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle('categories', m.value)} className="fs-sr" />
                  <span className="fs-swatch" style={{ background: m.swatch }} />
                  <span className="fs-opt-label">{m.value}</span>
                  <span className="fs-opt-check">
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </label>
              );
            })}
          </div>
        </Accordion>

        {/* Perforación */}
        <Accordion title="Tipo de perforación" count={filters.piercings.length}>
          {piercingGroups.map(g => (
            <div key={g.zone} className="fs-zone">
              <p className="fs-zone-title">{g.zone}</p>
              <div className="fs-chips">
                {g.items.map(p => {
                  const on = filters.piercings.includes(p);
                  return (
                    <label key={p} className={`fs-chip ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle('piercings', p)} className="fs-sr" />
                      {p}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </Accordion>

        {/* Precio */}
        <Accordion title="Precio" count={filters.price < MAX_PRICE ? 1 : 0}>
          <div className="fs-price-head">
            <span className="fs-price-cap">Hasta</span>
            <span className="fs-price-val">
              ${filters.price.toLocaleString('es-MX')}
              {filters.price >= MAX_PRICE && <span className="fs-price-plus">+</span>}
            </span>
          </div>
          <div className="fs-slider-wrap">
            <div className="fs-slider-fill" style={{ width: `${(filters.price / MAX_PRICE) * 100}%` }} />
            <input
              type="range"
              min={0}
              max={MAX_PRICE}
              step={100}
              value={filters.price}
              onChange={e => set('price', Number(e.target.value))}
              className="fs-slider"
              aria-label="Precio máximo"
            />
          </div>
          <div className="fs-quick">
            {[500, 1000, 2000, MAX_PRICE].map(v => (
              <button key={v} type="button" className={`fs-quick-btn ${filters.price === v ? 'on' : ''}`} onClick={() => set('price', v)}>
                {v === MAX_PRICE ? 'Todo' : `< $${v.toLocaleString('es-MX')}`}
              </button>
            ))}
          </div>
        </Accordion>

      </form>

      <style>{`
        .fs {
          --bg: #16161a;
          --surface: rgba(255,255,255,0.05);
          --surface-2: rgba(255,255,255,0.10);
          --line: rgba(255,255,255,0.08);
          --field: #222228;
          --field-line: rgba(255,255,255,0.16);
          --txt: #ffffff;
          --txt-2: rgba(255,255,255,0.72);
          --txt-3: rgba(255,255,255,0.48);
          --gold: #eab308;
          --gold-2: #f59e0b;

          background: var(--bg);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 0 20px 20px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px -28px rgba(0,0,0,0.55);
        }

        .fs-form { display: flex; flex-direction: column; }
        .fs-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        /* Cabecera fija: se queda arriba mientras se hace scroll en el panel */
        .fs-top {
          position: sticky; top: 0; z-index: 3;
          margin: 0 -20px 16px; padding: 20px 20px 16px;
          background: var(--bg);
          border-radius: 24px 24px 0 0;
          border-bottom: 1px solid var(--line);
        }

        /* Buscador: más contraste para que no se confunda con el fondo */
        .fs-search { position: relative; margin-bottom: 12px; }
        .fs-search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: rgba(234,179,8,0.85); pointer-events: none; }
        .fs-search-input {
          width: 100%; height: 48px; padding: 0 44px 0 46px;
          background: var(--field); border: 1.5px solid var(--field-line); border-radius: 999px;
          color: var(--txt); font-size: 0.95rem; outline: none;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .fs-search-input::placeholder { color: var(--txt-3); }
        .fs-search-input:hover { border-color: rgba(255,255,255,0.24); }
        .fs-search-input:focus { background: #26262d; border-color: var(--gold); box-shadow: 0 0 0 4px rgba(234,179,8,0.16); }
        .fs-search-clear {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          background: var(--surface-2); border: none; border-radius: 50%; color: var(--txt-2);
          font-size: 1.05rem; cursor: pointer; transition: all 0.2s;
        }
        .fs-search-clear:hover { background: rgba(239,68,68,0.2); color: #f87171; }

        /* Resumen */
        .fs-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; }
        .fs-tag {
          display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
          background: rgba(234,179,8,0.14); border: 1px solid rgba(234,179,8,0.3); border-radius: 999px;
          color: #fbbf24; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .fs-tag:hover { background: rgba(234,179,8,0.22); }
        .fs-tag-x { font-size: 0.95rem; line-height: 1; opacity: 0.75; }
        .fs-clear { padding: 6px 4px; background: none; border: none; color: var(--txt-3); font-size: 0.75rem; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
        .fs-clear:hover { color: #f87171; }

        /* Interruptor */
        .fs-switch { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; padding: 12px 14px; background: var(--surface); border-radius: 16px; cursor: pointer; transition: background 0.2s; }
        .fs-switch:hover { background: var(--surface-2); }
        .fs-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
        .fs-switch-track { position: relative; width: 42px; height: 24px; background: rgba(255,255,255,0.16); border-radius: 999px; flex-shrink: 0; transition: background 0.25s; }
        .fs-switch-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); }
        .fs-switch input:checked + .fs-switch-track { background: linear-gradient(135deg, var(--gold), var(--gold-2)); }
        .fs-switch input:checked + .fs-switch-track .fs-switch-thumb { transform: translateX(18px); }
        .fs-switch input:focus-visible + .fs-switch-track { box-shadow: 0 0 0 3px rgba(234,179,8,0.35); }
        .fs-switch-label { font-size: 0.88rem; color: var(--txt-2); }
        .fs-switch input:checked ~ .fs-switch-label { color: var(--txt); }

        /* Acordeón */
        .acc { border-top: 1px solid var(--line); }
        .acc:first-of-type { border-top: none; }
        .acc-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 16px 4px; background: none; border: none; color: var(--txt); cursor: pointer; border-radius: 12px; }
        .acc-head:focus-visible { outline: 2px solid rgba(234,179,8,0.5); outline-offset: 2px; }
        .acc-title { flex: 1; text-align: left; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--txt-2); }
        .acc-count { min-width: 20px; height: 20px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--gold), var(--gold-2)); color: #1a1405; border-radius: 999px; font-size: 0.7rem; font-weight: 800; }
        .acc-chevron { color: var(--txt-3); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); flex-shrink: 0; }
        .acc-chevron.open { transform: rotate(180deg); }
        .acc-body { max-height: 0; overflow: hidden; transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1); }
        .acc-body.open { max-height: 900px; }
        .acc-inner { padding-bottom: 18px; }

        /* Material */
        .fs-grid { display: flex; flex-direction: column; gap: 4px; }
        .fs-opt { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid transparent; border-radius: 14px; cursor: pointer; transition: all 0.2s; }
        .fs-opt:hover { background: var(--surface); }
        .fs-opt:focus-within { border-color: rgba(234,179,8,0.35); }
        .fs-opt.on { background: rgba(234,179,8,0.1); border-color: rgba(234,179,8,0.3); }
        .fs-swatch { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.4); }
        .fs-opt-label { flex: 1; font-size: 0.87rem; color: var(--txt-2); }
        .fs-opt.on .fs-opt-label { color: var(--txt); font-weight: 600; }
        .fs-opt-check { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 1.5px solid rgba(255,255,255,0.2); border-radius: 50%; color: transparent; flex-shrink: 0; transition: all 0.2s; }
        .fs-opt.on .fs-opt-check { background: linear-gradient(135deg, var(--gold), var(--gold-2)); border-color: transparent; color: #1a1405; }

        /* Perforaciones */
        .fs-zone + .fs-zone { margin-top: 14px; }
        .fs-zone-title { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--txt-3); margin-bottom: 8px; padding-left: 4px; }
        .fs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .fs-chip {
          display: inline-flex; align-items: center; padding: 8px 14px;
          background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
          color: var(--txt-2); font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.2s;
        }
        .fs-chip:hover { background: var(--surface-2); color: var(--txt); }
        .fs-chip:focus-within { border-color: rgba(234,179,8,0.5); }
        .fs-chip.on { background: linear-gradient(135deg, var(--gold), var(--gold-2)); border-color: transparent; color: #1a1405; font-weight: 700; }

        /* Precio */
        .fs-price-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; padding-left: 4px; }
        .fs-price-cap { font-size: 0.8rem; color: var(--txt-3); }
        .fs-price-val { font-size: 1.3rem; font-weight: 800; color: var(--txt); font-variant-numeric: tabular-nums; }
        .fs-price-plus { color: var(--gold); }
        .fs-slider-wrap { position: relative; height: 6px; background: var(--surface-2); border-radius: 999px; margin: 0 4px 14px; }
        .fs-slider-fill { position: absolute; height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-2)); border-radius: 999px; pointer-events: none; }
        .fs-slider { position: absolute; top: -8px; width: 100%; height: 22px; opacity: 0; cursor: pointer; }
        .fs-quick { display: flex; flex-wrap: wrap; gap: 6px; }
        .fs-quick-btn { padding: 7px 13px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; color: var(--txt-2); font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .fs-quick-btn:hover { color: var(--txt); border-color: var(--surface-2); }
        .fs-quick-btn.on { border-color: rgba(234,179,8,0.5); color: #fbbf24; background: rgba(234,179,8,0.12); }

        /* Botón Buscar */
        .fs-apply {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
          height: 48px; padding: 0 20px; border: none; border-radius: 999px;
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-2) 100%);
          color: #1a1405; font-size: 0.92rem; font-weight: 800; cursor: pointer;
          box-shadow: 0 8px 22px -10px rgba(234,179,8,0.6);
          transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.25s, opacity 0.2s;
        }
        .fs-apply:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -10px rgba(234,179,8,0.7); }
        .fs-apply:active { transform: scale(0.98); }
        .fs-apply:focus-visible { outline: 3px solid rgba(234,179,8,0.45); outline-offset: 2px; }

        /* Cuando lo elegido ya es lo que se está viendo, el botón se
           atenúa: evita el clic inútil sin llegar a deshabilitarlo. */
        .fs-apply:not(.dirty) { opacity: 0.6; box-shadow: none; }

        .fs-apply-count {
          min-width: 20px; height: 20px; padding: 0 6px;
          display: inline-flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.18); border-radius: 999px; font-size: 0.72rem;
        }

        @media (prefers-reduced-motion: reduce) {
          .acc-body, .fs-switch-thumb, .fs-apply { transition: none; }
        }

        @media (max-width: 768px) {
          .fs { padding: 0 16px 20px; border-radius: 20px; }
          .fs-top { margin: 0 -16px 14px; padding: 16px 16px 14px; border-radius: 20px 20px 0 0; }
        }
      `}</style>
    </aside>
  );
};
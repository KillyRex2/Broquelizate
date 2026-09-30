// ============================================================
// src/components/admin/CollectionsManager.tsx
//
// Administrador de colecciones del home.
//   - Lista con reordenamiento (arrastrar o flechas)
//   - Alta / edición en modal
//   - Interruptor de activa/inactiva
//   - Selector de productos para colecciones manuales
//
// Los estilos viven en la página .astro bajo `.cm-root`
// (los estilos scoped de Astro no alcanzan a las islas React).
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { actions } from 'astro:actions';

interface Collection {
  id: string;
  title: string;
  linkText: string;
  href: string | null;
  badge: string | null;
  mode: string;
  filterField: string | null;
  filterValue: string | null;
  limit: number;
  sortOrder: number;
  isActive: boolean;
  manualCount?: number;
}

interface PickerProduct {
  id: string;
  name: string;
  price: number;
  slug: string;
  stock: number;
  category: string | null;
  image: string | null;
}

const EMPTY_FORM = {
  id: '',
  title: '',
  linkText: 'Ver todo',
  href: '',
  badge: '',
  mode: 'auto',
  filterField: 'category',
  filterValue: '',
  limit: 10,
  isActive: true,
};

const FILTER_LABELS: Record<string, string> = {
  category: 'Categoría',
  type: 'Tipo',
  allowsEngraving: 'Permite grabado',
  isFeatured: 'Destacado',
};

export default function CollectionsManager() {
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [pickerFor, setPickerFor] = useState<Collection | null>(null);
  const [options, setOptions] = useState<{ categories: string[]; types: string[] }>({
    categories: [],
    types: [],
  });
  const dragIndex = useRef<number | null>(null);

  const flash = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setMsg({ text, kind });
    window.setTimeout(() => setMsg(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await actions.listCollections();
    if (error) flash('No se pudieron cargar las colecciones', 'err');
    else setItems(data as Collection[]);
    setLoading(false);
  }, [flash]);

  useEffect(() => {
    load();
    actions.getFilterOptions().then(({ data }) => data && setOptions(data));
  }, [load]);

  // ── Reordenamiento ──
  const persistOrder = async (next: Collection[]) => {
    setItems(next); // optimista: la UI responde de inmediato
    const { error } = await actions.reorderCollections({ ids: next.map(c => c.id) });
    if (error) {
      flash('No se pudo guardar el orden', 'err');
      load();
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  const onDrop = (to: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null) return;
    move(from, to);
  };

  // ── Activar / desactivar ──
  const toggle = async (c: Collection) => {
    const next = !c.isActive;
    setItems(prev => prev.map(x => (x.id === c.id ? { ...x, isActive: next } : x)));
    const { error } = await actions.toggleCollection({ id: c.id, isActive: next });
    if (error) {
      flash('No se pudo cambiar la visibilidad', 'err');
      load();
    }
  };

  // ── Eliminar ──
  const remove = async (c: Collection) => {
    if (!window.confirm(`¿Eliminar la colección "${c.title}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await actions.deleteCollection({ id: c.id });
    if (error) flash('No se pudo eliminar', 'err');
    else {
      flash('Colección eliminada');
      load();
    }
  };

  // ── Guardar (alta o edición) ──
  const save = async () => {
    if (!form) return;
    if (form.title.trim().length < 2) return flash('El título es obligatorio', 'err');
    if (form.mode === 'auto' && !form.filterValue.trim() && !isBooleanField(form.filterField))
      return flash('Indica el valor del filtro', 'err');

    const payload = {
      title: form.title.trim(),
      linkText: form.linkText.trim() || 'Ver todo',
      href: form.href.trim() || undefined,
      badge: form.badge.trim() || undefined,
      mode: form.mode as 'auto' | 'manual',
      filterField: form.mode === 'auto' ? (form.filterField as any) : undefined,
      filterValue:
        form.mode === 'auto'
          ? isBooleanField(form.filterField)
            ? 'true'
            : form.filterValue.trim()
          : undefined,
      limit: Number(form.limit) || 10,
      isActive: form.isActive,
    };

    const res = form.id
      ? await actions.updateCollection({ id: form.id, ...payload })
      : await actions.createCollection(payload);

    if (res.error) flash(res.error.message || 'No se pudo guardar', 'err');
    else {
      flash(form.id ? 'Colección actualizada' : 'Colección creada');
      setForm(null);
      load();
    }
  };

  return (
    <div className="cm-root">
      <header className="cm-head">
        <div>
          <h1 className="cm-h1">Colecciones del home</h1>
          <p className="cm-lead">
            Cada colección es un carrusel en la página principal. Arrastra para cambiar el orden en
            que aparecen.
          </p>
        </div>
        <button className="cm-btn cm-btn-primary" onClick={() => setForm({ ...EMPTY_FORM })}>
          + Nueva colección
        </button>
      </header>

      {msg && <div className={`cm-msg ${msg.kind}`}>{msg.text}</div>}

      {loading ? (
        <div className="cm-empty">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="cm-empty">
          Todavía no hay colecciones. Crea la primera y aparecerá en el home.
        </div>
      ) : (
        <ul className="cm-list">
          {items.map((c, i) => (
            <li
              key={c.id}
              className={`cm-row ${c.isActive ? '' : 'off'}`}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(i)}
            >
              <div className="cm-grip" title="Arrastra para reordenar">⠿</div>

              <div className="cm-arrows">
                <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Subir">▲</button>
                <button onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label="Bajar">▼</button>
              </div>

              <div className="cm-info">
                <div className="cm-title-row">
                  <span className="cm-title">{c.title}</span>
                  {c.badge && <span className="cm-chip gold">{c.badge}</span>}
                  <span className={`cm-chip ${c.mode === 'manual' ? 'violet' : 'blue'}`}>
                    {c.mode === 'manual' ? 'Manual' : 'Automática'}
                  </span>
                </div>
                <span className="cm-sub">
                  {c.mode === 'manual'
                    ? `${c.manualCount ?? 0} producto${c.manualCount === 1 ? '' : 's'} elegidos`
                    : `${FILTER_LABELS[c.filterField ?? ''] ?? c.filterField}: ${c.filterValue}`}
                  {' · '}máx. {c.limit}
                </span>
              </div>

              <label className="cm-switch" title={c.isActive ? 'Visible en el home' : 'Oculta'}>
                <input type="checkbox" checked={c.isActive} onChange={() => toggle(c)} />
                <span />
              </label>

              <div className="cm-actions">
                {c.mode === 'manual' && (
                  <button className="cm-btn" onClick={() => setPickerFor(c)}>Productos</button>
                )}
                <button
                  className="cm-btn"
                  onClick={() =>
                    setForm({
                      id: c.id,
                      title: c.title,
                      linkText: c.linkText ?? 'Ver todo',
                      href: c.href ?? '',
                      badge: c.badge ?? '',
                      mode: c.mode,
                      filterField: c.filterField ?? 'category',
                      filterValue: c.filterValue ?? '',
                      limit: c.limit,
                      isActive: c.isActive,
                    })
                  }
                >
                  Editar
                </button>
                <button className="cm-btn danger" onClick={() => remove(c)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <CollectionForm
          form={form}
          setForm={setForm}
          options={options}
          onSave={save}
          onClose={() => setForm(null)}
        />
      )}

      {pickerFor && (
        <ProductPicker
          collection={pickerFor}
          onClose={() => setPickerFor(null)}
          onSaved={() => {
            setPickerFor(null);
            flash('Productos actualizados');
            load();
          }}
          onError={t => flash(t, 'err')}
        />
      )}
    </div>
  );
}

function isBooleanField(f: string) {
  return f === 'allowsEngraving' || f === 'isFeatured';
}

// ============================================================
// Modal de alta / edición
// ============================================================
function CollectionForm({
  form,
  setForm,
  options,
  onSave,
  onClose,
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  options: { categories: string[]; types: string[] };
  onSave: () => void;
  onClose: () => void;
}) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const valueList =
    form.filterField === 'category' ? options.categories : form.filterField === 'type' ? options.types : [];

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal" onClick={e => e.stopPropagation()}>
        <h2 className="cm-modal-title">{form.id ? 'Editar colección' : 'Nueva colección'}</h2>

        <div className="cm-field">
          <label>Título</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Colección Piercings Titanio" />
        </div>

        <div className="cm-grid2">
          <div className="cm-field">
            <label>Texto del enlace</label>
            <input value={form.linkText} onChange={e => set('linkText', e.target.value)} placeholder="Ver todo" />
          </div>
          <div className="cm-field">
            <label>Enlace</label>
            <input value={form.href} onChange={e => set('href', e.target.value)} placeholder="/products?category=piercings" />
          </div>
        </div>

        <div className="cm-grid2">
          <div className="cm-field">
            <label>Etiqueta sobre las fotos <span className="cm-opt">(opcional)</span></label>
            <input value={form.badge} onChange={e => set('badge', e.target.value)} placeholder="Titanio" />
          </div>
          <div className="cm-field">
            <label>Máximo de productos</label>
            <input type="number" min={2} max={24} value={form.limit} onChange={e => set('limit', e.target.value)} />
          </div>
        </div>

        <div className="cm-field">
          <label>¿Cómo se llena?</label>
          <div className="cm-modes">
            <button className={form.mode === 'auto' ? 'on' : ''} onClick={() => set('mode', 'auto')}>
              <strong>Automática</strong>
              <span>Se actualiza sola según un filtro</span>
            </button>
            <button className={form.mode === 'manual' ? 'on' : ''} onClick={() => set('mode', 'manual')}>
              <strong>Manual</strong>
              <span>Eliges los productos y su orden</span>
            </button>
          </div>
        </div>

        {form.mode === 'auto' && (
          <div className="cm-grid2">
            <div className="cm-field">
              <label>Filtrar por</label>
              <select value={form.filterField} onChange={e => set('filterField', e.target.value)}>
                <option value="category">Categoría</option>
                <option value="type">Tipo</option>
                <option value="allowsEngraving">Permite grabado</option>
                <option value="isFeatured">Destacado</option>
              </select>
            </div>
            {!isBooleanField(form.filterField) && (
              <div className="cm-field">
                <label>Valor</label>
                <input
                  list="cm-values"
                  value={form.filterValue}
                  onChange={e => set('filterValue', e.target.value)}
                  placeholder="piercings"
                />
                <datalist id="cm-values">
                  {valueList.map(v => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <span className="cm-hint">Elige de la lista: debe coincidir exacto con la base.</span>
              </div>
            )}
          </div>
        )}

        {form.mode === 'manual' && !form.id && (
          <p className="cm-hint block">
            Guarda primero la colección y después usa el botón <strong>Productos</strong> para elegirlos.
          </p>
        )}

        <label className="cm-check">
          <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
          <span>Visible en el home</span>
        </label>

        <div className="cm-modal-actions">
          <button className="cm-btn" onClick={onClose}>Cancelar</button>
          <button className="cm-btn cm-btn-primary" onClick={onSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Selector de productos (solo colecciones manuales)
// ============================================================
function ProductPicker({
  collection,
  onClose,
  onSaved,
  onError,
}: {
  collection: Collection;
  onClose: () => void;
  onSaved: () => void;
  onError: (t: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [selected, setSelected] = useState<PickerProduct[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carga inicial: lo ya guardado + un primer listado
  useEffect(() => {
    (async () => {
      const [linksRes, listRes] = await Promise.all([
        actions.getCollectionProducts({ collectionId: collection.id }),
        actions.searchAdminProducts({ query: '', limit: 20 }),
      ]);
      setResults((listRes.data ?? []) as PickerProduct[]);

      const ids = (linksRes.data ?? []).map((l: any) => l.productId);
      if (ids.length > 0) {
        const { data } = await actions.getProductsByIds({ ids });
        const byId = new Map(((data ?? []) as PickerProduct[]).map(p => [p.id, p]));
        setSelected(ids.map((id: string) => byId.get(id)).filter(Boolean) as PickerProduct[]);
      }
      setBusy(false);
    })();
  }, [collection.id]);

  // Búsqueda con retardo, para no disparar una query por tecla
  useEffect(() => {
    const t = window.setTimeout(async () => {
      const { data } = await actions.searchAdminProducts({ query, limit: 20 });
      if (data) setResults(data as PickerProduct[]);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const add = (p: PickerProduct) => {
    if (selected.some(s => s.id === p.id)) return;
    setSelected([...selected, p]);
  };
  const drop = (id: string) => setSelected(selected.filter(s => s.id !== id));
  const shift = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await actions.setCollectionProducts({
      collectionId: collection.id,
      productIds: selected.map(s => s.id),
    });
    setSaving(false);
    if (error) onError('No se pudieron guardar los productos');
    else onSaved();
  };

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-modal wide" onClick={e => e.stopPropagation()}>
        <h2 className="cm-modal-title">Productos de "{collection.title}"</h2>

        <div className="cm-picker">
          <div className="cm-picker-col">
            <input
              className="cm-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar producto por nombre…"
            />
            <div className="cm-scroll">
              {busy ? (
                <p className="cm-hint block">Cargando…</p>
              ) : results.length === 0 ? (
                <p className="cm-hint block">Sin resultados.</p>
              ) : (
                results.map(p => {
                  const already = selected.some(s => s.id === p.id);
                  return (
                    <div key={p.id} className={`cm-prod ${already ? 'used' : ''}`}>
                      <img src={p.image || '/images/products/no-image.png'} alt="" />
                      <div className="cm-prod-info">
                        <span className="cm-prod-name">{p.name}</span>
                        <span className="cm-prod-meta">
                          {p.category} · stock {p.stock}
                        </span>
                      </div>
                      <button className="cm-btn small" onClick={() => add(p)} disabled={already}>
                        {already ? 'Agregado' : 'Agregar'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="cm-picker-col">
            <div className="cm-picker-head">
              En la colección <span className="cm-chip gold">{selected.length}</span>
            </div>
            <div className="cm-scroll">
              {selected.length === 0 ? (
                <p className="cm-hint block">Agrega productos desde la izquierda. El orden de esta lista es el que verá el cliente.</p>
              ) : (
                selected.map((p, i) => (
                  <div key={p.id} className="cm-prod">
                    <div className="cm-arrows">
                      <button onClick={() => shift(i, -1)} disabled={i === 0}>▲</button>
                      <button onClick={() => shift(i, 1)} disabled={i === selected.length - 1}>▼</button>
                    </div>
                    <img src={p.image || '/images/products/no-image.png'} alt="" />
                    <div className="cm-prod-info">
                      <span className="cm-prod-name">{p.name}</span>
                      <span className="cm-prod-meta">Posición {i + 1}</span>
                    </div>
                    <button className="cm-btn small danger" onClick={() => drop(p.id)}>Quitar</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="cm-modal-actions">
          <button className="cm-btn" onClick={onClose}>Cancelar</button>
          <button className="cm-btn cm-btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar productos'}
          </button>
        </div>
      </div>
    </div>
  );
}
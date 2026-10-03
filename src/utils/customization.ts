// ============================================================
// src/utils/customization.ts
// ============================================================

/**
 * Definición de un campo de personalización configurable por el admin.
 * Se guarda como JSON array en Product.customizationFields
 */
export type CustomizationFieldType = 'text' | 'image' | 'select' | 'pieces';

export interface CustomizationField {
  id: string;
  type: CustomizationFieldType;
  label: string;
  placeholder?: string;
  maxLength?: number;       // Solo para type: "text"
  maxSize?: number;         // MB, solo para type: "image"
  accept?: string[];        // MIME types, solo para type: "image"
  options?: string[];       // Solo para type: "select"
  perPiece?: boolean;       // Solo para type: "text": un texto por cada pieza elegida
  minPieces?: number;       // Solo para type: "pieces": piezas incluidas en el precio (y mínimo)
  maxPieces?: number;       // Solo para type: "pieces": máximo que puede elegir el cliente
  pricePerPiece?: number;   // Solo para type: "pieces": costo de cada pieza extra (MXN)
  required: boolean;
  order: number;
}

/**
 * Valor enviado por el cliente al agregar al carrito.
 * Se guarda como JSON array en order_items.customizationData
 */
export interface CustomizationValue {
  fieldId: string;
  label: string;
  type: CustomizationFieldType;
  value: string;            // Texto, URL de imagen, opción seleccionada o número de piezas
}

// ── Número de piezas (dijes) ─────────────────────────────────

/** Tope absoluto de piezas que se puede configurar. */
export const PIECES_HARD_LIMIT = 10;

/** Configuración de un campo de piezas, con valores por defecto y acotada. */
export function piecesConfig(field: Partial<CustomizationField>) {
  const min = Math.max(1, Math.min(PIECES_HARD_LIMIT, Math.floor(Number(field.minPieces) || 1)));
  const max = Math.max(min, Math.min(PIECES_HARD_LIMIT, Math.floor(Number(field.maxPieces) || 5)));
  const price = Math.max(0, Number(field.pricePerPiece) || 0);
  return { min, max, price };
}

/** Primer campo de piezas del producto (solo se toma en cuenta uno). */
export function findPiecesField(fields: CustomizationField[]): CustomizationField | undefined {
  return fields.find(f => f.type === 'pieces');
}

/**
 * Cuánto se suma al precio unitario por la personalización elegida.
 * Hoy solo cuenta el número de piezas: (piezas - incluidas) × precio por pieza.
 * Sin valor de piezas (no personalizó, o venta de mostrador) no se cobra extra.
 * `error` trae el motivo si el valor no es válido (manipulado o fuera de rango).
 */
export function getCustomizationExtra(
  fields: CustomizationField[],
  values: unknown
): { extra: number; pieces: number | null; error: string | null } {
  const field = findPiecesField(fields);
  if (!field) return { extra: 0, pieces: null, error: null };
  // Puede llegar como texto JSON (así se guarda en order_items)
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = null; }
  }
  if (!Array.isArray(values)) return { extra: 0, pieces: null, error: null };

  const value = values.find((v: any) => v && v.fieldId === field.id);
  if (!value || String((value as any).value ?? '').trim() === '') {
    return { extra: 0, pieces: null, error: null };
  }

  const { min, max, price } = piecesConfig(field);
  const raw = String((value as any).value).trim();
  const pieces = Number(raw);
  if (!/^\d+$/.test(raw) || pieces < min || pieces > max) {
    return { extra: 0, pieces: null, error: `"${field.label}" debe ser entre ${min} y ${max}` };
  }

  return { extra: Math.round((pieces - min) * price * 100) / 100, pieces, error: null };
}

/**
 * Parsea el JSON de customizationFields de la DB a un array tipado.
 */
export function parseCustomizationFields(raw: string | null | undefined): CustomizationField[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a: CustomizationField, b: CustomizationField) => a.order - b.order);
  } catch {
    return [];
  }
}

/**
 * Serializa un array de campos a JSON string para guardar en la DB.
 */
export function serializeCustomizationFields(fields: CustomizationField[]): string {
  return JSON.stringify(fields);
}

/**
 * Parsea el JSON de customizationData de un order_item.
 */
export function parseCustomizationData(raw: string | null | undefined): CustomizationValue[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Verifica si un producto tiene personalización habilitada.
 */
export function hasCustomization(raw: string | null | undefined): boolean {
  return parseCustomizationFields(raw).length > 0;
}

/**
 * Verifica si un producto tiene campos de tipo imagen.
 */
export function hasImageCustomization(raw: string | null | undefined): boolean {
  return parseCustomizationFields(raw).some(f => f.type === 'image');
}

/**
 * Verifica si un producto tiene campos de tipo texto.
 */
export function hasTextCustomization(raw: string | null | undefined): boolean {
  return parseCustomizationFields(raw).some(f => f.type === 'text');
}

/**
 * Genera un ID único para un campo nuevo basado en el label.
 */
export function generateFieldId(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || `field_${Date.now()}`;
}

/**
 * Valida que los valores del cliente cumplan con la configuración.
 * Retorna array de errores (vacío = todo OK).
 */
export function validateCustomizationValues(
  fields: CustomizationField[],
  values: CustomizationValue[]
): string[] {
  const errors: string[] = [];

  for (const field of fields) {
    const value = values.find(v => v.fieldId === field.id);

    if (field.required && (!value || !value.value.trim())) {
      errors.push(`"${field.label}" es obligatorio`);
      continue;
    }

    if (!value || !value.value.trim()) continue;

    switch (field.type) {
      case 'text':
        if (field.maxLength && value.value.length > field.maxLength) {
          errors.push(`"${field.label}" excede el máximo de ${field.maxLength} caracteres`);
        }
        break;
      case 'select':
        if (field.options && !field.options.includes(value.value)) {
          errors.push(`"${field.label}" tiene una opción inválida`);
        }
        break;
      case 'image':
        if (!value.value.startsWith('http')) {
          errors.push(`"${field.label}" requiere una imagen válida`);
        }
        break;
      case 'pieces': {
        const { error } = getCustomizationExtra([field], [value]);
        if (error) errors.push(error);
        break;
      }
    }
  }

  return errors;
}
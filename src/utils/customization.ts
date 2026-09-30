// ============================================================
// src/utils/customization.ts
// ============================================================

/**
 * Definición de un campo de personalización configurable por el admin.
 * Se guarda como JSON array en Product.customizationFields
 */
export interface CustomizationField {
  id: string;
  type: 'text' | 'image' | 'select';
  label: string;
  placeholder?: string;
  maxLength?: number;       // Solo para type: "text"
  maxSize?: number;         // MB, solo para type: "image"
  accept?: string[];        // MIME types, solo para type: "image"
  options?: string[];       // Solo para type: "select"
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
  type: 'text' | 'image' | 'select';
  value: string;            // Texto, URL de imagen, u opción seleccionada
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
    }
  }

  return errors;
}
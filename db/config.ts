import { column, defineDb, defineTable } from 'astro:db';

const User = defineTable({
  columns: {
    id: column.text({ primaryKey: true, unique: true }),
    name: column.text(),
    email: column.text({ unique: true }),
    password: column.text(),
    phone: column.text({ optional: true }),
    shippingAddress: column.text({ optional: true }),
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ optional: true }),
    rol: column.text({ references: () => Role.columns.id }),
  }
})

const Role = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text()
  }
})

const Product = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    price: column.number(),
    description: column.text(),
    category: column.text(),
    slug: column.text({ unique: true }),
    type: column.text(),
    stock: column.number(),
    piercing_name: column.text({ optional: true }),
    cost: column.number({ optional: true }),
    hasVariants: column.boolean({ default: false }),

    // ✅ NUEVO: Campos de personalización configurables (JSON array)
    // Reemplaza a allowsEngraving — soporta texto, imagen y select
    customizationFields: column.text({ default: '[]' }),

    // ⚠️ DEPRECADO: Mantener temporalmente hasta migrar todo el código
    // Eliminar cuando admin + storefront + actions usen customizationFields
    allowsEngraving: column.boolean({ default: false }),
    coverImageId: column.text({ optional: true }),
    isFeatured: column.boolean({ default: false }),
    isDeleted: column.boolean({ default: false }),

    user: column.text({ references: () => User.columns.id })
  }
})

const ProductImage = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    productId: column.text({ references: () => Product.columns.id }),
    variantId: column.text({
      references: () => ProductVariant.columns.id,
      optional: true
    }),
    combinationId: column.text({
      references: () => ProductVariantCombination.columns.id,
      optional: true
    }),
    image: column.text(),
  }
})

const ProductVariant = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    productId: column.text({ references: () => Product.columns.id }),
    variantName: column.text(),
    variantValue: column.text(),
    priceAdjustment: column.number({ default: 0 }),
    cost: column.number({ optional: true }),
    stock: column.number({ default: 0 }),
    sku: column.text({ optional: true }),
    isDefault: column.boolean({ default: false }),
    isActive: column.boolean({ default: true }),
    createdAt: column.date({ default: new Date() })
  }
})

const ProductVariantCombination = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    productId: column.text({ references: () => Product.columns.id }),
    combinationName: column.text({ optional: true }),
    price: column.number(),
    stock: column.number({ default: 0 }),
    sku: column.text({ unique: true, optional: true }),
    isActive: column.boolean({ default: true }),
    createdAt: column.date({ default: new Date() })
  }
})

const VariantCombinationItem = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    combinationId: column.text({ references: () => ProductVariantCombination.columns.id }),
    variantId: column.text({ references: () => ProductVariant.columns.id })
  }
})

const orders = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    orderNumber: column.text(),
    customerEmail: column.text(),
    shippingAddress: column.text(),
    subtotal: column.number(),
    tax: column.number(),
    total: column.number(),
    paymentMethod: column.text(),
    status: column.text({ default: 'pending' }),
    createdAt: column.date({ default: new Date() }),
    clientId: column.number({
      references: () => Client.columns.id,
      optional: true
    }),
    trackingNumber: column.text({ optional: true }),
    carrier: column.text({ optional: true }),
    labelId: column.text({ optional: true }),
    labelUrl: column.text({ optional: true }),
    shippingService: column.text({ optional: true }),
    shippingCost: column.number({ optional: true }),
    shippedAt: column.date({ optional: true })
  }
});

const order_items = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    orderId: column.text({ references: () => orders.columns.id }),
    productId: column.text({ references: () => Product.columns.id }),
    productName: column.text(),
    quantity: column.number(),
    price: column.number(),
    subtotal: column.number(),
    variantCombinationId: column.text({
      references: () => ProductVariantCombination.columns.id,
      optional: true
    }),
    variantDescription: column.text({ optional: true }),

    // ✅ NUEVO: Guarda todas las personalizaciones del cliente (JSON array)
    // Ejemplo: [{"fieldId":"frente","label":"Texto frente","type":"text","value":"Te amo"},
    //           {"fieldId":"tipografia","label":"Tipografía","type":"select","value":"Cursiva"}]
    customizationData: column.text({ optional: true }),

    // ⚠️ DEPRECADO: Mantener temporalmente hasta migrar todo el código
    engraving: column.text({ optional: true }),
  }
});

const Client = defineTable({
  columns: {
    id: column.number({
      primaryKey: true,
      autoIncrement: true,
    }),
    nombre: column.text(),
    clave_elector: column.text({
      unique: true,
      optional: true
    }),
    saldo_actual: column.number({
      default: 0,
    }),
    observaciones: column.text({
      optional: true
    }),
    telefono: column.text({
      optional: true
    }),
    createdAt: column.date({
      default: new Date(),
    }),
  }
});
export const Collection = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
 
    // Presentacion
    title: column.text(),                             // "Colección Piercings Titanio"
    linkText: column.text({ default: 'Ver todo' }),
    href: column.text({ optional: true }),            // "/products?type=Piercings"
    badge: column.text({ optional: true }),           // "Titanio" · "Oferta"
 
    // Comportamiento
    mode: column.text({ default: 'auto' }),           // 'auto' | 'manual'
    filterField: column.text({ optional: true }),     // category | type | allowsEngraving | isFeatured | onSale
    filterValue: column.text({ optional: true }),     // 'relicarios' | 'Anillos' | 'true'
    limit: column.number({ default: 10 }),
 
    // Orden y visibilidad en el home
    sortOrder: column.number({ default: 0 }),
    isActive: column.boolean({ default: true }),
 
    createdAt: column.date({ default: new Date() }),
  },
  indexes: [
    { on: ['isActive', 'sortOrder'] },
  ],
});
 
/**
 * Solo se usa cuando la coleccion es mode='manual'.
 * Guarda que productos y en que orden.
 */
export const CollectionProduct = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    collectionId: column.text({ references: () => Collection.columns.id }),
    productId: column.text(),          // referencia logica a Product.id
    position: column.number({ default: 0 }),
  },
  indexes: [
    { on: ['collectionId', 'position'] },
  ],
});

export default defineDb({
  tables: {
    User,
    Role,
    Product,
    ProductImage,
    ProductVariant,
    ProductVariantCombination,
    VariantCombinationItem,
    orders,
    order_items,
    Client,
    Collection,
    CollectionProduct
  }
});
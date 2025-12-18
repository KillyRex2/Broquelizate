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
    user: column.text({ references: () => User.columns.id })
  }
})

// IMPORTANTE: ProductImage debe usar productId como campo principal
const ProductImage = defineTable({  
  columns: {
    id: column.text({ primaryKey: true }),
    productId: column.text({ references: () => Product.columns.id }), // Campo principal - SIEMPRE requerido
    variantId: column.text({ 
      references: () => ProductVariant.columns.id, 
      optional: true // Solo se usa si la imagen es específica de una variante
    }),
    image: column.text(), // URL de Cloudinary
  }
})

const ProductVariant = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    productId: column.text({ references: () => Product.columns.id }),
    variantName: column.text(),
    variantValue: column.text(),
    priceAdjustment: column.number({ default: 0 }),
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
    variantDescription: column.text({ optional: true })
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
    Client  
  }
});
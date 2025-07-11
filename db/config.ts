import { column, defineDb, defineTable } from 'astro:db';

const User = defineTable({
  columns: {
    id: column.text({ primaryKey: true, unique: true }),
    name: column.text(),
    email: column.text({unique: true}),
    password: column.text(),
    createdAt: column.date({default: new Date()}),
    rol: column.text({ references: () => Role.columns.id }),
  }
})

const Role = defineTable({
  columns: {
    id: column.text({primaryKey: true}),
    name: column.text()
  }
})

// Products
const Product = defineTable({
  columns: {
    id: column.text({primaryKey: true}),
    name: column.text(),
    price: column.number(),
    description: column.text(),
    category: column.text(),
    slug: column.text({unique: true}),
    type: column.text(),
    stock: column.number(),
    piercing_name: column.text({optional: true}),
    cost: column.number(), 

    user: column.text({references: () => User.columns.id})
  }
})

const ProductImage = defineTable({
  columns: {
    id: column.text({primaryKey: true}),
    productId: column.text({references: () => Product.columns.id}),
    image: column.text(),
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
    status: column.text({ default: 'pending' }), // 'pending', 'completed', 'cancelled'
    createdAt: column.date({ default: new Date() })
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
    subtotal: column.number()
  }
});

const Client = defineTable({
  columns: {
    id: column.number({
      primaryKey: true,
      autoIncrement: true,
    }),
    nombre: column.text({
      optional: false
    }),
    clave_elector: column.text({
      unique: true,
      optional: true
    }),
    saldo_actual: column.number({
      default: 0,
      optional: false,
      // Corrección: tipado explícito para el parámetro 'col'
      check: (col: { gte: (value: number) => unknown }) => col.gte(0)
    }),
    observaciones: column.text({
      optional: true
    }),
    telefono: column.text({
      optional: true
    }),
    createdAt: column.date({
      default: new Date(),  // Fecha actual por defecto
      optional: false
    })
  }
});


// https://astro.build/db/config
export default defineDb({
  tables: {
    User,
    Role,
    Product,
    ProductImage,
    orders,
    order_items,
    Client  
  }
});

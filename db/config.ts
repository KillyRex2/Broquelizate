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
// https://astro.build/db/config
export default defineDb({
  tables: {
    User,
    Role,
    Product,
    ProductImage,
  }
});

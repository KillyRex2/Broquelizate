import { db, Role, User, Product, ProductImage } from 'astro:db';
import { v4 as UUID } from 'uuid';
import bcrypt from 'bcryptjs'
import { seedProducts } from './seed-data';

// https://astro.build/db/seed
export default async function seed() {
	const roles = [
		{id: 'admin', name: 'Administrator'},
		{id: 'worker', name: 'Worker'},
		{id: 'user', name: 'client'},
	];

	const YurePinedo = {
		id: UUID(),
		name: 'Yureny Pinedo',
		email: 'yurepinedop@gmail.com',
		password: bcrypt.hashSync('123456'),
		rol: 'admin'
	};
	const ItzelPinedo = {
		id: UUID(),
		name: 'Itzel Pinedo',
		email: 'itzelpinedop@gmail.com',
		password: bcrypt.hashSync('123456'),
		rol: 'user'
	};

	await db.insert(Role).values(roles)
	await db.insert(User).values([YurePinedo, ItzelPinedo])

	const queries: any = [];

	seedProducts.forEach((p) => {
		const product = {
			id: UUID(),
			name:p.name,
			price: p.price,
			description: p.description,
			category: p.category,
			slug: p.slug,
			type: p.type,
			stock: p.stock,
			user: YurePinedo.id,
		};

		queries.push(db.insert(Product).values(product));

		p.images.forEach(img => {
			const image = {
				id: UUID(),
				productId: product.id,
				image: img,
			}

			queries.push(db.insert(ProductImage).values(image))
		})
	});

	await db.batch(queries);
}

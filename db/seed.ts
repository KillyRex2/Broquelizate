import { db, Role, User, Product, ProductImage } from 'astro:db';
import { v4 as UUID } from 'uuid';
import bcrypt from 'bcryptjs';
import { seedProducts } from './seed-data';
import { eq } from 'astro:db';

// https://astro.build/db/seed
export default async function seed() {
	try {
		console.log('🌱 Iniciando seed...');

		// Roles
		const roles = [
			{ id: 'admin', name: 'Administrator' },
			{ id: 'worker', name: 'Worker' },
			{ id: 'user', name: 'client' },
		];

		// Insertar roles solo si no existen
		console.log('Insertando roles...');
		for (const role of roles) {
			const existingRole = await db.select().from(Role).where(eq(Role.id, role.id)).get();
			if (!existingRole) {
				await db.insert(Role).values(role);
				console.log(`✅ Rol ${role.name} creado`);
			} else {
				console.log(`⏭️  Rol ${role.name} ya existe`);
			}
		}

		// Usuarios
		const YurePinedo = {
			id: 'brokeadmin1',
			name: 'Yureny Pinedo',
			email: 'broquelizate@gmail.com',
			password: bcrypt.hashSync('123456', 10),
			rol: 'admin',
			createdAt: new Date()
		};

		const AdminBackup = {
			id: 'ABC-123-ADMIN',
			name: 'Admin Backup',
			email: 'admin@broquelizate.com',
			password: bcrypt.hashSync('admin123', 10),
			rol: 'admin',
			createdAt: new Date()
		};

		const ItzelPinedo = {
			id: 'ABC-123-ITZEL',
			name: 'Itzel Pinedo',
			email: 'itzelpinedop@gmail.com',
			password: bcrypt.hashSync('123456', 10),
			rol: 'user',
			createdAt: new Date()
		};

		const users = [YurePinedo, AdminBackup, ItzelPinedo];

		// Insertar usuarios solo si no existen
		console.log('Insertando usuarios...');
		for (const user of users) {
			const existingUser = await db.select().from(User).where(eq(User.id, user.id)).get();
			if (!existingUser) {
				await db.insert(User).values(user);
				console.log(`✅ Usuario ${user.email} creado`);
			} else {
				console.log(`⏭️  Usuario ${user.email} ya existe`);
			}
		}

		console.log('Insertando productos...');
		const queries: any = [];

		seedProducts.forEach((p) => {
			const product = {
				id: UUID(),
				name: p.name,
				price: p.price,
				description: p.description,
				category: p.category,
				slug: p.slug,
				type: p.type,
				stock: p.stock,
				piercing_name: p.piercing_name.join(','),
				cost: p.cost || 0,
				hasVariants: false,
				user: YurePinedo.id,
			};

			queries.push(db.insert(Product).values(product));

			p.images.forEach(img => {
				const image = {
					id: UUID(),
					productId: product.id,
					variantId: null,
					image: img,
				};

				queries.push(db.insert(ProductImage).values(image));
			});
		});

		await db.batch(queries);
		console.log(`✅ ${seedProducts.length} productos insertados`);

		console.log('\n🎉 Seed completado exitosamente!');
		console.log('\n📧 Credenciales de acceso:');
		console.log('1. Email: yurepinedop@gmail.com - Password: 123456');
		console.log('2. Email: admin@broquelizate.com - Password: admin123');
		
	} catch (error) {
		console.error('❌ Error en seed:', error);
		throw error;
	}
}
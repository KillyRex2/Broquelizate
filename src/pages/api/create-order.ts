// src/pages/api/create-order.ts
import { db, orders, order_items } from 'astro:db';
import { v4 as uuidv4 } from 'uuid';
import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // ✅ NUEVO: Obtener sesión del usuario autenticado
    const session = await getSession(request);
    
    // ✅ PRIORIZAR el email de la sesión sobre el del formulario
    // Si el usuario está autenticado, usar su email de cuenta
    // Esto garantiza que las órdenes se asocien correctamente
    const customerEmail = session?.user?.email || data.customerEmail;
    
    console.log('📦 Creando orden:', {
      sessionEmail: session?.user?.email,
      formEmail: data.customerEmail,
      finalEmail: customerEmail,
      isAuthenticated: !!session?.user
    });
    
    // Validar datos requeridos
    if (!data.products || !Array.isArray(data.products)) {
      throw new Error('Datos de productos inválidos');
    }
    
    if (!customerEmail) {
      throw new Error('Email del cliente es requerido');
    }

    // Generar IDs
    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    // Insertar orden principal
    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      customerEmail: customerEmail, // ✅ Usar el email correcto
      shippingAddress: JSON.stringify(data.shippingAddress),
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      paymentMethod: data.paymentMethod,
      status: 'completed',
      createdAt: new Date(),
      clientId: data.clientId || null
    } as any);

    // Crear items de la orden
    const orderItems = data.products.map((product: any) => ({
      id: uuidv4(),
      orderId,
      productId: product.id,
      productName: product.name,
      quantity: product.quantity,
      price: product.price,
      subtotal: product.price * product.quantity,
      engraving: product.engraving ? JSON.stringify(product.engraving) : null
    }));

    await db.insert(order_items).values(orderItems);

    console.log('✅ Orden creada exitosamente:', {
      orderId,
      orderNumber,
      customerEmail,
      itemsCount: orderItems.length
    });

    return new Response(JSON.stringify({
      id: orderId,
      orderNumber,
      customerEmail, // ✅ Devolver el email usado
      clientId: data.clientId || null,
      message: 'Orden creada exitosamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ Error al crear orden:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Error al crear la orden',
      details: error.stack || null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
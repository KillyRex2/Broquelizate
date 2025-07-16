import { db, orders, order_items } from 'astro:db';
import { v4 as uuidv4 } from 'uuid';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Validar datos requeridos (CORREGIDO: paréntesis extra eliminado)
    if (!data.products || !Array.isArray(data.products)) {
      throw new Error('Datos de productos inválidos');
    }

    // Generar IDs
    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    // Insertar orden principal
    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      customerEmail: data.customerEmail,
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
      subtotal: product.price * product.quantity
    }));

    await db.insert(order_items).values(orderItems);

    return new Response(JSON.stringify({
      id: orderId,
      orderNumber,
      clientId: data.clientId || null,
      message: 'Orden creada exitosamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Error al crear la orden',
      details: error.stack || null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
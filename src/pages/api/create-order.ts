import { db, orders, order_items } from 'astro:db';
import { v4 as uuidv4 } from 'uuid';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    // Generate IDs using UUID
    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    // Insert main order
    await db.insert(orders).values({
      id: orderId,  // Include id here
      orderNumber,
      customerEmail: data.customerEmail,
      shippingAddress: JSON.stringify(data.shippingAddress),
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      paymentMethod: data.paymentMethod,
      status: 'completed',
      createdAt: new Date()
    } as any);  // Use type assertion to bypass TS error

    // Create order items
    const orderItems = data.products.map((product: any) => ({
      id: uuidv4(),
      orderId,  // Use orderId as foreign key
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
      message: 'Orden creada exitosamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Error al crear la orden'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
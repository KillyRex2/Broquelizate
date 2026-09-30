import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  const stripeSecret = import.meta.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecret) {
    return new Response(JSON.stringify({ 
      error: 'Stripe secret key is not configured' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-05-28.basil",
  });

  try {
    const body = await request.json();
    const { products, shippingAddress, successUrl, cancelUrl, customerEmail } = body;

    // Optimizar datos: acortar nombres y eliminar imágenes
    let optimizedProducts = products.map(p => ({
      n: p.name.length > 30 ? p.name.substring(0, 27) + '...' : p.name, // Acortar nombres
      p: p.price,
      q: p.quantity,
      // Eliminamos las imágenes para reducir tamaño
    }));

    // Convertir a JSON y verificar longitud
    let productsString = JSON.stringify(optimizedProducts);
    
    // Si aún excede, reducir más los nombres
    if (productsString.length > 450) {
      optimizedProducts = products.map(p => ({
        n: p.name.length > 20 ? p.name.substring(0, 17) + '...' : p.name,
        p: p.price,
        q: p.quantity,
      }));
      productsString = JSON.stringify(optimizedProducts);
    }

    const metadata = {
      p: productsString,
      e: customerEmail
    };

    // Validación final de tamaño
    if (productsString.length > 500) {
      // Plan B: almacenar solo IDs
      const idsOnly = products.map(p => p.id);
      metadata.p = JSON.stringify(idsOnly);
    }

    // Validar productos
    if (!Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid products' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear línea de productos para Stripe
    const lineItems = products.map(product => ({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: product.name,
          images: product.image ? [product.image] : []
        },
        unit_amount: Math.round(product.price * 100),
      },
      quantity: product.quantity,
    }));

    // Obtener tarifas de envío
    const standardShippingRateId = import.meta.env.STRIPE_STANDARD_SHIPPING_ID;
    const expressShippingRateId = import.meta.env.STRIPE_EXPRESS_SHIPPING_ID;

    // Crear sesión de Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ['MX'],
      },
      metadata: metadata,
      shipping_options: [
        { shipping_rate: standardShippingRateId },
        { shipping_rate: expressShippingRateId },
      ],
      phone_number_collection: { enabled: true },
      customer_email: customerEmail,
    });

    return new Response(JSON.stringify({ 
      sessionId: session.id 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error creating Checkout session:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error creating Checkout session' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
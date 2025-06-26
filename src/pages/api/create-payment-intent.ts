import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  const stripeSecret = import.meta.env.STRIPE_SECRET_KEY;
  // Verificar que la clave secreta está definida
  if (!stripeSecret) {
    return new Response(JSON.stringify({ 
      error: 'Stripe secret key is not configured' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil', // Usa la última versión estable
  });

  try {
    const body = await request.json();
    const { amount, currency = 'mxn' } = body;

    // Validar el monto
    if (typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid amount' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Crear PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        tax: body.tax || 0,
        subtotal: body.subtotal || 0
      }
    });

    return new Response(JSON.stringify({ 
      clientSecret: paymentIntent.client_secret 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error creating PaymentIntent' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
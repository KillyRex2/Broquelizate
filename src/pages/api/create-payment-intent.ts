// src/pages/api/create-payment-intent.ts
import type { APIRoute } from 'astro';
import Stripe from 'stripe';

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variantCombination?: string;
  variantSku?: string;
}

interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}

interface ShippingInfo {
  carrier: string;
  service: string;
  price: number;
  deliveryDays: number;
}

interface PaymentIntentRequest {
  products: Product[];
  subtotal: number;
  shippingCost: number;
  total: number;
  customerEmail: string;
  customerName: string;
  shippingAddress: ShippingAddress;
  shippingInfo: ShippingInfo | null;
}

export const POST: APIRoute = async ({ request }) => {
  const stripeSecret = import.meta.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecret) {
    console.error('❌ STRIPE_SECRET_KEY no está configurada');
    return new Response(JSON.stringify({ 
      error: 'Stripe no está configurado correctamente' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-04-30.basil",
  });

  try {
    const body: PaymentIntentRequest = await request.json();
    
    const { 
      products, 
      subtotal, 
      shippingCost, 
      total, 
      customerEmail, 
      customerName,
      shippingAddress, 
      shippingInfo 
    } = body;

    console.log('📦 Creando PaymentIntent:', {
      subtotal,
      shippingCost,
      total,
      customerEmail,
      productsCount: products?.length
    });

    // Validaciones
    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No hay productos en el carrito' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (typeof total !== 'number' || total <= 0) {
      return new Response(JSON.stringify({ 
        error: 'El total debe ser mayor a 0' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!customerEmail) {
      return new Response(JSON.stringify({ 
        error: 'El email del cliente es requerido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convertir a centavos para Stripe (MXN usa centavos)
    const amountInCents = Math.round(total * 100);

    // Preparar metadata (máximo 500 caracteres por valor)
    const productsSummary = products.map(p => ({
      id: p.id,
      n: p.name.substring(0, 30),
      p: p.price,
      q: p.quantity,
      v: p.variantCombination?.substring(0, 20) || null
    }));

    let productsMetadata = JSON.stringify(productsSummary);
    
    // Si excede el límite, simplificar
    if (productsMetadata.length > 450) {
      productsMetadata = JSON.stringify(products.map(p => ({
        id: p.id,
        q: p.quantity
      })));
    }

    // Crear o buscar cliente en Stripe
    let customer: Stripe.Customer | null = null;
    
    try {
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        // Actualizar nombre si es necesario
        if (customerName && customer.name !== customerName) {
          customer = await stripe.customers.update(customer.id, {
            name: customerName
          });
        }
      } else {
        customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || undefined,
          address: {
            line1: shippingAddress.line1,
            line2: shippingAddress.line2 || undefined,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.postal_code,
            country: shippingAddress.country || 'MX'
          },
          phone: shippingAddress.phone || undefined
        });
      }
    } catch (customerError) {
      console.warn('⚠️ No se pudo crear/buscar cliente:', customerError);
      // Continuar sin cliente
    }

    // Crear PaymentIntent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'mxn',
      automatic_payment_methods: { 
        enabled: true,
        allow_redirects: 'never' // Solo métodos que no requieren redirección
      },
      receipt_email: customerEmail,
      description: `Pedido Broquelizate - ${products.length} producto(s)`,
      metadata: {
        products: productsMetadata,
        subtotal: subtotal.toString(),
        shipping_cost: shippingCost.toString(),
        shipping_carrier: shippingInfo?.carrier || 'N/A',
        shipping_service: shippingInfo?.service || 'N/A',
        shipping_days: shippingInfo?.deliveryDays?.toString() || 'N/A',
        customer_email: customerEmail
      },
      shipping: {
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country || 'MX'
        },
        name: customerName || customerEmail,
        carrier: shippingInfo?.carrier || undefined,
        phone: shippingAddress.phone || undefined
      }
    };

    // Asociar cliente si existe
    if (customer) {
      paymentIntentData.customer = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log('✅ PaymentIntent creado:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status
    });

    return new Response(JSON.stringify({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('❌ Error creando PaymentIntent:', error);
    
    // Manejar errores específicos de Stripe
    if (error.type === 'StripeCardError') {
      return new Response(JSON.stringify({ 
        error: error.message || 'Error con la tarjeta'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return new Response(JSON.stringify({ 
        error: 'Solicitud inválida: ' + (error.message || 'Error desconocido')
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Error al procesar el pago' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

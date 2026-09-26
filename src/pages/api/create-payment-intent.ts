// src/pages/api/create-payment-intent.ts
//
// El monto del PaymentIntent lo calcula el SERVIDOR (priceCheckout):
// precios desde la base + envío desde la cotización guardada.
// Antes se cobraba el `total` que mandaba el navegador, que es
// manipulable (se podía pagar $1 por un pedido completo).
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { CheckoutError, priceCheckout, toIncomingItems, AMOUNT_TOLERANCE, formatMXN } from '@/utils/checkout';

interface ShippingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
}

interface PaymentIntentRequest {
  products: unknown[];
  /** Total que ve el cliente; solo se usa para avisarle si cambió. */
  total?: number;
  customerEmail: string;
  customerName?: string;
  shippingAddress?: ShippingAddress;
  shippingInfo?: { quoteId?: string; carrier?: string; service?: string } | null;
  /** 'delivery' | 'pickup' */
  deliveryMethod?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const stripeSecret = import.meta.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    console.error('❌ STRIPE_SECRET_KEY no está configurada');
    return json({ error: 'Stripe no está configurado correctamente' }, 500);
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2025-04-30.basil",
  });

  try {
    const body: PaymentIntentRequest = await request.json();
    const customerEmail = String(body.customerEmail || '').trim();
    const customerName = body.customerName || '';
    const shippingAddress: ShippingAddress = body.shippingAddress || {};

    if (!customerEmail) return json({ error: 'El email del cliente es requerido' }, 400);

    // ── Total real, calculado aquí ──
    const checkout = await priceCheckout({
      products: toIncomingItems(body.products),
      deliveryMethod: body.deliveryMethod,
      shipping: body.shippingInfo,
      destinationPostalCode: shippingAddress.postal_code,
      checkStock: true, // sin existencias no se cobra
    });

    // Si lo que ve el cliente no es lo que se le va a cobrar, se le avisa antes.
    const clientTotal = Number(body.total);
    if (Number.isFinite(clientTotal) && Math.abs(clientTotal - checkout.total) > AMOUNT_TOLERANCE) {
      return json({
        error: `El total de tu pedido cambió a ${formatMXN(checkout.total)}. Recarga la página para ver el monto actualizado.`,
        total: checkout.total,
      }, 409);
    }

    const isPickup = checkout.deliveryMethod === 'pickup';
    const amountInCents = Math.round(checkout.total * 100);

    // Metadata (máx. 500 caracteres por valor)
    let productsMetadata = JSON.stringify(checkout.items.map(i => ({
      id: i.productId, q: i.quantity, c: i.combinationId || null, p: i.unitPrice,
    })));
    if (productsMetadata.length > 450) {
      productsMetadata = JSON.stringify(checkout.items.map(i => ({ id: i.productId, q: i.quantity })));
    }
    if (productsMetadata.length > 490) productsMetadata = `${checkout.items.length} productos`;

    // Crear o buscar cliente en Stripe
    let customer: Stripe.Customer | null = null;
    try {
      const existingCustomers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        if (customerName && customer.name !== customerName) {
          customer = await stripe.customers.update(customer.id, { name: customerName });
        }
      } else {
        customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || undefined,
          // En "Recoger en tienda" no hay domicilio del cliente
          address: isPickup ? undefined : {
            line1: shippingAddress.line1 || '',
            line2: shippingAddress.line2 || undefined,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postal_code: shippingAddress.postal_code,
            country: shippingAddress.country || 'MX',
          },
          phone: shippingAddress.phone || undefined,
        });
      }
    } catch (customerError) {
      console.warn('⚠️ No se pudo crear/buscar cliente:', customerError);
    }

    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'mxn',
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      receipt_email: customerEmail,
      description: `Pedido Broquelizate - ${checkout.itemsCount} producto(s)`,
      metadata: {
        products: productsMetadata,
        subtotal: checkout.subtotal.toString(),
        shipping_cost: checkout.shipping.shippingCost.toString(),
        shipping_carrier: checkout.shipping.carrier || 'N/A',
        shipping_service: checkout.shipping.service || 'N/A',
        shipping_days: checkout.shipping.deliveryDays?.toString() || 'N/A',
        shipping_quote_id: body.shippingInfo?.quoteId || 'N/A',
        delivery_method: checkout.deliveryMethod,
        customer_email: customerEmail,
      },
      shipping: isPickup ? undefined : {
        address: {
          line1: shippingAddress.line1 || '',
          line2: shippingAddress.line2 || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country || 'MX',
        },
        name: customerName || customerEmail,
        carrier: checkout.shipping.carrier || undefined,
        phone: shippingAddress.phone || undefined,
      },
    };

    if (customer) paymentIntentData.customer = customer.id;

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log('✅ PaymentIntent creado:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status,
    });

    return json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      total: checkout.total,
    });
  } catch (error: any) {
    if (error instanceof CheckoutError) {
      return json({ error: error.message }, error.status);
    }

    console.error('❌ Error creando PaymentIntent:', error);

    if (error.type === 'StripeCardError') {
      return json({ error: error.message || 'Error con la tarjeta' }, 400);
    }
    if (error.type === 'StripeInvalidRequestError') {
      return json({ error: 'Solicitud inválida: ' + (error.message || 'Error desconocido') }, 400);
    }
    return json({ error: error.message || 'Error al procesar el pago' }, 500);
  }
};

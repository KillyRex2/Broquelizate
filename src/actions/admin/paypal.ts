import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { CheckoutError, priceCheckout, toIncomingItems, AMOUNT_TOLERANCE, formatMXN } from '@/utils/checkout';
// --- Constantes de Configuración ---
const PAYPAL_CLIENT_ID = import.meta.env.PUBLIC_PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = import.meta.env.PAYPAL_CLIENT_SECRET;
// ✅ CORRECCIÓN: Se actualiza la URL al endpoint de producción de PayPal.
const PAYPAL_API_BASE = 'https://api-m.paypal.com'; 

// --- Función Auxiliar para Autenticación ---
// Obtiene un token de acceso de la API de PayPal.
async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('Credenciales de PayPal no configuradas en las variables de entorno.');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Error al obtener token de PayPal:', errorBody);
    throw new Error('No se pudo autenticar con PayPal.');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Consulta una orden de PayPal y devuelve cuánto se capturó realmente.
 * La usa /api/create-order para verificar el pago antes de registrar el pedido.
 */
export async function getPaypalPayment(orderId: string): Promise<{ ok: boolean; amount: number; status: string }> {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('Error consultando orden de PayPal:', data);
    return { ok: false, amount: 0, status: 'UNKNOWN' };
  }

  const captures = (data.purchase_units || [])
    .flatMap((u: any) => u?.payments?.captures || [])
    .filter((c: any) => c?.status === 'COMPLETED' && c?.amount?.currency_code === 'MXN');
  const amount = captures.reduce((s: number, c: any) => s + (parseFloat(c.amount.value) || 0), 0);

  return { ok: data.status === 'COMPLETED' && amount > 0, amount, status: data.status };
}

// --- Acción para Crear una Orden en PayPal ---
// El monto lo calcula el servidor (antes se cobraba el `total` del navegador).
export const createPaypalOrder = defineAction({
  accept: 'json',
  input: z.object({
    /** Total que ve el cliente; solo para avisarle si cambió. */
    total: z.number().optional(),
    products: z.array(z.object({
      id: z.string(),
      quantity: z.number(),
      combinationId: z.string().nullish(),
      variantId: z.string().nullish(),
    }).passthrough()).min(1, 'El carrito está vacío.'),
    deliveryMethod: z.string().optional(),
    shippingInfo: z.object({
      quoteId: z.string().nullish(),
      carrier: z.string().nullish(),
      service: z.string().nullish(),
    }).passthrough().nullish(),
    postalCode: z.string().optional(),
  }),
  handler: async (input) => {
    let total: number;
    try {
      const checkout = await priceCheckout({
        products: toIncomingItems(input.products),
        deliveryMethod: input.deliveryMethod,
        shipping: input.shippingInfo,
        destinationPostalCode: input.postalCode,
        checkStock: true,
      });
      total = checkout.total;
    } catch (e) {
      if (e instanceof CheckoutError) throw new ActionError({ code: 'BAD_REQUEST', message: e.message });
      throw e;
    }

    if (input.total != null && Math.abs(input.total - total) > AMOUNT_TOLERANCE) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: `El total de tu pedido cambió a ${formatMXN(total)}. Recarga la página para ver el monto actualizado.`,
      });
    }

    try {
      const accessToken = await getPayPalAccessToken();
      const url = `${PAYPAL_API_BASE}/v2/checkout/orders`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'MXN', // Moneda
              value: total.toFixed(2), // Total del carrito, formateado a 2 decimales
            },
          }],
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        console.error('Error de la API de PayPal al crear orden:', data);
        throw new Error(data.message || 'Error al crear la orden en PayPal.');
      }
      
      return { orderId: data.id, total };

    } catch (error) {
      console.error("Error en createPaypalOrder:", error);
      // Lanza el error para que el frontend lo capture y muestre un mensaje
      throw error; 
    }
  },
});

// --- Acción para Capturar el Pago ---
export const capturePaypalOrder = defineAction({
    accept: 'json',
    input: z.object({
      orderId: z.string(),
    }),
    handler: async ({ orderId }) => {
      try {
        const accessToken = await getPayPalAccessToken();
        const url = `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`;
  
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });
  
        const data = await response.json();
  
        if (!response.ok || data.status !== 'COMPLETED') {
          console.error('Error de la API de PayPal al capturar pago:', data);
          throw new Error(data.message || 'No se pudo capturar el pago.');
        }

        // El pago fue exitoso
        return { success: true, details: data };
  
      } catch (error) {
        console.error("Error en capturePaypalOrder:", error);
        throw error;
      }
    },
});


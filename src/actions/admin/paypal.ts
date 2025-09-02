import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
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

// --- Acción para Crear una Orden en PayPal ---
export const createPaypalOrder = defineAction({
  accept: 'json',
  input: z.object({
    total: z.number().min(0.01, 'El total debe ser mayor a cero.'),
  }),
  handler: async ({ total }) => {
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
      
      return { orderId: data.id };

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


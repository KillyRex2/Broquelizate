import { defineAction} from 'astro:actions';
import { z } from 'astro:schema'

// Helper function to get a PayPal access token
async function getPaypalAccessToken() {
  const clientId = import.meta.env.PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = import.meta.env.PAYPAL_CLIENT_SECRET;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

// --- Action to create a PayPal order ---
// Defined as an exported constant for individual import.
export const createPaypalOrder = defineAction({
  input: z.object({
    total: z.number(),
  }),
  handler: async ({ total }: { total: number }) => {
    const accessToken = await getPaypalAccessToken();
    const url = 'https://api-m.sandbox.paypal.com/v2/checkout/orders';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'MXN', // Change if needed
            value: total.toFixed(2),
          },
        }],
      }),
    });

    if (!response.ok) {
      console.error('PayPal API Error:', await response.text());
      throw new Error('Failed to create PayPal order');
    }

    const data = await response.json();
    return { orderId: data.id };
  },
});

// --- Action to capture the payment after user approval ---
// Also defined as an exported constant.
export const capturePaypalOrder = defineAction({
  input: z.object({
    orderId: z.string(),
  }),
  handler: async ({ orderId }: { orderId: string }) => {
    const accessToken = await getPaypalAccessToken();
    const url = `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('PayPal Capture Error:', await response.text());
      throw new Error('Failed to capture PayPal payment');
    }
    
    const data = await response.json();
    // Here you would typically save the transaction details to your database
    
    return { success: true, details: data };
  },
});

// --- Server object for Astro Actions ---
// This object groups the exported actions for Astro's internal use.
export const server = {
  createPaypalOrder,
  capturePaypalOrder,
};

// src/pages/api/verify-mercadopago-payment.ts
import type { APIRoute } from 'astro';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Verifica un pago de Mercado Pago consultando la API con el access token del
// servidor. NUNCA confíes en el `status` que viene en la URL de retorno: ese
// valor es manipulable por el usuario. La fuente de verdad es esta consulta.
export const GET: APIRoute = async ({ url }) => {
  const accessToken = import.meta.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Mercado Pago no configurado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const paymentId = url.searchParams.get('payment_id');
  if (!paymentId) {
    return new Response(JSON.stringify({ error: 'Falta payment_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });

  try {
    const payment = await new Payment(client).get({ id: paymentId });

    return new Response(
      JSON.stringify({
        paymentId: payment.id,
        // approved | pending | in_process | rejected | cancelled | refunded ...
        status: payment.status,
        statusDetail: payment.status_detail,
        externalReference: payment.external_reference,
        amount: payment.transaction_amount,
        paymentMethodId: payment.payment_method_id, // visa, master, oxxo, account_money, etc.
        paymentTypeId: payment.payment_type_id, // credit_card, ticket, bank_transfer, ...
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error verificando pago MP:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'No se pudo verificar el pago' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
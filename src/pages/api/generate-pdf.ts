import type { APIRoute } from 'astro';
import { generateTicket } from '@/services/ticketGenerator';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Leer los datos del cuerpo de la solicitud
    const data = await request.json();
    
    // Validar los datos mínimos requeridos
    if (!data.products || !Array.isArray(data.products)) {
      return new Response(JSON.stringify({ error: 'Datos de productos inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Preparar datos para generar el ticket
    const ticketProducts = data.products.map((product: any) => ({
      name: product.name,
      quantity: product.quantity,
      price: product.price
    }));

    // Generar el PDF
    const pdfDoc = generateTicket(
      ticketProducts,
      data.tax || 0,
      data.total || 0,
      {
        name: data.storeInfo?.name || "Broquelízate La Laguna",
        address: data.storeInfo?.address || "Esquina con, Calle Escobedo, Bravo 222",
        phone: data.storeInfo?.phone || "+52 871 461 7696",
        rfc: data.storeInfo?.rfc || "XAXX010101000"
      }
    );

    // Crear un buffer para el PDF
    const pdfBuffer = await new Promise<Uint8Array>((resolve, reject) => {
      try {
        pdfDoc.getBuffer((buffer: Buffer) => {
          resolve(new Uint8Array(buffer));
        });
      } catch (error) {
        reject(error);
      }
    });

    // Crear una respuesta con el PDF
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=recibo-${data.orderId || 'orden'}.pdf`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Error generando PDF:', error);
    return new Response(JSON.stringify({ 
      error: 'Error interno al generar el PDF', 
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
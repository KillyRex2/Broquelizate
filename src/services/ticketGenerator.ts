import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

// Configurar fuentes. vfs es necesario para que pdfmake funcione en el navegador.
pdfMake.vfs = pdfFonts.vfs;

// Usaremos Roboto, que ya está incluido en pdfFonts.vfs y no necesita ser declarado.

// --- INTERFACES Y TIPOS ---
interface Product {
  name: string;
  quantity: number;
  price: number;
}

interface StoreInfo {
  name:string;
  address: string;
  phone: string;
}

// --- FUNCIÓN AUXILIAR PARA CONVERTIR IMAGEN A BASE64 ---
const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo obtener el contexto del canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL("image/png");
      resolve(dataURL);
    };
    img.onerror = (error) => reject(new Error(`Error al cargar la imagen: ${error}`));
    img.src = url;
  });
};

// --- FUNCIÓN PRINCIPAL PARA GENERAR Y MOSTRAR EL TICKET ---
export const generateAndPrintTicket = async (
  products: Product[],
  total: number,
  orderNumber: string,
  paymentMethod: string,
  storeInfo: StoreInfo,
  // ✅ NUEVO: Parámetros opcionales para descuentos, montos y observaciones
  discount?: number,
  addedMount?: number,
  observations?: string
): Promise<void> => {
  try {
    // 1. Obtener el logo y convertirlo a Base64
    const logoUrl = '/assets/Broquelizate-logos/logo-relleno-negro.png';
    const logoBase64 = await getBase64ImageFromURL(logoUrl);

    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const uniqueItems = products.length;
    const date = new Date().toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    // ✅ NUEVO: Calcular subtotal a partir de los productos
    const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);

    // ✅ CORRECCIÓN: Tipar explícitamente totalsBody como Content[][] para evitar errores de inferencia de tipo.
    const totalsBody: Content[][] = [
      // Fila de Subtotal
      [{ text: 'Subtotal:', style: 'totalLabel', alignment: 'right' }, { text: `$${subtotal.toFixed(2)}`, style: 'totalAmount', alignment: 'right' }],
    ];

    // Añadir fila de Descuento si existe y es mayor a 0
    if (discount && discount > 0) {
      totalsBody.push([
        { text: 'Descuento:', style: 'totalLabel', alignment: 'right' }, 
        { text: `-$${discount.toFixed(2)}`, style: 'discountAmount', alignment: 'right' }
      ]);
    }

    // Añadir fila de Monto Agregado si existe y es mayor a 0
    if (addedMount && addedMount > 0) {
      totalsBody.push([
        { text: 'Monto Agregado:', style: 'totalLabel', alignment: 'right' }, 
        { text: `$${addedMount.toFixed(2)}`, style: 'addedAmount', alignment: 'right' }
      ]);
    }
    
    // Línea separadora antes del total final
    totalsBody.push([
        { 
            canvas: [{ type: 'line', x1: 0, y1: 2, x2: 120, y2: 2, lineWidth: 0.5, lineColor: '#555555' }], 
            colSpan: 2, 
            alignment: 'right', 
            border: [false, false, false, false], 
            margin: [0, 2, 0, 2] 
        } as Content, // ✅ CORRECCIÓN: Se añade una aserción de tipo para resolver el error de TS.
        '' // Usar un string vacío como placeholder para la celda expandida.
    ]);

    // Fila de Total Final y Método de Pago
    totalsBody.push(
      [{ text: 'Total:', style: 'finalTotalLabel', alignment: 'right' }, { text: `$${total.toFixed(2)}`, style: 'finalTotalAmount', alignment: 'right' }],
      [{ text: `${paymentMethod}:`, style: 'paymentMethodLabel', alignment: 'right' }, { text: `$${total.toFixed(2)}`, style: 'paymentMethodAmount', alignment: 'right' }]
    );

    // ✅ NUEVO: Construir el contenido principal del PDF
    const content: Content[] = [
      { image: logoBase64, width: 70, alignment: 'center', margin: [0, 0, 0, 8] },
      { text: `RECIBO #${orderNumber}`, style: 'receiptNumber', alignment: 'center', margin: [0, 0, 0, 12] },
      { stack: [{ text: storeInfo.name, style: 'storeName' }, { text: storeInfo.address, style: 'storeInfo' }, { text: `+${storeInfo.phone}`, style: 'storeInfo' }], alignment: 'center', margin: [0, 0, 0, 12] },
      { text: `${uniqueItems} Item(s) (Total Pzas: ${totalQuantity})`, style: 'itemCount', margin: [0, 0, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 205, y2: 5, lineWidth: 1, lineColor: '#000000' }], margin: [0, 4, 0, 8] },
      {
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 6, paddingBottom: () => 6 },
        table: {
          widths: ['*', 'auto'],
          body: products.map(product => [
            { text: [{ text: `${product.quantity}x `, style: 'quantity' }, { text: `${product.name}`, style: 'productName' }, { text: ' (pieza)', style: 'pieceText' }], border: [false, false, false, false] },
            { text: `$${(product.price * product.quantity).toFixed(2)}`, style: 'price', alignment: 'right', border: [false, false, false, false] },
          ])
        }
      },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 205, y2: 5, lineWidth: 1, dash: { length: 2 }, lineColor: '#555555' }], margin: [0, 4, 0, 8] },
      {
        layout: 'noBorders',
        table: {
          widths: ['*', 'auto'],
          body: totalsBody
        }
      },
    ];

    // ✅ NUEVO: Añadir sección de observaciones si existe
    if (observations) {
      content.push(
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 205, y2: 5, lineWidth: 1, dash: { length: 2 }, lineColor: '#555555' }], margin: [0, 10, 0, 8] },
        { text: 'OBSERVACIONES', style: 'observationsLabel', alignment: 'center', margin: [0, 0, 0, 4] },
        { text: observations, style: 'observationsText', alignment: 'left', margin: [0, 0, 0, 10] }
      );
    }
    
    // Añadir pie de página
    content.push(
      { text: '¡Gracias por tu compra!', style: 'footer', alignment: 'center', margin: [0, 20, 0, 2] },
      { text: date, style: 'footerDate', alignment: 'center' }
    );

    // 2. Definir la estructura del documento
    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: 226.77, height: 'auto' }, // Ancho de ticket de 80mm
      pageMargins: [10, 10, 10, 10],
      content: content,
      styles: {
        receiptNumber: { fontSize: 10, bold: true },
        storeName: { fontSize: 10, bold: true, alignment: 'center' },
        storeInfo: { fontSize: 9, color: '#333333', alignment: 'center' },
        itemCount: { fontSize: 10, bold: true },
        quantity: { fontSize: 10, color: '#555555' },
        productName: { fontSize: 10, bold: true },
        pieceText: { fontSize: 10, color: '#555555' },
        price: { fontSize: 10, bold: true },
        // Estilos de totales
        totalLabel: { fontSize: 10, bold: false },
        totalAmount: { fontSize: 10, bold: true },
        discountAmount: { fontSize: 10, bold: true, color: 'green' },
        addedAmount: { fontSize: 10, bold: true, color: 'red' },
        finalTotalLabel: { fontSize: 12, bold: true },
        finalTotalAmount: { fontSize: 12, bold: true },
        // Estilos de pago
        paymentMethodLabel: { fontSize: 9, color: '#333333' },
        paymentMethodAmount: { fontSize: 9, color: '#333333' },
        // ✅ NUEVO: Estilos para observaciones
        observationsLabel: { fontSize: 10, bold: true, italics: true },
        observationsText: { fontSize: 9, color: '#333333' },
        // Estilos de pie de página
        footer: { fontSize: 10, italics: true },
        footerDate: { fontSize: 8, color: '#555555' },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#000000' }
    };
    
    // 3. Crear y abrir el documento PDF
    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.open();

  } catch (error) {
    console.error("Error al generar o imprimir el ticket:", error);
    // Evitar usar alert en producción, es mejor un sistema de notificaciones
    // alert("No se pudo generar el ticket. Por favor, revisa la consola para más detalles.");
  }
};

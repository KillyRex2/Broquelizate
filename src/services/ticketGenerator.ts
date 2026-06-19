import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

pdfMake.vfs = pdfFonts.vfs;

// --- INTERFACES Y TIPOS ---
interface Product {
  name: string;
  quantity: number;
  price: number;
  engraving?: { id: string; imageUrl: string; notes: string } | null;
}

interface StoreInfo {
  name: string;
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
  discount?: number,
  addedMount?: number,
  observations?: string,
  amountReceived?: number,
  change?: number
): Promise<void> => {
  try {
    const logoUrl = '/assets/Broquelizate-logos/logo-relleno-negro.png';
    const logoBase64 = await getBase64ImageFromURL(logoUrl);

    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const uniqueItems = products.length;
    const date = new Date().toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const hasEngravings = products.some(p => p.engraving);

    const totalsBody: Content[][] = [
      [{ text: 'Subtotal:', style: 'totalLabel', alignment: 'right' }, { text: `$${subtotal.toFixed(2)}`, style: 'totalAmount', alignment: 'right' }],
    ];

    if (discount && discount > 0) {
      totalsBody.push([
        { text: 'Descuento:', style: 'totalLabel', alignment: 'right' }, 
        { text: `-$${discount.toFixed(2)}`, style: 'discountAmount', alignment: 'right' }
      ]);
    }

    if (addedMount && addedMount > 0) {
      totalsBody.push([
        { text: 'Monto Agregado:', style: 'totalLabel', alignment: 'right' }, 
        { text: `$${addedMount.toFixed(2)}`, style: 'addedAmount', alignment: 'right' }
      ]);
    }
    
    totalsBody.push([
      { 
        canvas: [{ type: 'line', x1: 0, y1: 2, x2: 120, y2: 2, lineWidth: 0.5, lineColor: '#555555' }], 
        colSpan: 2, 
        alignment: 'right', 
        border: [false, false, false, false], 
        margin: [0, 2, 0, 2] 
      } as Content,
      ''
    ]);

    totalsBody.push(
      [{ text: 'Total:', style: 'finalTotalLabel', alignment: 'right' }, { text: `$${total.toFixed(2)}`, style: 'finalTotalAmount', alignment: 'right' }],
      [{ text: `${paymentMethod}:`, style: 'paymentMethodLabel', alignment: 'right' }, { text: `$${total.toFixed(2)}`, style: 'paymentMethodAmount', alignment: 'right' }]
    );

    // Recibido y Feria (cambio) — solo si aplica
    if (typeof amountReceived === 'number' && amountReceived > 0) {
      totalsBody.push([
        { text: 'Recibido:', style: 'paymentMethodLabel', alignment: 'right' },
        { text: `$${amountReceived.toFixed(2)}`, style: 'paymentMethodAmount', alignment: 'right' }
      ]);
    }
    if (typeof change === 'number' && change > 0) {
      totalsBody.push([
        { text: 'Feria:', style: 'finalTotalLabel', alignment: 'right' },
        { text: `$${change.toFixed(2)}`, style: 'finalTotalAmount', alignment: 'right' }
      ]);
    }

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
          body: products.flatMap(product => {
            const rows: any[][] = [
              [
                { text: [{ text: `${product.quantity}x `, style: 'quantity' }, { text: `${product.name}`, style: 'productName' }, { text: ' (pieza)', style: 'pieceText' }] },
                { text: `$${(product.price * product.quantity).toFixed(2)}`, style: 'price', alignment: 'right' },
              ]
            ];
            if (product.engraving) {
              rows.push([
                { text: [{ text: '  GRABADO LÁSER', style: 'engravingLabel' }, ...(product.engraving.notes ? [{ text: `: ${product.engraving.notes}`, style: 'engravingNotes' }] : [])], colSpan: 2 },
                ''
              ]);
            }
            return rows;
          })
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

    // Sección resumen de grabado láser
    if (hasEngravings) {
      const engravingProducts = products.filter(p => p.engraving);
      content.push(
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 205, y2: 5, lineWidth: 1, dash: { length: 2 }, lineColor: '#555555' }], margin: [0, 10, 0, 8] },
        { text: 'GRABADO LÁSER', style: 'engravingSectionTitle', alignment: 'center', margin: [0, 0, 0, 6] },
        { text: `${engravingProducts.length} producto(s) con grabado personalizado`, style: 'engravingSectionSub', alignment: 'center', margin: [0, 0, 0, 6] },
        ...engravingProducts.map((p, idx) => ({
          stack: [
            { text: `${idx + 1}. ${p.name} (x${p.quantity})`, style: 'engravingProductName', margin: [0, 4, 0, 2] as [number, number, number, number] },
            ...(p.engraving?.notes ? [{ text: `   Nota: "${p.engraving.notes}"`, style: 'engravingNotes', margin: [0, 0, 0, 2] as [number, number, number, number] }] : []),
          ]
        }) as Content)
      );
    }

    // Sección de observaciones
    if (observations) {
      content.push(
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 205, y2: 5, lineWidth: 1, dash: { length: 2 }, lineColor: '#555555' }], margin: [0, 10, 0, 8] },
        { text: 'OBSERVACIONES', style: 'observationsLabel', alignment: 'center', margin: [0, 0, 0, 4] },
        { text: observations, style: 'observationsText', alignment: 'left', margin: [0, 0, 0, 10] }
      );
    }
    
    // Pie de página
    content.push(
      { text: '¡Gracias por tu compra!', style: 'footer', alignment: 'center', margin: [0, 20, 0, 2] },
      { text: date, style: 'footerDate', alignment: 'center' }
    );

    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: 226.77, height: 'auto' },
      pageMargins: [10, 10, 10, 10],
      content: content,
      styles: {
        receiptNumber: { fontSize: 10, bold: true },
        storeName: { fontSize: 10, bold: true, alignment: 'center' },
        storeInfo: { fontSize: 9, color: '#000', alignment: 'center' },
        itemCount: { fontSize: 10, bold: true },
        quantity: { fontSize: 10, color: '#000' },
        productName: { fontSize: 10, bold: true },
        pieceText: { fontSize: 10, color: '#000' },
        price: { fontSize: 10, bold: true },
        engravingLabel: { fontSize: 8, bold: true, color: '#B45309' },
        engravingNotes: { fontSize: 8, italics: true, color: '#92400E' },
        engravingSectionTitle: { fontSize: 10, bold: true, color: '#B45309' },
        engravingSectionSub: { fontSize: 8, color: '#92400E' },
        engravingProductName: { fontSize: 9, bold: true, color: '#000' },
        totalLabel: { fontSize: 10, bold: false },
        totalAmount: { fontSize: 10, bold: true },
        discountAmount: { fontSize: 10, bold: true, color: 'green' },
        addedAmount: { fontSize: 10, bold: true, color: 'red' },
        finalTotalLabel: { fontSize: 12, bold: true },
        finalTotalAmount: { fontSize: 12, bold: true },
        paymentMethodLabel: { fontSize: 9, color: '#000' },
        paymentMethodAmount: { fontSize: 9, color: '#000' },
        observationsLabel: { fontSize: 10, bold: true, italics: true },
        observationsText: { fontSize: 9, color: '#000' },
        footer: { fontSize: 10, italics: true },
        footerDate: { fontSize: 8, color: '#000' },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#000' }
    };
    
    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.open();

  } catch (error) {
    console.error("Error al generar o imprimir el ticket:", error);
  }
};
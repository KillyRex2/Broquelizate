import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Configurar fuentes
pdfMake.vfs = pdfFonts.vfs;

// Definir las fuentes disponibles
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  },
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Definir interfaces para tipado
interface Product {
  name: string;
  quantity: number;
  price: number;
}

interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  rfc?: string;
}

// Definir tipo para el documento PDF
type PdfDocument = ReturnType<typeof pdfMake.createPdf>;

// Tipo para márgenes (tupla de 4 números)
type Margin = [number, number, number, number];

// MODIFICADO: La firma de la función ahora acepta los nuevos valores.
export const generateTicket = (
  products: Product[],
  discount: number,
  additionalCharges: number,
  total: number,
  storeInfo: StoreInfo
): PdfDocument => {
  const subtotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  const pageMargins: Margin = [1, 8, 1, 8];
  const printableWidth = 226.77 - pageMargins[0] - pageMargins[2];

  const compactTableLayout = {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 0 : 2),
      paddingRight: (i: number, node: any) => (i === node.table.widths.length - 1 ? 0 : 2),
      paddingTop: () => 1,
      paddingBottom: () => 1,
  };

  // --- Contenido del Ticket ---
  const content = [
    // Encabezado (sin cambios)
    { text: storeInfo.name, style: 'header', alignment: 'center' as const },
    { text: storeInfo.address, style: 'subheader', alignment: 'center' as const },
    { text: `Tel: ${storeInfo.phone}`, style: 'subheader', alignment: 'center' as const },
    { text: `RFC: ${storeInfo.rfc || 'XAXX010101000'}`, style: 'subheader', alignment: 'center' as const },
    
    // Divisor (sin cambios)
    { canvas: [{ type: 'line' as const, x1: 0, y1: 5, x2: printableWidth, y2: 5, lineWidth: 0.5, lineColor: '#555555' }] },
    { text: `FECHA: ${new Date().toLocaleString('es-MX')}`, style: 'date', alignment: 'center' as const },
    { text: 'TICKET DE COMPRA', style: 'title', alignment: 'center' as const },
    { canvas: [{ type: 'line' as const, x1: 0, y1: 5, x2: printableWidth, y2: 5, lineWidth: 0.5, lineColor: '#555555' }] },
    
    // Tabla de Productos (sin cambios)
    {
      layout: compactTableLayout,
      table: {
        widths: ['*', 24, 70],
        body: [
          [
            { text: 'DESCRIPCIÓN', style: 'tableHeader' },
            { text: 'CANT', style: 'tableHeader', alignment: 'center' as const },
            { text: 'IMPORTE', style: 'tableHeader', alignment: 'right' as const }
          ],
          ...products.map(product => [
            { text: product.name, style: 'tableItem' },
            { text: product.quantity.toString(), style: 'tableItem', alignment: 'center' as const },
            { text: `$${(product.price * product.quantity).toFixed(2)}`, style: 'tableItem', alignment: 'right' as const }
          ])
        ]
      },
    },
    
    { canvas: [{ type: 'line' as const, x1: 0, y1: 5, x2: printableWidth, y2: 5, lineWidth: 0.5, lineColor: '#555555' }] },
    
    // --- Tabla de Totales (MODIFICADA) ---
    // Se construye el cuerpo de la tabla dinámicamente para mostrar solo los valores que aplican.
    (() => {
        const totalsBody = [
            // Siempre se muestra el subtotal
            [
                { text: 'SUBTOTAL:', style: 'tableFooter' },
                { text: `$${subtotal.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
            ]
        ];

        // Se añade la fila de Monto Adicional solo si es mayor a cero
        if (additionalCharges > 0) {
            totalsBody.push([
                { text: 'MONTO ADICIONAL:', style: 'tableFooter' },
                { text: `$${additionalCharges.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
            ]);
        }

        // Se añade la fila de Descuento solo si es mayor a cero
        if (discount > 0) {
            totalsBody.push([
                { text: 'DESCUENTO:', style: 'tableFooter'},
                { text: `-$${discount.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
            ]);
        }
        
        // Siempre se muestra el total final
        totalsBody.push([
            { text: 'TOTAL:', style: 'tableFooter'},
            { text: `$${total.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
        ]);

        return {
            layout: 'noBorders',
            table: {
                widths: ['*', 75],
                body: totalsBody
            },
        };
    })(),
    
    // Pie de página (sin cambios)
    { text: '¡GRACIAS POR SU COMPRA!', style: 'footer', alignment: 'center' as const, margin: [0, 15, 0, 2] as Margin },
    { text: 'Vuelva pronto', style: 'footerSmall', alignment: 'center' as const },
  ];
  
  const styles = {
    header:      { fontSize: 9, bold: true, margin: [0, 0, 0, 2] as Margin },
    subheader:   { fontSize: 6, margin: [0, 0, 0, 1] as Margin },
    date:        { fontSize: 6.5, margin: [0, 5, 0, 2] as Margin },
    title:       { fontSize: 8, bold: true, margin: [0, 2, 0, 5] as Margin },
    tableHeader: { fontSize: 7, bold: true, margin: [0, 2, 0, 2] as Margin },
    tableItem:   { fontSize: 6.5, margin: [0, 1, 0, 1] as Margin },
    tableFooter: { fontSize: 8, margin: [0, 1, 0, 1] as Margin },
    footer:      { fontSize: 9, bold: true, italics: true },
    footerSmall: { fontSize: 7, margin: [0, 2, 0, 0] as Margin }
  };
  
  const docDefinition = {
    pageSize: { 
      width: 226.77,
      height: 'auto' as const 
    },
    pageMargins: pageMargins,
    content: content,
    styles: styles,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
      lineHeight: 1.15
    }
  };
  
  return pdfMake.createPdf(docDefinition);
};

// La función de impresión no necesita cambios.
export const printTicket = (pdfDoc: PdfDocument): void => {
  pdfDoc.getBlob((blob: Blob) => {
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        try {
          printWindow.print();
          // Considerar un tiempo de espera más corto si es posible
          setTimeout(() => {
            printWindow.close();
            URL.revokeObjectURL(blobUrl);
          }, 10000); // 5 segundos
        } catch (error) {
          console.error('Error al imprimir:', error);
          printWindow.close();
          URL.revokeObjectURL(blobUrl);
        }
      };
    } else {
      console.error('No se pudo abrir la ventana de impresión. Verifica los bloqueadores de ventanas emergentes.');
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'ticket.pdf';
      link.click();
      URL.revokeObjectURL(blobUrl);
    }
  });
};

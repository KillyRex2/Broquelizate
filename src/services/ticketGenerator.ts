// src/services/ticketGenerator.ts
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
  rfc?: string;  // Opcional
}

// Definir tipo para el documento PDF
type PdfDocument = ReturnType<typeof pdfMake.createPdf>;

// Tipo para márgenes (tupla de 4 números)
type Margin = [number, number, number, number];

export const generateTicket = (
  products: Product[],
  tax: number,
  total: number,
  storeInfo: StoreInfo
): PdfDocument => {
  const subtotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  // Márgenes de página ajustados
  const pageMargins: Margin = [1, 8, 1, 8];
  const printableWidth = 226.77 - pageMargins[0] - pageMargins[2];

  // ✅ 1. LAYOUT PERSONALIZADO PARA REDUCIR ESPACIO ENTRE COLUMNAS
  // Se define un layout que elimina los bordes y controla el padding (espaciado)
  // entre columnas para hacerlo mínimo.
  const compactTableLayout = {
      hLineWidth: () => 0, // Sin líneas horizontales
      vLineWidth: () => 0, // Sin líneas verticales
      // Padding: [izquierda, arriba, derecha, abajo]
      paddingLeft: (i: number) => (i === 0 ? 0 : 2), // Sin padding a la izquierda de la primera columna
      paddingRight: (i: number, node: any) => (i === node.table.widths.length - 1 ? 0 : 2), // Sin padding a la derecha de la última columna
      paddingTop: () => 1,
      paddingBottom: () => 1,
  };

  // --- Contenido del Ticket ---
  const content = [
    // Encabezado
    { text: storeInfo.name, style: 'header', alignment: 'center' as const },
    { text: storeInfo.address, style: 'subheader', alignment: 'center' as const },
    { text: `Tel: ${storeInfo.phone}`, style: 'subheader', alignment: 'center' as const },
    { text: `RFC: ${storeInfo.rfc || 'XAXX010101000'}`, style: 'subheader', alignment: 'center' as const },
    
    // Divisor
    { canvas: [{ type: 'line' as const, x1: 0, y1: 5, x2: printableWidth, y2: 5, lineWidth: 0.5, lineColor: '#555555' }] },

    { text: `FECHA: ${new Date().toLocaleString('es-MX')}`, style: 'date', alignment: 'center' as const },
    { text: 'TICKET DE COMPRA', style: 'title', alignment: 'center' as const },
    
    // Divisor
    { canvas: [{ type: 'line' as const, x1: 0, y1: 5, x2: printableWidth, y2: 5, lineWidth: 0.5, lineColor: '#555555' }] },
    
    // Tabla de Productos
    {
      // ✅ 2. APLICACIÓN DEL LAYOUT PERSONALIZADO
      layout: compactTableLayout,
      table: {
        // ✅ 3. AJUSTE DE ANCHOS CON EL NUEVO ESPACIO GANADO
        widths: ['*', 24, 70], // Antes: ['*', 22, 68]
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
    
    // Divisor
    { canvas: [{ type: 'line' as const, x1: 0, y1: 5, x2: printableWidth, y2: 5, lineWidth: 0.5, lineColor: '#555555' }] },
    
    // Tabla de Totales
    {
      layout: 'noBorders', // El layout por defecto está bien aquí
      table: {
        widths: ['*', 75],
        body: [
          [
            { text: 'SUBTOTAL:', style: 'tableFooter' },
            { text: `$${subtotal.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
          ],
          [
            { text: 'IVA (16%):', style: 'tableFooter' },
            { text: `$${tax.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
          ],
          [
            { text: 'TOTAL:', style: 'tableFooter', bold: true },
            { text: `$${total.toFixed(2)}`, style: 'tableFooter', bold: true, alignment: 'right' as const }
          ]
        ]
      },
    },
    
    // Pie de página
    { text: '¡GRACIAS POR SU COMPRA!', style: 'footer', alignment: 'center' as const, margin: [0, 15, 0, 2] as Margin },
    { text: 'Vuelva pronto', style: 'footerSmall', alignment: 'center' as const },
  ];
  
  // ✅ 4. AJUSTE FINAL DE ESTILOS
  const styles = {
    header:      { fontSize: 9, bold: true, margin: [0, 0, 0, 2] as Margin },
    subheader:   { fontSize: 6, margin: [0, 0, 0, 1] as Margin },
    date:        { fontSize: 6.5, margin: [0, 5, 0, 2] as Margin },
    title:       { fontSize: 8, bold: true, margin: [0, 2, 0, 5] as Margin },
    tableHeader: { fontSize: 7, bold: true, margin: [0, 2, 0, 2] as Margin },
    tableItem:   { fontSize: 6.5, margin: [0, 1, 0, 1] as Margin }, // Reducido ligeramente
    tableFooter: { fontSize: 8, margin: [0, 1, 0, 1] as Margin },
    footer:      { fontSize: 9, bold: true, italics: true },
    footerSmall: { fontSize: 7, margin: [0, 2, 0, 0] as Margin }
  };
  
  // --- DEFINICIÓN DEL DOCUMENTO ---
  const docDefinition = {
    pageSize: { 
      width: 226.77, // Ancho para 80mm
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



// Función para imprimir el ticket (versión corregida)
export const printTicket = (pdfDoc: PdfDocument): void => {
  pdfDoc.getBlob((blob: Blob) => {
    const blobUrl = URL.createObjectURL(blob);
    
    // Abrir el PDF en una nueva ventana para imprimir
    const printWindow = window.open(blobUrl, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        try {
          printWindow.print();
          
          // Cerrar la ventana después de imprimir
          setTimeout(() => {
            printWindow.close();
            URL.revokeObjectURL(blobUrl);
          }, 150000); // Esperar 150 segundos antes de cerrar la ventana
        } catch (error) {
          console.error('Error al imprimir:', error);
          printWindow.close();
          URL.revokeObjectURL(blobUrl);
        }
      };
    } else {
      console.error('No se pudo abrir la ventana de impresión. Verifica los bloqueadores de ventanas emergentes.');
      // Alternativa: Descargar el PDF directamente
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'ticket.pdf';
      link.click();
      URL.revokeObjectURL(blobUrl);
    }
  });
};
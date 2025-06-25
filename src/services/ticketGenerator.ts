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

// Función para generar el ticket
export const generateTicket = (
  products: Product[],
  tax: number,
  total: number,
  storeInfo: StoreInfo
): PdfDocument => {
  // Calcular subtotal primero (corrección de orden)
  const subtotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

  // Definir el contenido del ticket
  const content = [
    // Encabezado
    { 
      text: storeInfo.name, 
      style: 'header',
      alignment: 'center' as const
    },
    { 
      text: storeInfo.address, 
      style: 'subheader',
      alignment: 'center' as const
    },
    { 
      text: `Tel: ${storeInfo.phone}`, 
      style: 'subheader',
      alignment: 'center' as const
    },
    { 
      text: `RFC: ${storeInfo.rfc || 'XAXX010101000'}`, 
      style: 'subheader',
      alignment: 'center' as const
    },
    { 
      text: '--------------------------------', 
      style: 'divider',
      alignment: 'center' as const
    },
    { 
      text: `FECHA: ${new Date().toLocaleString('es-MX')}`, 
      style: 'date',
      alignment: 'center' as const
    },
    { 
      text: 'TICKET DE COMPRA', 
      style: 'title',
      alignment: 'center' as const
    },
    { 
      text: '--------------------------------', 
      style: 'divider',
      alignment: 'center' as const
    },
    
    // Productos
    {
      table: {
        widths: ['*', 60, 60, 60],
        body: [
          [
            { text: 'DESCRIPCIÓN', style: 'tableHeader' },
            { text: 'CANT', style: 'tableHeader', alignment: 'center' as const },
            { text: 'PRECIO', style: 'tableHeader', alignment: 'right' as const },
            { text: 'TOTAL', style: 'tableHeader', alignment: 'right' as const }
          ],
          ...products.map(product => [
            { text: product.name, style: 'tableItem' },
            { text: product.quantity.toString(), style: 'tableItem', alignment: 'center' as const },
            { text: `$${product.price.toFixed(2)}`, style: 'tableItem', alignment: 'right' as const },
            { text: `$${(product.price * product.quantity).toFixed(2)}`, style: 'tableItem', alignment: 'right' as const }
          ])
        ]
      },
      layout: 'noBorders'
    },
    
    // Totales
    { 
      text: '--------------------------------', 
      style: 'divider',
      alignment: 'center' as const
    },
    {
      table: {
        widths: ['*', 60, 60],
        body: [
          [
            { text: 'SUBTOTAL:', style: 'tableFooter' },
            { text: '', style: 'tableFooter' },
            { text: `$${subtotal.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
          ],
          [
            { text: 'IVA (15%):', style: 'tableFooter' },
            { text: '', style: 'tableFooter' },
            { text: `$${tax.toFixed(2)}`, style: 'tableFooter', alignment: 'right' as const }
          ],
          [
            { text: 'TOTAL:', style: 'tableFooter', bold: true },
            { text: '', style: 'tableFooter' },
            { text: `$${total.toFixed(2)}`, style: 'tableFooter', bold: true, alignment: 'right' as const }
          ]
        ]
      },
      layout: 'noBorders'
    },
    
    // Pie de página
    { text: ' ', style: 'spacer' },
    { 
      text: '¡GRACIAS POR SU COMPRA!', 
      style: 'footer',
      alignment: 'center' as const
    },
    { 
      text: 'Vuelva pronto', 
      style: 'footer',
      alignment: 'center' as const
    },
    { text: ' ', style: 'spacer' },
    { 
      text: '--------------------------------', 
      style: 'divider',
      alignment: 'center' as const
    },
    { 
      text: 'Este ticket es su comprobante de compra', 
      style: 'footerSmall',
      alignment: 'center' as const
    },
    { 
      text: 'Conserve este documento', 
      style: 'footerSmall',
      alignment: 'center' as const
    }
  ];
  
  // Definir estilos con márgenes tipados como tuplas
  const styles = {
    header: {
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 4] as Margin
    },
    subheader: {
      fontSize: 8,
      margin: [0, 0, 0, 2] as Margin
    },
    divider: {
      fontSize: 8,
      margin: [0, 4, 0, 4] as Margin
    },
    date: {
      fontSize: 8,
      margin: [0, 0, 0, 4] as Margin
    },
    title: {
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 4] as Margin
    },
    tableHeader: {
      fontSize: 8,
      bold: true,
      margin: [0, 2, 0, 2] as Margin
    },
    tableItem: {
      fontSize: 8,
      margin: [0, 2, 0, 2] as Margin
    },
    tableFooter: {
      fontSize: 8,
      margin: [0, 2, 0, 2] as Margin
    },
    footer: {
      fontSize: 10,
      bold: true,
      margin: [0, 4, 0, 0] as Margin
    },
    footerSmall: {
      fontSize: 8,
      margin: [0, 2, 0, 0] as Margin
    },
    spacer: {
      fontSize: 4,
      margin: [0, 0, 0, 0] as Margin
    }
  };
  
  // Definir el documento
  const docDefinition = {
    pageSize: { 
      width: 226, // 80mm en puntos (1mm = 2.83465 puntos)
      height: 'auto' as const 
    },
    pageMargins: [10, 10, 10, 10] as [number, number, number, number],
    content: content,
    styles: styles,
    defaultStyle: {
      font: 'Roboto', // Fuente por defecto
    }
  };
  
  // Crear el PDF
  return pdfMake.createPdf(docDefinition);
};

// Función para imprimir el ticket
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
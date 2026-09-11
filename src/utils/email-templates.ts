// ============================================================
// src/utils/email-templates.ts
//
// HTML de los correos. Notas de por qué está escrito así:
//
//  · Todo con estilos EN LÍNEA. Gmail y Outlook eliminan las
//    hojas de estilo y las clases; lo único que sobrevive es
//    el atributo style de cada elemento.
//  · Layout con <table>, no con flex ni grid. Outlook usa el
//    motor de Word para renderizar y no entiende CSS moderno.
//  · Ancho fijo de 600px, el estándar seguro para correo.
// ============================================================

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
  variant?: string | null;
  image?: string | null;
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  shippingAddress: {
    streetAddress?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string;
    deliveryNotes?: string;
  };
  trackingNumber?: string | null;
  carrier?: string | null;
  siteUrl?: string;
}

const GOLD = '#eab308';
const GOLD_DEEP = '#a16207';
const INK = '#1c1c1e';
const INK_2 = '#55555c';
const INK_3 = '#85858c';
const WHATSAPP = '528714617696';

const money = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const methodLabel = (m: string) => {
  if (m?.startsWith('mercadopago')) return 'Mercado Pago';
  if (m === 'paypal') return 'PayPal';
  if (m === 'card') return 'Tarjeta';
  return 'Pagado';
};

// ─────────────────────────────────────────────
// Piezas reutilizables
// ─────────────────────────────────────────────

function shell(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Broquelizate</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<!-- Preheader: el texto que se ve en la bandeja junto al asunto -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- Encabezado -->
        <tr>
          <td style="background-color:#0f0f10;padding:28px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Broquelizate</div>
            <div style="color:${GOLD};font-size:11px;letter-spacing:2px;margin-top:4px;">joyería &amp; piercings</div>
          </td>
        </tr>

        ${content}

        <!-- Pie -->
        <tr>
          <td style="background-color:#fafaf9;padding:24px 32px;text-align:center;border-top:1px solid #eeeeee;">
            <p style="margin:0 0 10px;color:${INK_3};font-size:12px;line-height:1.6;">
              ¿Dudas sobre tu pedido?
              <a href="https://wa.me/${WHATSAPP}" style="color:${GOLD_DEEP};text-decoration:underline;">Escríbenos por WhatsApp</a>
            </p>
            <p style="margin:0;color:#a1a1aa;font-size:11px;">
              © ${new Date().getFullYear()} Broquelizate · Gómez Palacio, Durango
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function itemsTable(items: OrderEmailItem[]): string {
  return items
    .map(
      it => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #f0f0f0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${
                  it.image
                    ? `<td width="64" style="padding-right:14px;vertical-align:top;">
                         <img src="${esc(it.image)}" width="64" height="64" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:10px;display:block;background:#f4f4f5;" />
                       </td>`
                    : ''
                }
                <td style="vertical-align:top;">
                  <div style="color:${INK};font-size:14px;font-weight:600;line-height:1.4;">${esc(it.name)}</div>
                  ${it.variant ? `<div style="color:${INK_3};font-size:12px;margin-top:3px;">${esc(it.variant)}</div>` : ''}
                  <div style="color:${INK_3};font-size:12px;margin-top:3px;">Cantidad: ${it.quantity}</div>
                </td>
                <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:12px;">
                  <div style="color:${INK};font-size:14px;font-weight:700;">${money(it.price * it.quantity)}</div>
                  ${it.quantity > 1 ? `<div style="color:${INK_3};font-size:11px;margin-top:2px;">${money(it.price)} c/u</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join('');
}

function totalsBlock(o: OrderEmailData): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr>
        <td style="padding:6px 0;color:${INK_2};font-size:13px;">Subtotal</td>
        <td align="right" style="padding:6px 0;color:${INK};font-size:13px;font-weight:600;">${money(o.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${INK_2};font-size:13px;">Envío</td>
        <td align="right" style="padding:6px 0;font-size:13px;font-weight:600;color:${o.shippingCost > 0 ? INK : '#15803d'};">
          ${o.shippingCost > 0 ? money(o.shippingCost) : 'Gratis'}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 0 0;border-top:2px solid #f0f0f0;color:${INK};font-size:15px;font-weight:700;">Total</td>
        <td align="right" style="padding:14px 0 0;border-top:2px solid #f0f0f0;color:${GOLD_DEEP};font-size:20px;font-weight:800;">${money(o.total)}</td>
      </tr>
    </table>`;
}

function addressBlock(o: OrderEmailData): string {
  const a = o.shippingAddress || {};
  return `
    <div style="color:${INK_2};font-size:13px;line-height:1.7;">
      <strong style="color:${INK};">${esc(o.customerName)}</strong><br />
      ${esc(a.streetAddress || '')}${a.neighborhood ? `, ${esc(a.neighborhood)}` : ''}<br />
      ${esc(a.city || '')}${a.state ? `, ${esc(a.state)}` : ''} ${esc(a.postalCode || '')}<br />
      ${a.phone ? `Tel: ${esc(a.phone)}` : ''}
      ${a.deliveryNotes ? `<br /><span style="color:${INK_3};font-style:italic;">"${esc(a.deliveryNotes)}"</span>` : ''}
    </div>`;
}

// ─────────────────────────────────────────────
// 1 · Confirmación para el cliente
// ─────────────────────────────────────────────

export function orderConfirmationEmail(o: OrderEmailData): string {
  const firstName = (o.customerName || '').split(' ')[0] || 'Hola';

  const content = `
        <tr>
          <td style="padding:36px 32px 8px;text-align:center;">
            <div style="width:56px;height:56px;line-height:56px;margin:0 auto 16px;background-color:#dcfce7;border-radius:50%;font-size:26px;">✓</div>
            <h1 style="margin:0 0 8px;color:${INK};font-size:24px;font-weight:800;letter-spacing:-0.5px;">¡Gracias por tu compra, ${esc(firstName)}!</h1>
            <p style="margin:0;color:${INK_2};font-size:14px;line-height:1.6;">
              Recibimos tu pedido y ya estamos preparándolo con cuidado.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:12px;">
              <tr>
                <td style="padding:16px 20px;text-align:center;">
                  <div style="color:${INK_3};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">Número de pedido</div>
                  <div style="color:${GOLD_DEEP};font-size:18px;font-weight:800;font-family:monospace;margin-top:4px;">${esc(o.orderNumber)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <h2 style="margin:0 0 4px;color:${INK};font-size:15px;font-weight:700;">Tu pedido</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${itemsTable(o.items)}
            </table>
            ${totalsBlock(o)}
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <h2 style="margin:0 0 10px;color:${INK};font-size:15px;font-weight:700;">Enviaremos a</h2>
            ${addressBlock(o)}
            <p style="margin:14px 0 0;color:${INK_3};font-size:12px;line-height:1.6;">
              Método de pago: ${esc(methodLabel(o.paymentMethod))}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf9;border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;">
                  <div style="color:${INK};font-size:14px;font-weight:700;margin-bottom:8px;">¿Qué sigue?</div>
                  <div style="color:${INK_2};font-size:13px;line-height:1.7;">
                    Preparamos tu pedido y lo entregamos a la paquetería.
                    En cuanto salga te enviaremos otro correo con tu número de rastreo
                    para que puedas seguirlo.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 36px;text-align:center;">
            <a href="https://wa.me/${WHATSAPP}?text=Hola,%20tengo%20una%20duda%20sobre%20mi%20pedido%20${encodeURIComponent(o.orderNumber)}"
               style="display:inline-block;padding:14px 32px;background-color:${GOLD};color:#2a1f04;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
              Contactarnos por WhatsApp
            </a>
          </td>
        </tr>`;

  return shell(content, `Tu pedido ${o.orderNumber} por ${money(o.total)} fue confirmado.`);
}

// ─────────────────────────────────────────────
// 2 · Aviso para el negocio
// ─────────────────────────────────────────────

export function adminNewOrderEmail(o: OrderEmailData): string {
  const a = o.shippingAddress || {};

  const content = `
        <tr>
          <td style="padding:32px 32px 0;">
            <h1 style="margin:0 0 6px;color:${INK};font-size:20px;font-weight:800;">Venta nueva</h1>
            <p style="margin:0;color:${INK_2};font-size:13px;">
              Pedido <strong style="font-family:monospace;color:${GOLD_DEEP};">${esc(o.orderNumber)}</strong>
              · ${esc(methodLabel(o.paymentMethod))}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;text-align:center;">
                  <div style="color:#15803d;font-size:26px;font-weight:800;">${money(o.total)}</div>
                  <div style="color:${INK_3};font-size:12px;margin-top:2px;">${o.items.reduce((s, i) => s + i.quantity, 0)} artículo(s)</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <h2 style="margin:0 0 4px;color:${INK};font-size:14px;font-weight:700;">Productos a preparar</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${itemsTable(o.items)}
            </table>
            ${totalsBlock(o)}
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <h2 style="margin:0 0 10px;color:${INK};font-size:14px;font-weight:700;">Datos de envío</h2>
            ${addressBlock(o)}
            <p style="margin:10px 0 0;color:${INK_2};font-size:13px;">
              Correo: <a href="mailto:${esc(o.customerEmail)}" style="color:${GOLD_DEEP};">${esc(o.customerEmail)}</a>
              ${a.phone ? `<br />WhatsApp: <a href="https://wa.me/52${esc(a.phone.replace(/\D/g, ''))}" style="color:${GOLD_DEEP};">${esc(a.phone)}</a>` : ''}
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 36px;text-align:center;">
            <a href="${o.siteUrl || ''}/admin/orders"
               style="display:inline-block;padding:13px 30px;background-color:${INK};color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:999px;">
              Ver en el panel
            </a>
          </td>
        </tr>`;

  return shell(content, `Venta de ${money(o.total)} · pedido ${o.orderNumber}`);
}

// ─────────────────────────────────────────────
// 3 · Pedido en camino
// ─────────────────────────────────────────────

export function shippingNotificationEmail(o: OrderEmailData): string {
  const firstName = (o.customerName || '').split(' ')[0] || 'Hola';

  const content = `
        <tr>
          <td style="padding:36px 32px 8px;text-align:center;">
            <div style="font-size:40px;margin-bottom:12px;">📦</div>
            <h1 style="margin:0 0 8px;color:${INK};font-size:24px;font-weight:800;letter-spacing:-0.5px;">Tu pedido va en camino</h1>
            <p style="margin:0;color:${INK_2};font-size:14px;line-height:1.6;">
              ${esc(firstName)}, tu pedido <strong style="font-family:monospace;">${esc(o.orderNumber)}</strong> ya salió rumbo a tu domicilio.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border-radius:12px;">
              <tr>
                <td style="padding:20px;text-align:center;">
                  <div style="color:${INK_3};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">Número de rastreo</div>
                  <div style="color:${INK};font-size:17px;font-weight:700;font-family:monospace;margin:6px 0 4px;word-break:break-all;">${esc(o.trackingNumber || '')}</div>
                  <div style="color:${GOLD_DEEP};font-size:12px;font-weight:600;text-transform:uppercase;">${esc(o.carrier || '')}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <h2 style="margin:0 0 10px;color:${INK};font-size:15px;font-weight:700;">Enviamos a</h2>
            ${addressBlock(o)}
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf9;border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;color:${INK_2};font-size:13px;line-height:1.7;">
                  El tiempo de entrega depende de la paquetería y del destino,
                  normalmente entre 2 y 7 días hábiles. Si nadie puede recibir el
                  paquete, la paquetería suele dejar aviso e intentar de nuevo.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 36px;text-align:center;">
            <a href="https://wa.me/${WHATSAPP}?text=Hola,%20consulta%20sobre%20el%20env%C3%ADo%20de%20mi%20pedido%20${encodeURIComponent(o.orderNumber)}"
               style="display:inline-block;padding:14px 32px;background-color:${GOLD};color:#2a1f04;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">
              ¿Dudas con tu envío?
            </a>
          </td>
        </tr>`;

  return shell(content, `Tu pedido ${o.orderNumber} ya va en camino. Rastreo: ${o.trackingNumber}`);
}
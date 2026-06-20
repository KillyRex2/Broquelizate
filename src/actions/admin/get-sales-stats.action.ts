// src/actions/get-sales-stats.action.ts
import { defineAction } from 'astro:actions';
import { db, orders, order_items, Product, ProductImage } from 'astro:db';
import { z } from 'astro:schema';

/**
 * Estadísticas de ventas para el dashboard del admin.
 *
 * Calcula facturación, número de ventas, ticket medio y ganancia
 * para un rango de fechas, además de desgloses por hora / día de semana /
 * día del mes / mes, productos más vendidos (con foto) y métodos de pago.
 *
 * NOTA sobre la ganancia: order_items NO guarda el costo al momento de la
 * venta, así que la ganancia se estima cruzando order_items.productId con
 * Product.cost (costo ACTUAL). Si cambias el costo de un producto, las
 * ganancias históricas se recalculan con el costo nuevo.
 *
 * Las órdenes con status 'cancelled' se EXCLUYEN de todas las métricas.
 */

const inputSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.string().optional().default('all'),
});

type OrderRow = {
  id: string;
  total: number | null;
  subtotal: number | null;
  paymentMethod: string;
  status: string;
  createdAt: Date | null;
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const getSalesStats = defineAction({
  accept: 'json',
  input: inputSchema,
  handler: async ({ startDate, endDate, paymentMethod }) => {
    try {
      const now = new Date();
      const start = startDate ? new Date(startDate + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = endDate ? new Date(endDate + 'T23:59:59') : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const allOrders = (await db.select().from(orders)) as OrderRow[];
      const allItems = await db.select().from(order_items);
      const allProducts = await db.select().from(Product);
      const allImages = await db.select().from(ProductImage);

      // Costo actual por producto (para ganancia estimada)
      const costByProduct = new Map<string, number>();
      // Portada por producto (coverImageId), o primera imagen como respaldo
      const coverIdByProduct = new Map<string, string | null>();
      for (const p of allProducts) {
        costByProduct.set(p.id, p.cost ?? 0);
        coverIdByProduct.set(p.id, (p as any).coverImageId ?? null);
      }

      // Mapa imageId -> url, y primera imagen por producto (respaldo)
      const imageUrlById = new Map<string, string>();
      const firstImageByProduct = new Map<string, string>();
      for (const img of allImages) {
        imageUrlById.set(img.id, img.image);
        // Solo imágenes a nivel producto (sin variante/combinación) como respaldo de portada
        if (!(img as any).variantId && !(img as any).combinationId) {
          if (!firstImageByProduct.has(img.productId)) {
            firstImageByProduct.set(img.productId, img.image);
          }
        }
      }

      // Resuelve la URL de la foto de un producto: portada -> primera imagen -> null
      function photoFor(productId: string): string | null {
        const coverId = coverIdByProduct.get(productId);
        if (coverId && imageUrlById.has(coverId)) return imageUrlById.get(coverId)!;
        if (firstImageByProduct.has(productId)) return firstImageByProduct.get(productId)!;
        return null;
      }

      // Órdenes válidas dentro del rango
      const inRange = allOrders.filter((o) => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        if (d < start || d > end) return false;
        if (o.status === 'cancelled') return false;
        if (paymentMethod !== 'all' && o.paymentMethod !== paymentMethod) return false;
        return true;
      });

      const orderIdsInRange = new Set(inRange.map((o) => o.id));
      const itemsInRange = allItems.filter((it) => orderIdsInRange.has(it.orderId));

      // --- KPIs ---
      const revenue = inRange.reduce((sum, o) => sum + (o.total ?? 0), 0);
      const salesCount = inRange.length;
      const avgTicket = salesCount > 0 ? revenue / salesCount : 0;

      let profit = 0;
      for (const it of itemsInRange) {
        const cost = costByProduct.get(it.productId) ?? 0;
        profit += (it.price - cost) * (it.quantity ?? 1);
      }

      // --- Por HORA (con ventas y ganancia) ---
      const byHour = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, hour: h, revenue: 0, sales: 0, profit: 0 }));
      // --- Por DÍA DE LA SEMANA ---
      const byWeekday = DAY_NAMES.map((name, i) => ({ label: name, weekday: i, revenue: 0, sales: 0, profit: 0 }));
      // --- Por DÍA (rango) ---
      const dayMap = new Map<string, { label: string; date: string; revenue: number; sales: number; profit: 0 }>();
      // --- Por MES (año actual) ---
      const byMonth = MONTH_NAMES.map((name, i) => ({ label: name, month: i, revenue: 0, sales: 0, profit: 0 }));

      // Ganancia por orden (para poder sumarla en cada desglose)
      const profitByOrder = new Map<string, number>();
      for (const it of itemsInRange) {
        const cost = costByProduct.get(it.productId) ?? 0;
        const p = (it.price - cost) * (it.quantity ?? 1);
        profitByOrder.set(it.orderId, (profitByOrder.get(it.orderId) ?? 0) + p);
      }

      for (const o of inRange) {
        const d = new Date(o.createdAt!);
        const oProfit = profitByOrder.get(o.id) ?? 0;

        byHour[d.getHours()].revenue += o.total ?? 0;
        byHour[d.getHours()].sales += 1;
        byHour[d.getHours()].profit += oProfit;

        byWeekday[d.getDay()].revenue += o.total ?? 0;
        byWeekday[d.getDay()].sales += 1;
        byWeekday[d.getDay()].profit += oProfit;

        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const label = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
        if (!dayMap.has(key)) dayMap.set(key, { label, date: key, revenue: 0, sales: 0, profit: 0 } as any);
        const entry = dayMap.get(key)! as any;
        entry.revenue += o.total ?? 0;
        entry.sales += 1;
        entry.profit += oProfit;
      }
      const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      for (const o of allOrders) {
        if (!o.createdAt || o.status === 'cancelled') continue;
        const d = new Date(o.createdAt);
        if (d.getFullYear() !== now.getFullYear()) continue;
        if (paymentMethod !== 'all' && o.paymentMethod !== paymentMethod) continue;
        byMonth[d.getMonth()].revenue += o.total ?? 0;
        byMonth[d.getMonth()].sales += 1;
        byMonth[d.getMonth()].profit += profitByOrder.get(o.id) ?? 0;
      }

      let bestMonth = { label: '—', revenue: 0 };
      for (const m of byMonth) {
        if (m.revenue > bestMonth.revenue) bestMonth = { label: m.label, revenue: m.revenue };
      }

      // --- Productos más vendidos (con FOTO) ---
      const productMap = new Map<string, { productId: string; name: string; quantity: number; revenue: number; image: string | null }>();
      for (const it of itemsInRange) {
        const key = it.productId;
        if (!productMap.has(key)) {
          productMap.set(key, { productId: key, name: it.productName, quantity: 0, revenue: 0, image: photoFor(key) });
        }
        const entry = productMap.get(key)!;
        entry.quantity += it.quantity ?? 1;
        entry.revenue += (it.price ?? 0) * (it.quantity ?? 1);
      }
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8);

      // --- Métodos de pago ---
      const paymentMap = new Map<string, { method: string; sales: number; revenue: number }>();
      for (const o of inRange) {
        const key = o.paymentMethod || 'Desconocido';
        if (!paymentMap.has(key)) paymentMap.set(key, { method: key, sales: 0, revenue: 0 });
        const entry = paymentMap.get(key)!;
        entry.sales += 1;
        entry.revenue += o.total ?? 0;
      }
      const paymentMethods = Array.from(paymentMap.values()).sort((a, b) => b.revenue - a.revenue);

      const hoursWithSales = byHour.filter((h) => h.sales > 0);
      const bestHour = hoursWithSales.length ? hoursWithSales.reduce((b, h) => (h.revenue > b.revenue ? h : b)) : null;
      const worstHour = hoursWithSales.length ? hoursWithSales.reduce((w, h) => (h.revenue < w.revenue ? h : w)) : null;

      return {
        kpis: { revenue, salesCount, avgTicket, profit, bestMonthLabel: bestMonth.label, bestMonthRevenue: bestMonth.revenue },
        byHour,
        byWeekday,
        byDay,
        byMonth,
        topProducts,
        paymentMethods,
        bestHour: bestHour ? { label: bestHour.label, revenue: bestHour.revenue } : null,
        worstHour: worstHour ? { label: worstHour.label, revenue: worstHour.revenue } : null,
      };
    } catch (error) {
      console.error('Error en getSalesStats:', error);
      throw new Error('No se pudieron obtener las estadísticas.');
    }
  },
});
import { db, orders, order_items, Product, ProductVariantCombination, ProductVariant, eq, inArray } from 'astro:db';
import { v4 as uuidv4 } from 'uuid';
import type { APIRoute } from 'astro';
import { getSession } from 'auth-astro/server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const session = await getSession(request);

    const data = await request.json();

    // Validar datos requeridos
    if (!data.products || !Array.isArray(data.products) || data.products.length === 0) {
      return new Response(JSON.stringify({ error: 'Datos de productos inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Limitar cantidad de items
    if (data.products.length > 50) {
      return new Response(JSON.stringify({ error: 'Demasiados productos en la orden' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Email: priorizar sesión autenticada
    const customerEmail = session?.user?.email || data.customerEmail;
    if (!customerEmail) {
      return new Response(JSON.stringify({ error: 'Email del cliente es requerido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ✅ RECALCULAR TOTAL SERVER-SIDE — no confiar en el cliente
    const productIds: string[] = Array.from(new Set(data.products.map((p: any) => String(p.id)).filter((id: string) => id && id !== 'undefined'))) as string[];
    
    if (productIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No se encontraron productos válidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener precios reales de la BD
    const dbProducts = await db
      .select({ id: Product.id, price: Product.price, name: Product.name })
      .from(Product)
      .where(inArray(Product.id, productIds));

    const dbProductMap = new Map(dbProducts.map(p => [p.id, p]));

    // El carrito manda `variantId`, que en productos de 2+ grupos es en realidad
    // el id de una COMBINACIÓN, y en productos de 1 grupo es el id de una VARIANTE.
    const variantOrComboIds: string[] = Array.from(new Set(
      data.products
        .map((p: any) => p.combinationId || p.variantId)
        .filter((id: any) => id && id !== 'undefined' && id !== 'null')
        .map((id: any) => String(id))
    ));

    let dbCombinationMap = new Map<string, number>();
    let dbVariantMap = new Map<string, { priceAdjustment: number; productId: string }>();

    if (variantOrComboIds.length > 0) {
      const dbCombinations = await db
        .select({ id: ProductVariantCombination.id, price: ProductVariantCombination.price })
        .from(ProductVariantCombination)
        .where(inArray(ProductVariantCombination.id, variantOrComboIds));
      dbCombinationMap = new Map(dbCombinations.map(c => [c.id, c.price]));

      const dbVariants = await db
        .select({ id: ProductVariant.id, priceAdjustment: ProductVariant.priceAdjustment, productId: ProductVariant.productId })
        .from(ProductVariant)
        .where(inArray(ProductVariant.id, variantOrComboIds));
      dbVariantMap = new Map(dbVariants.map(v => [v.id, { priceAdjustment: v.priceAdjustment ?? 0, productId: v.productId }]));
    }

    // Recalcular subtotal con precios de la BD
    let serverSubtotal = 0;
    const validatedItems: Array<{ id: string; name: string; price: number; quantity: number; variantCombinationId?: string | null; variantDescription?: string | null; engraving?: string }> = [];

    for (const item of data.products) {
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
      const dbProduct = dbProductMap.get(item.id);
      
      if (!dbProduct) {
        return new Response(JSON.stringify({ error: `Producto no encontrado: ${item.id}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Resolver precio real:
      // 1) Si el id es de una COMBINACIÓN -> precio de la combinación (precio absoluto).
      // 2) Si el id es de una VARIANTE suelta -> precio base + ajuste de la variante.
      // 3) Si no hay variante/combinación -> precio base del producto.
      const variantOrCombo = item.combinationId || item.variantId;
      let realPrice = dbProduct.price;

      if (variantOrCombo && dbCombinationMap.has(variantOrCombo)) {
        realPrice = dbCombinationMap.get(variantOrCombo)!;
      } else if (variantOrCombo && dbVariantMap.has(variantOrCombo)) {
        realPrice = dbProduct.price + dbVariantMap.get(variantOrCombo)!.priceAdjustment;
      }

      serverSubtotal += realPrice * quantity;

      validatedItems.push({
        id: item.id,
        name: item.name || dbProduct.name,
        price: realPrice,
        quantity,
        variantCombinationId: (variantOrCombo && dbCombinationMap.has(variantOrCombo)) ? variantOrCombo : null,
        variantDescription: item.variantName || null,
        engraving: item.engraving ? JSON.stringify(item.engraving) : null as any,
      });
    }

    // Aplicar descuento y cargos adicionales (validar que no sean absurdos)
    const discount = Math.max(0, Math.min(serverSubtotal, Number(data.discount) || 0));
    const additionalCharges = Math.max(0, Math.min(serverSubtotal * 2, Number(data.additionalCharges) || 0));
    const tax = Math.max(0, Number(data.tax) || 0);

    const serverTotal = serverSubtotal + additionalCharges + tax - discount;

    // Verificar que el total del cliente no difiera significativamente
    const clientTotal = Number(data.total) || 0;
    const tolerance = 1; // $1 MXN de tolerancia por redondeo
    if (Math.abs(serverTotal - clientTotal) > tolerance) {
      const isDev = import.meta.env.DEV;
      if (isDev) {
        console.warn(`⚠️ Total mismatch: client=${clientTotal}, server=${serverTotal}`);
      }
      // Usar el total del servidor siempre
    }

    // Generar IDs
    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;

    // Insertar orden con total recalculado
    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      customerEmail,
      shippingAddress: JSON.stringify(data.shippingAddress || {}),
      subtotal: serverSubtotal,
      tax,
      total: serverTotal,
      paymentMethod: data.paymentMethod || 'Desconocido',
      status: 'completed',
      createdAt: new Date(),
      clientId: data.clientId || null
    } as any);

    // Crear items
    const orderItems = validatedItems.map(item => ({
      id: uuidv4(),
      orderId,
      productId: item.id,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      variantCombinationId: (item as any).variantCombinationId || null,
      variantDescription: (item as any).variantDescription || null,
      engraving: item.engraving || null,
    }));

    await db.insert(order_items).values(orderItems);

    return new Response(JSON.stringify({
      id: orderId,
      orderNumber,
      customerEmail,
      clientId: data.clientId || null,
      total: serverTotal,
      message: 'Orden creada exitosamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    const isDev = import.meta.env.DEV;
    return new Response(JSON.stringify({
      error: 'Error al crear la orden',
      ...(isDev ? { details: error.message } : {})
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
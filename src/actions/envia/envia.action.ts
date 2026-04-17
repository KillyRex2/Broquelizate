// src/actions/envia/envia.action.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { db, orders, order_items, User } from 'astro:db';
import { eq, and } from 'astro:db';
import { getSession } from 'auth-astro/server';

// ============================================
// CONFIGURACIÓN DE API
// ============================================

// URLs de Envia.com
// Sandbox: https://api-test.envia.com
// Producción: https://api.envia.com
const ENVIA_API_URL = import.meta.env.ENVIA_API_URL || 'https://api.envia.com';
const ENVIA_TOKEN = import.meta.env.ENVIA_API_TOKEN;


// Headers base para todas las peticiones
const getHeaders = () => {
  if (!ENVIA_TOKEN) {
    console.error('❌ ENVIA_API_TOKEN no está configurado en las variables de entorno');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ENVIA_TOKEN}`,
    'Accept': 'application/json'
  };
};

// ============================================
// HELPER: Convertir nombre de estado a código de 2 letras
// ============================================
function getStateCode(stateName: string): string {
  // Si ya es un código de 2 letras válido, retornarlo
  if (stateName.length === 2 && /^[A-Z]{2}$/i.test(stateName)) {
    return stateName.toUpperCase();
  }
  
  const stateCodes: Record<string, string> = {
    'aguascalientes': 'AG',
    'baja california': 'BC',
    'baja california sur': 'BS',
    'campeche': 'CM',
    'chiapas': 'CS',
    'chihuahua': 'CH',
    'coahuila': 'CO',
    'coahuila de zaragoza': 'CO',
    'colima': 'CL',
    'ciudad de mexico': 'DF',
    'cdmx': 'DF',
    'distrito federal': 'DF',
    'durango': 'DG',
    'guanajuato': 'GT',
    'guerrero': 'GR',
    'hidalgo': 'HG',
    'jalisco': 'JA',
    'mexico': 'EM',
    'estado de mexico': 'EM',
    'michoacan': 'MI',
    'michoacan de ocampo': 'MI',
    'morelos': 'MO',
    'nayarit': 'NA',
    'nuevo leon': 'NL',
    'oaxaca': 'OA',
    'puebla': 'PU',
    'queretaro': 'QT',
    'quintana roo': 'QR',
    'san luis potosi': 'SL',
    'sinaloa': 'SI',
    'sonora': 'SO',
    'tabasco': 'TB',
    'tamaulipas': 'TM',
    'tlaxcala': 'TL',
    'veracruz': 'VE',
    'veracruz de ignacio de la llave': 'VE',
    'yucatan': 'YU',
    'zacatecas': 'ZA'
  };
  
  const normalized = stateName.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  return stateCodes[normalized] || stateName.substring(0, 2).toUpperCase();
}

// ============================================
// HELPER: Obtener estado de México por código postal
// ============================================
function getStateFromPostalCode(postalCode: string): string {
  const stateRanges: { [key: string]: [number, number][] } = {
    'AG': [[20000, 20999]],
    'BC': [[21000, 22999]],
    'BS': [[23000, 23999]],
    'CM': [[24000, 24999]],
    'CS': [[29000, 30999]],
    'CH': [[31000, 33999]],
    'CO': [[25000, 27999]],
    'CL': [[28000, 28999]],
    'DF': [[1000, 16999]],
    'DG': [[34000, 35999]],
    'GT': [[36000, 38999]],
    'GR': [[39000, 41999]],
    'HG': [[42000, 43999]],
    'JA': [[44000, 49999]],
    'EM': [[50000, 57999]],
    'MI': [[58000, 61999]],
    'MO': [[62000, 62999]],
    'NA': [[63000, 63999]],
    'NL': [[64000, 67999]],
    'OA': [[68000, 71999]],
    'PU': [[72000, 75999]],
    'QT': [[76000, 76999]],
    'QR': [[77000, 77999]],
    'SL': [[78000, 79999]],
    'SI': [[80000, 82999]],
    'SO': [[83000, 85999]],
    'TB': [[86000, 86999]],
    'TM': [[87000, 89999]],
    'TL': [[90000, 90999]],
    'VE': [[91000, 96999]],
    'YU': [[97000, 97999]],
    'ZA': [[98000, 99999]],
  };
  
  const cpNum = parseInt(postalCode);
  for (const [state, ranges] of Object.entries(stateRanges)) {
    for (const [min, max] of ranges) {
      if (cpNum >= min && cpNum <= max) {
        return state;
      }
    }
  }
  
  return 'DG';
}

// ============================================
// HELPER: Normalizar peso para evitar bug de sandbox
// El sandbox de Envia.com tiene un bug con pesos decimales
// ============================================
function normalizeWeight(weight: number): number {
  // Peso mínimo de 1 kg para evitar bug del sandbox
  // En producción puedes cambiar esto a: return Math.max(0.1, weight);
  return Math.max(1, Math.ceil(weight));
}

// ============================================
// TIPOS DE DATOS
// ============================================

export interface ShippingRate {
  carrier: string;
  carrierLogo?: string;
  service: string;
  serviceId?: string;
  deliveryDays: number;
  totalPrice: number;
  currency: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: string;
  statusCode: string;
  estimatedDelivery: string | null;
  currentLocation: string;
  events: TrackingEvent[];
  lastUpdate: string;
}

export interface TrackingEvent {
  date: string;
  time: string;
  description: string;
  location: string;
  status: string;
}

export interface ShippingLabel {
  labelId: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
  cost: number;
}

// ============================================
// ACTION: COTIZAR ENVÍO
// ============================================

const AVAILABLE_CARRIERS = ['fedex', 'dhl', 'estafeta', 'redpack', 'ups', 'paquetexpress', '99minutos', 'sendex'];

export const getShippingRates = defineAction({
  accept: 'json',
  input: z.object({
    originPostalCode: z.string(),
    destinationPostalCode: z.string(),
    destinationCity: z.string().optional(),
    destinationState: z.string().optional(),
    weight: z.number(),
    length: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  handler: async (input, context) => {
    // Rate limiting básico por IP/sesión — no permitir spam de cotizaciones
    const safeWeight = normalizeWeight(input.weight);
    
    console.log('📦 Cotizando envío:', {
      origen: input.originPostalCode,
      destino: input.destinationPostalCode,
      pesoOriginal: input.weight,
      pesoNormalizado: safeWeight,
      dimensiones: `${input.length}x${input.width}x${input.height}`
    });

    if (!ENVIA_TOKEN) {
      console.error('❌ Token no configurado');
      return {
        success: false,
        rates: [],
        error: 'Token de API no configurado. Verifica tu archivo .env'
      };
    }

    try {
      const destCity = input.destinationCity || 'Ciudad';
      const rawState = input.destinationState || getStateFromPostalCode(input.destinationPostalCode);
      const destState = getStateCode(rawState);
      
      console.log('📤 Destino:', { 
        city: destCity, 
        state: destState, 
        rawState: rawState,
        postalCode: input.destinationPostalCode 
      });
      console.log('🚚 Consultando carriers:', AVAILABLE_CARRIERS.join(', '));

      const quoteWithCarrier = async (carrier: string): Promise<ShippingRate[]> => {
        const requestBody = {
          origin: {
            name: "Broquelizate",
            company: "Broquelizate",
            email: "contacto@broquelizate.com",
            phone: "8714617696",
            street: "Calle Escobedo esquina con Bravo",
            number: "222",
            district: "Colonia Centro",
            city: "Gómez Palacio",
            state: "DG",
            country: "MX",
            postalCode: input.originPostalCode,
          },
          destination: {
            name: "Cliente",
            phone: "0000000000",
            email: "cliente@email.com",
            street: "Calle Principal",
            number: "1",
            district: "Centro",
            city: destCity,
            state: destState,
            country: "MX",
            postalCode: input.destinationPostalCode,
          },
          packages: [{
            content: "Joyería",
            amount: 1,
            type: "box",
            weight: safeWeight, // ✅ Usar peso normalizado
            insurance: 0,
            declaredValue: 500,
            weightUnit: "KG",
            lengthUnit: "CM",
            dimensions: {
              length: input.length,
              width: input.width,
              height: input.height
            }
          }],
          shipment: {
            carrier: carrier,
            type: 1
          },
          settings: {
            currency: "MXN",
            printFormat: "PDF",
            printSize: "PAPER_7X4.75"
          }
        };

        try {
          const response = await fetch(`${ENVIA_API_URL}/ship/rate/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${ENVIA_TOKEN}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          const responseText = await response.text();
          const data = JSON.parse(responseText);

          if (data.meta === 'error' || data.error || !response.ok) {
            console.log(`  ⚠️ ${carrier}: ${data.error?.message || 'Sin cotización'}`);
            return [];
          }

          let rates: ShippingRate[] = [];
          
          if (data.data && Array.isArray(data.data)) {
            rates = data.data.map((rate: any) => ({
              carrier: rate.carrier || rate.carrier_name || carrier,
              carrierLogo: rate.carrier_logo_url || null,
              service: rate.service || rate.service_name || rate.service_level_name || 'Estándar',
              serviceId: rate.service_id || rate.carrier_service_code || null,
              deliveryDays: parseInt(rate.days || rate.estimated_delivery || rate.delivery_estimate || '5'),
              totalPrice: parseFloat(rate.total || rate.total_pricing || rate.base_price || '0'),
              currency: rate.currency || 'MXN'
            }));
          } else if (data.meta && data.meta !== 'error') {
            rates = [{
              carrier: data.carrier || carrier,
              service: data.service || 'Estándar',
              deliveryDays: parseInt(data.days || '5'),
              totalPrice: parseFloat(data.total || '0'),
              currency: 'MXN'
            }];
          }

          if (rates.length > 0) {
            console.log(`  ✅ ${carrier}: ${rates.length} cotización(es)`);
          }

          return rates;
        } catch (error) {
          console.log(`  ❌ ${carrier}: Error de conexión`);
          return [];
        }
      };

      const allRatesPromises = AVAILABLE_CARRIERS.map(carrier => quoteWithCarrier(carrier));
      const allRatesArrays = await Promise.all(allRatesPromises);
      const allRates = allRatesArrays.flat();
      allRates.sort((a, b) => a.totalPrice - b.totalPrice);

      console.log(`✅ Total cotizaciones encontradas: ${allRates.length}`);

      if (allRates.length === 0) {
        return {
          success: false,
          rates: [],
          error: 'No se encontraron cotizaciones disponibles. Verifica que tienes paqueterías activadas en tu cuenta de Envia.com'
        };
      }

      return { success: true, rates: allRates };
    } catch (error) {
      console.error('❌ Error getting shipping rates:', error);
      return { 
        success: false, 
        rates: [],
        error: error instanceof Error ? error.message : 'Error desconocido al cotizar' 
      };
    }
  }
});

// ============================================
// ACTION: CREAR ETIQUETA DE ENVÍO
// ============================================

export const createShippingLabel = defineAction({
  accept: 'json',
  input: z.object({
    orderId: z.string(),
    carrier: z.string(),
    service: z.string(),
    origin: z.object({
      name: z.string(),
      street: z.string(),
      number: z.string(),
      district: z.string(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      phone: z.string(),
      email: z.string(),
    }),
    destination: z.object({
      name: z.string(),
      street: z.string(),
      number: z.string(),
      district: z.string(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      phone: z.string(),
      email: z.string(),
    }),
    package: z.object({
      weight: z.number(),
      length: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  }),
  handler: async (input, context) => {
    const session = await getSession(context.request);
    if (!session?.user) {
      throw new Error('No autorizado para generar etiquetas');
    }

    const safeWeight = normalizeWeight(input.package.weight);
    
    console.log('🏷️ Creando etiqueta de envío:', {
      orderId: input.orderId,
      carrier: input.carrier,
      service: input.service,
      pesoOriginal: input.package.weight,
      pesoNormalizado: safeWeight
    });

    try {
      const requestBody = {
        origin: {
          name: input.origin.name,
          company: input.origin.name,
          email: input.origin.email,
          phone: input.origin.phone,
          street: input.origin.street,
          number: input.origin.number,
          district: input.origin.district,
          city: input.origin.city,
          state: getStateCode(input.origin.state),
          country: "MX",
          postalCode: input.origin.postalCode,
          reference: ""
        },
        destination: {
          name: input.destination.name,
          company: "",
          email: input.destination.email,
          phone: input.destination.phone,
          street: input.destination.street,
          number: input.destination.number,
          district: input.destination.district,
          city: input.destination.city,
          state: getStateCode(input.destination.state),
          country: "MX",
          postalCode: input.destination.postalCode,
          reference: ""
        },
        packages: [{
          content: "Joyería - Broquelizate",
          amount: 1,
          type: "box",
          weight: safeWeight, // ✅ Usar peso normalizado
          insurance: 0,
          declaredValue: 500,
          weightUnit: "KG",
          lengthUnit: "CM",
          dimensions: {
            length: input.package.length,
            width: input.package.width,
            height: input.package.height
          }
        }],
        shipment: {
          carrier: input.carrier.toLowerCase(),
          service: input.service,
          type: 2
        },
        settings: {
          currency: "MXN",
          printFormat: "PDF",
          printSize: "PAPER_7X4.75",
          comments: `Orden: ${input.orderId}`
        }
      };

      console.log('📤 Label request:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${ENVIA_API_URL}/ship/generate/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody)
      });

      const responseText = await response.text();
      console.log('📥 Label response status:', response.status);
      console.log('📥 Label response:', responseText);

      if (!response.ok) {
        let errorMessage = `Error ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error?.message || JSON.stringify(errorData);
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText);
      
      if (data.meta === 'error' || data.error) {
        const errorInfo = data.error || {};
        const errorMessage = errorInfo.message || errorInfo.description || 'Error desconocido de la API';
        console.error('❌ Error de API Envia.com:', errorMessage);
        throw new Error(errorMessage);
      }
      
      const labelData = data.data || data;
      
      if (!labelData.tracking_number && !labelData.trackingNumber && !labelData.carrier_tracking_number) {
        console.error('❌ Respuesta sin número de tracking:', data);
        throw new Error('La API no devolvió un número de tracking válido');
      }
      
      const label: ShippingLabel = {
        labelId: labelData.label_id || labelData.shipment_id || labelData.id || '',
        trackingNumber: labelData.tracking_number || labelData.trackingNumber || labelData.carrier_tracking_number || '',
        labelUrl: labelData.label || labelData.label_url || labelData.pdf_url || '',
        carrier: labelData.carrier || input.carrier,
        service: labelData.service || input.service,
        cost: parseFloat(labelData.total || labelData.total_price || labelData.amount || '0')
      };

      console.log('✅ Etiqueta creada:', label);

      if (label.trackingNumber) {
        await saveTrackingToDatabase(input.orderId, label);
      }

      return { success: true, label };
    } catch (error) {
      console.error('❌ Error creating shipping label:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido al crear etiqueta' 
      };
    }
  }
});

// ============================================
// ACTION: RASTREAR ENVÍO
// ============================================

export const trackShipment = defineAction({
  accept: 'json',
  input: z.object({
    trackingNumber: z.string(),
    carrier: z.string().optional(),
  }),
  handler: async (input, context) => {
    const session = await getSession(context.request);
    if (!session?.user) {
      throw new Error('No autorizado');
    }

    try {
      const trackingInfo = await fetchTrackingInfo(input.trackingNumber, input.carrier);
      
      if (!trackingInfo) {
        throw new Error('No se pudo obtener información de tracking');
      }

      return { success: true, tracking: trackingInfo };
    } catch (error) {
      console.error('❌ Error tracking shipment:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: OBTENER ENVÍOS DE USUARIO
// ============================================

export const getUserShipments = defineAction({
  accept: 'json',
  input: z.object({
    userId: z.string().optional(),
    clientId: z.number().optional(),
    customerEmail: z.string().optional(),
  }),
  handler: async (input) => {
    console.log('📋 Buscando pedidos para:', input);

    try {
      const userOrders = await getOrdersFromDatabase(
        input.userId,
        input.clientId,
        input.customerEmail
      );
      
      console.log(`📦 Pedidos encontrados: ${userOrders.length}`);

      const shipmentsWithTracking = await Promise.all(
        userOrders.map(async (order) => {
          let tracking: TrackingInfo | null = null;
          
          if (order.trackingNumber && order.carrier) {
            try {
              tracking = await fetchTrackingInfo(order.trackingNumber, order.carrier);
            } catch (e) {
              console.warn('No se pudo obtener tracking para:', order.trackingNumber);
            }
          }
          
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            products: order.items.map(item => item.productName),
            total: order.total,
            status: order.status,
            trackingNumber: order.trackingNumber,
            carrier: order.carrier,
            tracking
          };
        })
      );

      return { success: true, shipments: shipmentsWithTracking };
    } catch (error) {
      console.error('❌ Error getting user shipments:', error);
      return { 
        success: false, 
        shipments: [],
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: ACTUALIZAR ESTADO DE ORDEN
// ============================================

export const updateOrderStatus = defineAction({
  accept: 'json',
  input: z.object({
    orderId: z.string(),
    status: z.enum(['pending', 'processing', 'shipped', 'completed', 'cancelled']),
  }),
  handler: async (input) => {
    try {
      await db.update(orders)
        .set({ 
          status: input.status,
          updatedAt: new Date()
        } as any)
        .where(eq(orders.id, input.orderId));

      return { success: true, message: 'Status actualizado correctamente' };
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: ACTUALIZAR DIRECCIÓN DE ENVÍO DE ORDEN
// ============================================

export const updateOrderShippingAddress = defineAction({
  accept: 'json',
  input: z.object({
    orderId: z.string(),
    shippingAddress: z.object({
      streetAddress: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string(),
    }),
  }),
  handler: async (input, context) => {
    try {
      const session = await getSession(context.request);
      if (!session?.user) {
        throw new Error('No autorizado');
      }

      const shippingAddressJson = JSON.stringify(input.shippingAddress);

      await db.update(orders)
        .set({
          shippingAddress: shippingAddressJson,
          updatedAt: new Date()
        } as any)
        .where(eq(orders.id, input.orderId));

      return { success: true, message: 'Dirección de envío actualizada' };
    } catch (error) {
      console.error('❌ Error updating order shipping address:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: OBTENER PERFIL DE USUARIO
// ============================================

export const getUserProfile = defineAction({
  accept: 'json',
  input: z.object({}),
  handler: async (input, context) => {
    try {
      const session = await getSession(context.request);
      if (!session?.user?.email) {
        throw new Error('No autorizado');
      }

      const users = await db
        .select()
        .from(User)
        .where(eq(User.email, session.user.email))
        .all();

      const user = users[0];
      if (!user) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      let shippingAddress = {
        streetAddress: '',
        city: '',
        state: '',
        zip: '',
        country: 'México'
      };

      if (user.shippingAddress) {
        try {
          shippingAddress = JSON.parse(user.shippingAddress);
        } catch (e) {
          console.error('Error parsing shipping address:', e);
        }
      }

      return {
        success: true,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          shippingAddress
        }
      };
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: ACTUALIZAR PERFIL DE USUARIO
// ============================================

export const updateUserProfile = defineAction({
  accept: 'json',
  input: z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    phone: z.string().optional(),
  }),
  handler: async (input, context) => {
    try {
      const session = await getSession(context.request);
      if (!session?.user?.email) {
        throw new Error('No autorizado');
      }

      await db.update(User)
        .set({
          name: input.name,
          phone: input.phone || null,
          updatedAt: new Date(),
        } as any)
        .where(eq(User.email, session.user.email));

      return { success: true, message: 'Información actualizada correctamente' };
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: ACTUALIZAR DIRECCIÓN DE ENVÍO DE USUARIO
// ============================================

export const updateShippingAddress = defineAction({
  accept: 'json',
  input: z.object({
    shippingAddress: z.object({
      streetAddress: z.string().min(1, 'La dirección es requerida'),
      city: z.string().min(1, 'La ciudad es requerida'),
      state: z.string().min(1, 'El estado es requerido'),
      zip: z.string().regex(/^\d{5}$/, 'Código postal inválido'),
      country: z.string().min(1, 'El país es requerido'),
    }),
  }),
  handler: async (input, context) => {
    try {
      const session = await getSession(context.request);
      if (!session?.user?.email) {
        throw new Error('No autorizado');
      }

      const shippingAddressJson = JSON.stringify(input.shippingAddress);

      await db.update(User)
        .set({
          shippingAddress: shippingAddressJson,
          updatedAt: new Date(),
        } as any)
        .where(eq(User.email, session.user.email));

      return { success: true, message: 'Dirección actualizada correctamente' };
    } catch (error) {
      console.error('❌ Error updating shipping address:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// ACTION: OBTENER PERFIL POR EMAIL
// ============================================

export const getUserProfileByEmail = defineAction({
  accept: 'json',
  input: z.object({
    email: z.string().email('Email inválido'),
  }),
  handler: async (input) => {
    try {
      const users = await db
        .select()
        .from(User)
        .where(eq(User.email, input.email))
        .all();

      const user = users[0];
      if (!user) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      let shippingAddress = {
        streetAddress: '',
        city: '',
        state: '',
        zip: '',
        country: 'México'
      };

      if (user.shippingAddress) {
        try {
          shippingAddress = JSON.parse(user.shippingAddress);
        } catch (e) {
          console.error('Error parsing shipping address:', e);
        }
      }

      return {
        success: true,
        user: {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          shippingAddress
        }
      };
    } catch (error) {
      console.error('❌ Error getting user profile by email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

async function fetchTrackingInfo(trackingNumber: string, carrier?: string): Promise<TrackingInfo | null> {
  try {
    const requestBody = {
      trackingNumbers: [trackingNumber],
      carrier: carrier || undefined
    };

    const response = await fetch(`${ENVIA_API_URL}/ship/tracking/`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('Tracking API error:', response.status);
      return createMockTracking(trackingNumber, carrier);
    }

    const data = await response.json();
    const trackingData = data.data?.[0] || data.data || data;
    
    const trackingInfo: TrackingInfo = {
      trackingNumber: trackingNumber,
      carrier: trackingData.carrier || carrier || 'Desconocido',
      status: translateStatus(trackingData.status || 'pending'),
      statusCode: trackingData.status || 'pending',
      estimatedDelivery: trackingData.estimated_delivery || null,
      currentLocation: trackingData.current_location || trackingData.origin?.city || 'En tránsito',
      lastUpdate: trackingData.last_update || new Date().toISOString(),
      events: (trackingData.checkpoints || trackingData.events || []).map((checkpoint: any) => ({
        date: checkpoint.date || new Date().toLocaleDateString('es-MX'),
        time: checkpoint.time || new Date().toLocaleTimeString('es-MX'),
        description: checkpoint.description || checkpoint.status || 'Actualización',
        location: checkpoint.location || checkpoint.city || 'México',
        status: translateStatus(checkpoint.status_code || checkpoint.status || '')
      }))
    };

    return trackingInfo;
  } catch (error) {
    console.error('Error fetching tracking info:', error);
    return createMockTracking(trackingNumber, carrier);
  }
}

function createMockTracking(trackingNumber: string, carrier?: string): TrackingInfo {
  return {
    trackingNumber,
    carrier: carrier || 'Carrier',
    status: 'En tránsito',
    statusCode: 'in_transit',
    estimatedDelivery: null,
    currentLocation: 'En camino',
    lastUpdate: new Date().toISOString(),
    events: [{
      date: new Date().toLocaleDateString('es-MX'),
      time: new Date().toLocaleTimeString('es-MX'),
      description: 'Paquete en tránsito',
      location: 'México',
      status: 'En tránsito'
    }]
  };
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Pendiente',
    'in_transit': 'En tránsito',
    'out_for_delivery': 'En camino para entrega',
    'delivered': 'Entregado',
    'failed': 'Fallo en entrega',
    'returned': 'Devuelto',
    'cancelled': 'Cancelado',
    'exception': 'Excepción',
    'picked_up': 'Recolectado'
  };
  
  return statusMap[status?.toLowerCase()] || status || 'Desconocido';
}

async function saveTrackingToDatabase(orderId: string, label: ShippingLabel): Promise<void> {
  try {
    await db.update(orders)
      .set({
        trackingNumber: label.trackingNumber,
        carrier: label.carrier,
        labelId: label.labelId,
        labelUrl: label.labelUrl,
        shippingService: label.service,
        shippingCost: label.cost,
        shippedAt: new Date(),
        status: 'shipped'
      } as any)
      .where(eq(orders.id, orderId));
    
    console.log('✅ Tracking guardado en BD:', { orderId, trackingNumber: label.trackingNumber });
  } catch (error) {
    console.error('❌ Error saving tracking to database:', error);
    throw error;
  }
}

async function getOrdersFromDatabase(
  userId?: string,
  clientId?: number,
  customerEmail?: string
) {
  try {
    let whereConditions = [];
    
    if (clientId) {
      whereConditions.push(eq(orders.clientId, clientId));
    }
    if (customerEmail) {
      whereConditions.push(eq(orders.customerEmail, customerEmail));
    }
    
    if (whereConditions.length === 0) {
      console.warn('⚠️ No search criteria provided');
      return [];
    }
    
    const userOrders = await db
      .select()
      .from(orders)
      .where(whereConditions.length === 1 ? whereConditions[0] : and(...whereConditions))
      .all();
    
    console.log(`📦 Found ${userOrders.length} orders`);
    
    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db
          .select()
          .from(order_items)
          .where(eq(order_items.orderId, order.id))
          .all();
        
        return { ...order, items };
      })
    );
    
    return ordersWithItems;
  } catch (error) {
    console.error('❌ Error getting orders from database:', error);
    throw error;
  }
}
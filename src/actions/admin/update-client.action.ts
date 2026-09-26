import { db, Client, eq, sql } from 'astro:db';
// Zod se importa desde 'astro:actions' para la validación
import { defineAction} from 'astro:actions';
import { z } from 'astro:schema'
import { assertAdmin } from '../_guard';

// --- ACCIÓN PARA OBTENER UN CLIENTE POR SU ID ---
// Se define como una constante exportada para que puedas importarla individualmente.
export const getClientById = defineAction({
  input: z.string(), // Recibe el ID del cliente como un string
  handler: async (id, context) => {
    assertAdmin(context); // 🔒 Solo admin

    // Buscamos el cliente en la base de datos
    const [client] = await db.select().from(Client).where(eq(Client.id, Number(id)));

    if (!client) {
      throw new Error('Cliente no encontrado');
    }
    return client;
  },
});

// --- ACCIÓN PARA ACTUALIZAR UN CLIENTE ---
// También se exporta de forma individual.
export const updateClient = defineAction({
  accept: 'form', // Acepta datos de un FormData
  input: z.object({
    id: z.string(), // El ID es crucial para saber a quién actualizar
    nombre: z.string().min(3, 'El nombre es requerido'),
    clave_elector: z.string().optional(),
    saldo_actual: z.coerce.number().default(0), // 'coerce' convierte el string del form a número
    observaciones: z.string().optional(),
    telefono: z.string().optional(),
  }),
  handler: async ({ id, ...input }, context) => {
    assertAdmin(context);   // <-- candado

    // Un campo vacío se guarda como NULL, no como ''. Con '' dos clientes
    // sin clave de elector chocaban con la restricción UNIQUE.
    const orNull = (v?: string) => (v && v.trim() ? v.trim() : null);
    const clientData = {
      nombre: input.nombre.trim(),
      clave_elector: orNull(input.clave_elector)?.toUpperCase() ?? null,
      saldo_actual: input.saldo_actual,
      observaciones: orNull(input.observaciones),
      telefono: orNull(input.telefono),
    };

    try {
      // Usamos db.update para actualizar el registro existente
      const [updatedClient] = await db
        .update(Client)
        .set(clientData)
        .where(eq(Client.id, Number(id)))
        .returning();

      if (!updatedClient) {
        throw new Error('No se pudo actualizar el cliente.');
      }

      return { success: true, client: updatedClient };
      
    } catch (error: any) {
      if (String(error?.message).includes('UNIQUE constraint failed')) {
        throw new Error('La clave de elector ya está en uso por otro cliente.');
      }
      if (error?.message === 'No se pudo actualizar el cliente.') throw error;
      throw new Error('Error interno del servidor al actualizar.');
    }
  },
});
export const getAllClients = defineAction({
  // El primer parámetro es el input; antes se tomaba como context y assertAdmin
  // siempre fallaba, así que el POS nunca recibía la lista de clientes.
  handler: async (_input, context) => {
    assertAdmin(context); // 🔒 Solo admin
    try {
      // Obtener todos los clientes con sus direcciones
      const clients = await db.select({
        id: Client.id,
        name: Client.nombre,
        elector_key: Client.clave_elector,
        current_balance: Client.saldo_actual,
        observations: Client.observaciones,
        phone: Client.telefono,
        created_at: Client.createdAt,
      }).from(Client);

      clients.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      return { success: true, clients };
    } catch (error) {
      console.error("Error fetching clients:", error);
      return { success: false, error: "No se pudieron obtener los clientes." };
    }
  }
});

export const updateClientBalance = defineAction({
  input: z.object({
    clientId: z.number(),
    amountToAdd: z.number(),
  }),
  handler: async ({ clientId, amountToAdd }, context) => {
    assertAdmin(context);   // <-- candado

    await db.run(sql`
      UPDATE client 
      SET saldo_actual = saldo_actual + ${amountToAdd}
      WHERE id = ${clientId}
    `);
    const [client] = await db.select().from(Client).where(eq(Client.id, clientId));
    return { success: true, newBalance: client?.saldo_actual || 0 };
  },
});


// --- OBJETO SERVER PARA ASTRO ACTIONS ---
// Astro Actions espera un objeto 'server' que contenga todas las acciones.
// Aquí agrupamos las acciones que definimos arriba.
export const server = {
  getClientById,
  updateClient,
  getAllClients,
  // Aquí puedes añadir otras acciones que ya tengas, como deleteClient, etc.
};
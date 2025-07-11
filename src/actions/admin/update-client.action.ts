import { db, Client, eq } from 'astro:db';
// Zod se importa desde 'astro:actions' para la validación
import { defineAction} from 'astro:actions';
import { z } from 'astro:schema'

// --- ACCIÓN PARA OBTENER UN CLIENTE POR SU ID ---
// Se define como una constante exportada para que puedas importarla individualmente.
export const getClientById = defineAction({
  input: z.string(), // Recibe el ID del cliente como un string
  handler: async (id) => {
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
  handler: async ({ id, ...clientData }) => {
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
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('La clave de elector ya está en uso por otro cliente.');
      }
      throw new Error('Error interno del servidor al actualizar.');
    }
  },
});

// --- OBJETO SERVER PARA ASTRO ACTIONS ---
// Astro Actions espera un objeto 'server' que contenga todas las acciones.
// Aquí agrupamos las acciones que definimos arriba.
export const server = {
  getClientById,
  updateClient,
  // Aquí puedes añadir otras acciones que ya tengas, como deleteClient, etc.
};
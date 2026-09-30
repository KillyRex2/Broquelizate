// src/pages/api/get-products-by-page.ts
import type { APIRoute } from 'astro';
import { inputSchema, handler } from "@/actions/products/get-products-by-page.action";

export const POST: APIRoute = async (context) => {
  try {
    // Obtener FormData de la solicitud
    const formData = await context.request.formData();
    
    // Convertir FormData a objeto
    const inputData = Object.fromEntries(formData.entries());
    
    // Parsear y validar la entrada usando Zod
    const parsedInput = inputSchema.parse({
      page: inputData.page ? Number(inputData.page) : 1,
      limit: inputData.limit ? Number(inputData.limit) : 12,
      category: inputData.category || 'all',
      maxPrice: inputData.maxPrice ? Number(inputData.maxPrice) : 5000,
      inStock: inputData.inStock === 'true'
    });

    // Ejecutar el handler con la entrada validada
    const result = await handler(parsedInput);
    
    // Devolver la respuesta como JSON
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // Manejar errores de validación o ejecución
    console.error("Error en el endpoint:", error);
    
    return new Response(JSON.stringify({
      error: "Error processing request",
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
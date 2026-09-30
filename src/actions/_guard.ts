// src/actions/_guard.ts
import { ActionError } from 'astro:actions';

// Lanza un error 403 si el usuario no es admin.
// Se llama al inicio del handler de cada action sensible.
export function assertAdmin(context: any) {
  if (!context?.locals?.isAdmin) {
    throw new ActionError({
      code: 'FORBIDDEN',
      message: 'No tienes permiso para realizar esta acción.',
    });
  }
}
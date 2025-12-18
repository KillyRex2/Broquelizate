// src/pages/api/auth/logout.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ redirect, cookies }) => {
  // Eliminar la cookie de sesión de auth-astro
  // El nombre de la cookie puede variar según tu configuración
  const cookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.csrf-token',
    '__Secure-authjs.csrf-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  // Eliminar todas las cookies posibles de auth
  cookieNames.forEach(name => {
    cookies.delete(name, { path: '/' });
  });

  // Redirigir al inicio
  return redirect('/', 302);
};

export const POST: APIRoute = async ({ redirect, cookies }) => {
  const cookieNames = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'authjs.csrf-token',
    '__Secure-authjs.csrf-token',
    'authjs.callback-url',
    '__Secure-authjs.callback-url',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  cookieNames.forEach(name => {
    cookies.delete(name, { path: '/' });
  });

  return redirect('/', 302);
};
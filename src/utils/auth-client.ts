// src/utils/auth-client.ts
//
// Inicio de sesión con correo y contraseña desde el navegador.
//
// No se usa signIn('credentials', { redirect: false }) de auth-astro porque
// su respuesta va al revés de lo que parece: cuando el login FUNCIONA, recarga
// la página y devuelve undefined; cuando FALLA, devuelve una respuesta con
// ok = true. Por eso el formulario mostraba "contraseña incorrecta" al entrar
// bien y mandaba al inicio (sin sesión) al equivocarse.

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string; message: string };

const MESSAGES: Record<string, string> = {
  CredentialsSignin: 'El correo o la contraseña son incorrectos.',
  Configuration: 'No pudimos iniciar sesión por un problema del servidor. Intenta de nuevo en unos minutos.',
  MissingCSRF: 'Tu sesión expiró. Recarga la página e intenta de nuevo.',
};

export async function signInWithCredentials(email: string, password: string): Promise<SignInResult> {
  try {
    const csrfRes = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    const { csrfToken } = await csrfRes.json();

    const res = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Auth.js responde { url } en JSON en lugar de redirigir
        'X-Auth-Return-Redirect': '1',
      },
      body: new URLSearchParams({
        email,
        password,
        csrfToken,
        callbackUrl: window.location.origin + '/',
      }),
    });

    let error: string | null = null;
    try {
      const data = await res.json();
      error = data?.url ? new URL(data.url, window.location.origin).searchParams.get('error') : null;
    } catch {
      error = res.ok ? null : 'Configuration';
    }
    if (!res.ok && !error) error = 'Configuration';

    if (error) {
      return { ok: false, error, message: MESSAGES[error] ?? 'No pudimos iniciar sesión. Intenta de nuevo.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network', message: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.' };
  }
}

/** A dónde ir después de entrar: ?redirect=/ruta (solo rutas del mismo sitio). */
export function getPostLoginUrl(): string {
  const target = new URLSearchParams(window.location.search).get('redirect') || '/';
  return target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login') && !target.startsWith('/register')
    ? target
    : '/';
}

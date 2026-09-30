// src/components/ToasterProvider.tsx
// Componente React para el Toaster de Sonner
// Usar en el layout con: <ToasterProvider client:load />

import { Toaster } from 'sonner';

export default function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      theme="dark"
      richColors
      closeButton
      duration={3000}
      toastOptions={{
        style: {
          background: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          fontFamily: 'inherit',
        },
        className: 'sonner-toast',
      }}
    />
  );
}
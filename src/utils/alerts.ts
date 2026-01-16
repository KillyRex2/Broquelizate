// src/utils/alerts.ts
// Sistema de alertas 100% compatible con Astro View Transitions
// Reemplaza SweetAlert2 que tiene problemas con las transiciones

import { toast } from 'sonner';

// ============================================
// TOASTS (notificaciones rápidas)
// ============================================
export const Toast = {
  success: (message: string, description?: string) => {
    toast.success(message, { description, duration: 3000 });
  },
  
  error: (message: string, description?: string) => {
    toast.error(message, { description, duration: 4000 });
  },
  
  warning: (message: string, description?: string) => {
    toast.warning(message, { description, duration: 3500 });
  },
  
  info: (message: string, description?: string) => {
    toast.info(message, { description, duration: 3000 });
  },
  
  loading: (message: string) => {
    return toast.loading(message);
  },
  
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },
  
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) => {
    return toast.promise(promise, messages);
  }
};

// ============================================
// CONFIRMACIONES (modales con dialog nativo)
// ============================================
interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const Confirm = {
  show: (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const {
        title,
        message = '',
        confirmText = 'Confirmar',
        cancelText = 'Cancelar',
        type = 'warning'
      } = options;

      const colors = {
        danger: { bg: '#dc2626', hover: '#b91c1c', iconBg: 'rgba(239, 68, 68, 0.15)', iconColor: '#f87171' },
        warning: { bg: '#eab308', hover: '#ca8a04', iconBg: 'rgba(234, 179, 8, 0.15)', iconColor: '#eab308' },
        info: { bg: '#3b82f6', hover: '#2563eb', iconBg: 'rgba(59, 130, 246, 0.15)', iconColor: '#60a5fa' }
      };

      const color = colors[type];

      const icons = {
        danger: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
        warning: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
        info: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
      };

      const dialog = document.createElement('dialog');
      dialog.id = 'confirm-dialog-' + Date.now();
      dialog.innerHTML = `
        <div class="confirm-backdrop"></div>
        <div class="confirm-content">
          <div class="confirm-icon" style="background: ${color.iconBg}; color: ${color.iconColor}">
            ${icons[type]}
          </div>
          <h3 class="confirm-title">${title}</h3>
          ${message ? `<p class="confirm-message">${message}</p>` : ''}
          <div class="confirm-buttons">
            <button type="button" class="confirm-btn confirm-btn-cancel">${cancelText}</button>
            <button type="button" class="confirm-btn confirm-btn-confirm" style="background: ${color.bg}">${confirmText}</button>
          </div>
        </div>
      `;

      const style = document.createElement('style');
      style.id = 'confirm-styles-' + dialog.id;
      style.textContent = `
        dialog#${dialog.id} {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          border: none;
          background: transparent;
          max-width: 100vw;
          max-height: 100vh;
          width: 100%;
          height: 100%;
        }
        dialog#${dialog.id}::backdrop { background: transparent; }
        dialog#${dialog.id} .confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          animation: confirmFadeIn 0.15s ease-out;
        }
        dialog#${dialog.id} .confirm-content {
          position: relative;
          background: #0a0a0a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 32px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          animation: confirmScaleIn 0.2s ease-out;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        dialog#${dialog.id} .confirm-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        dialog#${dialog.id} .confirm-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
        }
        dialog#${dialog.id} .confirm-message {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
          line-height: 1.5;
        }
        dialog#${dialog.id} .confirm-buttons {
          display: flex;
          gap: 12px;
        }
        dialog#${dialog.id} .confirm-btn {
          flex: 1;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        dialog#${dialog.id} .confirm-btn-cancel {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        dialog#${dialog.id} .confirm-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        dialog#${dialog.id} .confirm-btn-confirm {
          color: #000;
          font-weight: 700;
        }
        dialog#${dialog.id} .confirm-btn-confirm:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        @keyframes confirmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirmScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @media (max-width: 480px) {
          dialog#${dialog.id} .confirm-content { padding: 24px; border-radius: 16px; }
          dialog#${dialog.id} .confirm-buttons { flex-direction: column-reverse; }
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(dialog);
      dialog.showModal();

      const confirmBtn = dialog.querySelector('.confirm-btn-confirm') as HTMLButtonElement;
      const cancelBtn = dialog.querySelector('.confirm-btn-cancel') as HTMLButtonElement;
      const backdrop = dialog.querySelector('.confirm-backdrop') as HTMLElement;

      const cleanup = () => {
        dialog.close();
        setTimeout(() => { dialog.remove(); style.remove(); }, 100);
      };

      confirmBtn.addEventListener('click', () => { cleanup(); resolve(true); });
      cancelBtn.addEventListener('click', () => { cleanup(); resolve(false); });
      backdrop.addEventListener('click', () => { cleanup(); resolve(false); });
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { cleanup(); resolve(false); }
      });
    });
  },

  delete: (itemName: string = 'este elemento') => Confirm.show({
    title: '¿Eliminar?',
    message: `Se eliminará ${itemName} permanentemente.`,
    confirmText: 'Sí, eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  }),

  clear: (itemName: string = 'todo') => Confirm.show({
    title: '¿Vaciar?',
    message: `Se eliminará ${itemName}.`,
    confirmText: 'Sí, vaciar',
    cancelText: 'Cancelar',
    type: 'danger'
  }),

  action: (title: string, message?: string) => Confirm.show({
    title,
    message,
    confirmText: 'Continuar',
    cancelText: 'Cancelar',
    type: 'warning'
  })
};

// ============================================
// ALERTAS SIMPLES (solo botón OK)
// ============================================
interface AlertOptions {
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  buttonText?: string;
}

export const Alert = {
  show: (options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      const { title, message = '', type = 'info', buttonText = 'Entendido' } = options;

      const colors: Record<string, { bg: string; iconBg: string; icon: string }> = {
        success: { bg: '#22c55e', iconBg: 'rgba(34, 197, 94, 0.15)', icon: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>` },
        error: { bg: '#ef4444', iconBg: 'rgba(239, 68, 68, 0.15)', icon: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>` },
        warning: { bg: '#eab308', iconBg: 'rgba(234, 179, 8, 0.15)', icon: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>` },
        info: { bg: '#3b82f6', iconBg: 'rgba(59, 130, 246, 0.15)', icon: `<svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>` }
      };

      const color = colors[type];

      const dialog = document.createElement('dialog');
      dialog.id = 'alert-dialog-' + Date.now();
      dialog.innerHTML = `
        <div class="alert-backdrop"></div>
        <div class="alert-content">
          <div class="alert-icon" style="background: ${color.iconBg}; color: ${color.bg}">
            ${color.icon}
          </div>
          <h3 class="alert-title">${title}</h3>
          ${message ? `<p class="alert-message">${message}</p>` : ''}
          <button type="button" class="alert-btn" style="background: ${color.bg}">${buttonText}</button>
        </div>
      `;

      const style = document.createElement('style');
      style.id = 'alert-styles-' + dialog.id;
      style.textContent = `
        dialog#${dialog.id} {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          border: none;
          background: transparent;
          max-width: 100vw;
          max-height: 100vh;
          width: 100%;
          height: 100%;
        }
        dialog#${dialog.id}::backdrop { background: transparent; }
        dialog#${dialog.id} .alert-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(4px);
          animation: alertFadeIn 0.15s ease-out;
        }
        dialog#${dialog.id} .alert-content {
          position: relative;
          background: #0a0a0a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 32px;
          max-width: 360px;
          width: 100%;
          text-align: center;
          animation: alertScaleIn 0.2s ease-out;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        dialog#${dialog.id} .alert-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        dialog#${dialog.id} .alert-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
        }
        dialog#${dialog.id} .alert-message {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
          line-height: 1.5;
        }
        dialog#${dialog.id} .alert-btn {
          width: 100%;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          border: none;
          color: #000;
          transition: all 0.2s;
        }
        dialog#${dialog.id} .alert-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }
        @keyframes alertFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes alertScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `;

      document.head.appendChild(style);
      document.body.appendChild(dialog);
      dialog.showModal();

      const btn = dialog.querySelector('.alert-btn') as HTMLButtonElement;
      const backdrop = dialog.querySelector('.alert-backdrop') as HTMLElement;

      const cleanup = () => {
        dialog.close();
        setTimeout(() => { dialog.remove(); style.remove(); }, 100);
        resolve();
      };

      btn.addEventListener('click', cleanup);
      backdrop.addEventListener('click', cleanup);
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') cleanup();
      });
    });
  },

  success: (title: string, message?: string) => Alert.show({ title, message, type: 'success' }),
  error: (title: string, message?: string) => Alert.show({ title, message, type: 'error' }),
  info: (title: string, message?: string) => Alert.show({ title, message, type: 'info' }),
  warning: (title: string, message?: string) => Alert.show({ title, message, type: 'warning' }),
};
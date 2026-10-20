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

// ============================================
// FORMULARIO EN DIÁLOGO (reemplaza Swal.fire con html + inputs)
// ============================================
// Era lo último que ataba el POS a SweetAlert2: el diálogo de descuento
// necesitaba dos campos y aquí no había con qué hacerlo. Como el resto,
// inyecta su propio <style>, así que no se queda sin CSS al navegar con
// View Transitions — que es justo lo que le pasaba a Swal.

export interface PromptField {
  id: string;
  label: string;
  type?: 'text' | 'number';
  placeholder?: string;
  step?: string;
  value?: string;
}

interface PromptOptions {
  title: string;
  message?: string;
  fields: PromptField[];
  confirmText?: string;
  cancelText?: string;
  /** Escribir en un campo vacía los demás. Para opciones excluyentes. */
  exclusive?: boolean;
  /**
   * Revisa los valores antes de cerrar. Devuelve el mensaje de error, o
   * null si todo está bien. El diálogo se queda abierto con el error a la
   * vista, para no perder lo que ya se escribió.
   */
  validate?: (values: Record<string, string>) => string | null;
}

export const Prompt = {
  /** Resuelve con los valores por id, o null si se cancela. */
  show: (options: PromptOptions): Promise<Record<string, string> | null> => {
    return new Promise((resolve) => {
      const {
        title,
        message = '',
        fields,
        confirmText = 'Aplicar',
        cancelText = 'Cancelar',
        exclusive = false,
        validate,
      } = options;

      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const dialog = document.createElement('dialog');
      dialog.id = 'prompt-dialog-' + Date.now();
      dialog.innerHTML = `
        <div class="prompt-backdrop"></div>
        <form class="prompt-content" method="dialog">
          <h3 class="prompt-title">${esc(title)}</h3>
          ${message ? `<p class="prompt-message">${esc(message)}</p>` : ''}
          <div class="prompt-fields">
            ${fields.map(f => `
              <label class="prompt-field">
                <span>${esc(f.label)}</span>
                <input
                  type="${f.type ?? 'text'}"
                  data-field="${esc(f.id)}"
                  ${f.step ? `step="${esc(f.step)}"` : ''}
                  ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}
                  value="${f.value ? esc(f.value) : ''}"
                />
              </label>
            `).join('')}
          </div>
          <p class="prompt-error" hidden></p>
          <div class="prompt-buttons">
            <button type="button" class="prompt-btn prompt-btn-cancel">${esc(cancelText)}</button>
            <button type="submit" class="prompt-btn prompt-btn-confirm">${esc(confirmText)}</button>
          </div>
        </form>
      `;

      const style = document.createElement('style');
      style.id = 'prompt-styles-' + dialog.id;
      style.textContent = `
        dialog#${dialog.id} {
          position: fixed; inset: 0; z-index: 99999;
          display: flex; align-items: center; justify-content: center;
          padding: 16px; border: none; background: transparent;
          max-width: 100vw; max-height: 100vh; width: 100%; height: 100%;
        }
        dialog#${dialog.id}::backdrop { background: transparent; }
        dialog#${dialog.id} .prompt-backdrop {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8);
          animation: promptFadeIn 0.2s ease;
        }
        dialog#${dialog.id} .prompt-content {
          position: relative; background: #18181b; color: #fafafa;
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
          padding: 30px; width: 100%; max-width: 420px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          animation: promptScaleIn 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          display: flex; flex-direction: column; gap: 18px;
        }
        dialog#${dialog.id} .prompt-title {
          margin: 0; font-size: 1.15rem; font-weight: 700;
        }
        dialog#${dialog.id} .prompt-message {
          margin: -10px 0 0; font-size: 0.85rem; line-height: 1.5;
          color: rgba(250, 250, 250, 0.6);
        }
        dialog#${dialog.id} .prompt-fields {
          display: flex; flex-direction: column; gap: 14px;
        }
        dialog#${dialog.id} .prompt-field {
          display: flex; flex-direction: column; gap: 6px;
        }
        dialog#${dialog.id} .prompt-field span {
          font-size: 0.8rem; color: rgba(250, 250, 250, 0.7);
        }
        dialog#${dialog.id} .prompt-field input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px; padding: 11px 14px;
          color: #fafafa; font-size: 0.95rem; width: 100%;
        }
        dialog#${dialog.id} .prompt-field input:focus {
          outline: none; border-color: #eab308;
        }
        dialog#${dialog.id} .prompt-field input::placeholder {
          color: rgba(250, 250, 250, 0.3);
        }
        dialog#${dialog.id} .prompt-error {
          margin: 0; font-size: 0.82rem; color: #fca5a5;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 9px; padding: 9px 12px; line-height: 1.4;
        }
        dialog#${dialog.id} .prompt-error[hidden] { display: none; }
        dialog#${dialog.id} .prompt-buttons {
          display: flex; gap: 10px; justify-content: flex-end;
        }
        dialog#${dialog.id} .prompt-btn {
          border: none; border-radius: 10px; padding: 11px 20px;
          font-size: 0.9rem; font-weight: 600; cursor: pointer;
          transition: filter 0.15s, transform 0.15s;
        }
        dialog#${dialog.id} .prompt-btn-cancel {
          background: rgba(255, 255, 255, 0.08); color: #fafafa;
        }
        dialog#${dialog.id} .prompt-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        dialog#${dialog.id} .prompt-btn-confirm {
          background: #eab308; color: #000; font-weight: 700;
        }
        dialog#${dialog.id} .prompt-btn-confirm:hover {
          filter: brightness(1.1); transform: translateY(-1px);
        }
        @keyframes promptFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes promptScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @media (max-width: 480px) {
          dialog#${dialog.id} .prompt-content { padding: 24px; border-radius: 16px; }
          dialog#${dialog.id} .prompt-buttons { flex-direction: column-reverse; }
          dialog#${dialog.id} .prompt-btn { width: 100%; }
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(dialog);
      dialog.showModal();

      const form = dialog.querySelector('.prompt-content') as HTMLFormElement;
      const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[data-field]'));
      const cancelBtn = dialog.querySelector('.prompt-btn-cancel') as HTMLButtonElement;
      const backdrop = dialog.querySelector('.prompt-backdrop') as HTMLElement;

      inputs[0]?.focus();

      if (exclusive) {
        inputs.forEach(input => {
          input.addEventListener('input', () => {
            if (!input.value) return;
            inputs.forEach(other => { if (other !== input) other.value = ''; });
          });
        });
      }

      const cleanup = () => {
        dialog.close();
        setTimeout(() => { dialog.remove(); style.remove(); }, 100);
      };

      const errorEl = dialog.querySelector('.prompt-error') as HTMLParagraphElement;

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const values: Record<string, string> = {};
        inputs.forEach(i => { values[i.dataset.field!] = i.value; });

        if (validate) {
          const problema = validate(values);
          if (problema) {
            // No se cierra: se muestra el error y se conserva lo escrito.
            errorEl.textContent = problema;
            errorEl.hidden = false;
            return;
          }
          errorEl.hidden = true;
        }

        cleanup();
        resolve(values);
      });

      cancelBtn.addEventListener('click', () => { cleanup(); resolve(null); });
      backdrop.addEventListener('click', () => { cleanup(); resolve(null); });
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); cleanup(); resolve(null); });
    });
  },
};

// ============================================
// VISOR DE IMAGEN (reemplaza Swal.fire({ imageUrl }))
// ============================================
export const ImageViewer = {
  show: (src: string, alt: string = 'Imagen'): Promise<void> => {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.id = 'image-dialog-' + Date.now();
      dialog.innerHTML = `
        <div class="img-backdrop"></div>
        <div class="img-content">
          <button type="button" class="img-close" aria-label="Cerrar">&times;</button>
          <img src="${src}" alt="${alt.replace(/"/g, '&quot;')}" />
        </div>
      `;

      const style = document.createElement('style');
      style.id = 'image-styles-' + dialog.id;
      style.textContent = `
        dialog#${dialog.id} {
          position: fixed; inset: 0; z-index: 99999;
          display: flex; align-items: center; justify-content: center;
          padding: 16px; border: none; background: transparent;
          max-width: 100vw; max-height: 100vh; width: 100%; height: 100%;
        }
        dialog#${dialog.id}::backdrop { background: transparent; }
        dialog#${dialog.id} .img-backdrop {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(4px); animation: imgFadeIn 0.15s ease-out;
        }
        dialog#${dialog.id} .img-content {
          position: relative; max-width: min(92vw, 900px);
          animation: imgScaleIn 0.2s ease-out;
        }
        dialog#${dialog.id} .img-content img {
          display: block; max-width: 100%; max-height: 82vh; object-fit: contain;
          border-radius: 16px; background: #fff;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        }
        dialog#${dialog.id} .img-close {
          position: absolute; top: -14px; right: -14px; width: 36px; height: 36px;
          border-radius: 50%; border: none; cursor: pointer;
          background: #0a0a0a; color: #fff; font-size: 1.4rem; line-height: 1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        @keyframes imgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes imgScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `;

      document.head.appendChild(style);
      document.body.appendChild(dialog);
      dialog.showModal();

      const cleanup = () => {
        dialog.close();
        setTimeout(() => { dialog.remove(); style.remove(); }, 100);
        resolve();
      };

      dialog.querySelector('.img-close')?.addEventListener('click', cleanup);
      dialog.querySelector('.img-backdrop')?.addEventListener('click', cleanup);
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); cleanup(); }); // Escape
    });
  },
};


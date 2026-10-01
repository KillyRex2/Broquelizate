// src/store/cart.store.ts
import { atom } from 'nanostores';
import Cookies from 'js-cookie';

// Este store NO importa CartCookiesClient: cart-cookies.ts ya importa este
// store, y el ciclo (cart-cookies → store → cart-cookies) hacía que, según
// qué módulo cargara primero, `CartCookiesClient` aún no existiera aquí
// ("Cannot access 'CartCookiesClient' before initialization") y la lista de
// productos no se pintaba. Se lee la cookie directamente.
const countCartItems = (): number => {
  try {
    const cart = JSON.parse(Cookies.get('cart') ?? '[]');
    return Array.isArray(cart)
      ? cart.reduce((total: number, item: any) => total + (Number(item?.quantity) || 0), 0)
      : 0;
  } catch {
    return 0;
  }
};

export const itemsInCart = atom(countCartItems());

export const updateCartStore = () => {
  itemsInCart.set(countCartItems());
};

export const clearCartStore = () => {
  itemsInCart.set(0);
};

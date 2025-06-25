// src/store/index.ts
import { atom } from 'nanostores';
import { CartCookiesClient } from '../utils/cart-cookies';

export const itemsInCart = atom(CartCookiesClient.getTotalItems());

export const updateCartStore = () => {
  itemsInCart.set(CartCookiesClient.getTotalItems());
};

export const clearCartStore = () => {
  itemsInCart.set(0);
};
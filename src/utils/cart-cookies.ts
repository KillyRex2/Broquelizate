// src/utils/cart-cookies.ts
import type { CartItem } from "@/interfaces";
import Cookies from 'js-cookie';
import { updateCartStore, clearCartStore } from '@/store'; // Importa los métodos del store

export class CartCookiesClient {
    static getCart(): CartItem[] {
        return JSON.parse(Cookies.get('cart') ?? '[]');
    }

    static addItem(cartItem: CartItem): CartItem[] {
        const cart = this.getCart();
        const existingIndex = cart.findIndex(item => item.productId === cartItem.productId);
        
        // SOLUCIÓN: Actualizar en lugar de sumar
        if (existingIndex > -1) {
            // Reemplazar cantidad en lugar de sumar
            cart[existingIndex].quantity = cartItem.quantity;
        } else {
            cart.push(cartItem);
        }

        this.setCart(cart);
        updateCartStore();
        return cart;
    }

    static removeItem(productId: string): CartItem[] {
        const cart = this.getCart();
        const updatedCart = cart.filter(item => item.productId !== productId);
        this.setCart(updatedCart);
        updateCartStore(); // Actualiza el store
        return updatedCart;
    }

 static updateItemQuantity(productId: string, quantity: number): CartItem[] {
    // SOLUCIÓN: Validar cantidad máxima
    const validQuantity = Math.max(1, Math.min(99, quantity));
    
    if (validQuantity <= 0) return this.removeItem(productId);
    
    const cart = this.getCart();
    const item = cart.find(item => item.productId === productId);
    
    if (item) {
        item.quantity = validQuantity;  // Usar cantidad validada
        this.setCart(cart);
        updateCartStore();
    }
    
    return cart;
}

    static incrementQuantity(productId: string, amount: number = 1): CartItem[] {
        const cart = this.getCart();
        const item = cart.find(item => item.productId === productId);
        
        if (item) {
            item.quantity += amount;
            if (item.quantity <= 0) return this.removeItem(productId);
            this.setCart(cart);
            updateCartStore(); // Actualiza el store
        }
        
        return cart;
    }

    static clearCart(): CartItem[] {
        this.setCart([]);
        clearCartStore(); // Actualiza el store a 0
        return [];
    }

    static getItemQuantity(productId: string): number {
        const cart = this.getCart();
        const item = cart.find(item => item.productId === productId);
        return item ? item.quantity : 0;
    }

    static getTotalItems(): number {
        const cart = this.getCart();
        return cart.reduce((total, item) => total + item.quantity, 0);
    }

    static getTotalPrice(products: {id: string, price: number}[] = []): number {
        const cart = this.getCart();
        return cart.reduce((total, cartItem) => {
            const product = products.find(p => p.id === cartItem.productId);
            return total + (product ? product.price * cartItem.quantity : 0);
        }, 0);
    }

    private static setCart(cart: CartItem[]): void {
        Cookies.set('cart', JSON.stringify(cart), {
            expires: 30, // 30 días de expiración
            sameSite: 'strict',
            path: '/'
        });
    }
}
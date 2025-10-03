// src/utils/cart-cookies.ts
import type { CartItem } from "@/interfaces";
import Cookies from 'js-cookie';
import { updateCartStore, clearCartStore } from '@/store';

export class CartCookiesClient {
    static getCart(): CartItem[] {
        return JSON.parse(Cookies.get('cart') ?? '[]');
    }

    static addItem(cartItem: CartItem): CartItem[] {
        const cart = this.getCart();
        
        // Buscar por productId y también por variantId/combinationId si existen
        const existingIndex = cart.findIndex(item => 
            item.productId === cartItem.productId && 
            item.variantId === cartItem.variantId &&
            item.combinationId === cartItem.combinationId
        );
        
        if (existingIndex > -1) {
            // Si existe el mismo producto con la misma variante, actualizar cantidad
            cart[existingIndex].quantity = cartItem.quantity;
        } else {
            // Si no existe o es una variante diferente, agregar como nuevo item
            cart.push(cartItem);
        }

        this.setCart(cart);
        updateCartStore();
        return cart;
    }

    static removeItem(productId: string, variantId?: string, combinationId?: string): CartItem[] {
        const cart = this.getCart();
        
        // Filtrar considerando variantes
        const updatedCart = cart.filter(item => {
            if (variantId || combinationId) {
                // Si se especifica variante, comparar todo
                return !(
                    item.productId === productId && 
                    item.variantId === variantId && 
                    item.combinationId === combinationId
                );
            } else {
                // Si no hay variante, solo remover items sin variante del mismo producto
                return !(
                    item.productId === productId && 
                    !item.variantId && 
                    !item.combinationId
                );
            }
        });
        
        this.setCart(updatedCart);
        updateCartStore();
        return updatedCart;
    }

    static updateItemQuantity(
        productId: string, 
        quantity: number, 
        variantId?: string, 
        combinationId?: string
    ): CartItem[] {
        const validQuantity = Math.max(1, Math.min(99, quantity));
        
        if (validQuantity <= 0) {
            return this.removeItem(productId, variantId, combinationId);
        }
        
        const cart = this.getCart();
        
        // Buscar el item específico considerando variantes
        const item = cart.find(item => 
            item.productId === productId && 
            item.variantId === variantId && 
            item.combinationId === combinationId
        );
        
        if (item) {
            item.quantity = validQuantity;
            this.setCart(cart);
            updateCartStore();
        }
        
        return cart;
    }

    static incrementQuantity(
        productId: string, 
        amount: number = 1,
        variantId?: string,
        combinationId?: string
    ): CartItem[] {
        const cart = this.getCart();
        
        const item = cart.find(item => 
            item.productId === productId && 
            item.variantId === variantId && 
            item.combinationId === combinationId
        );
        
        if (item) {
            item.quantity += amount;
            if (item.quantity <= 0) {
                return this.removeItem(productId, variantId, combinationId);
            }
            this.setCart(cart);
            updateCartStore();
        }
        
        return cart;
    }

    static clearCart(): CartItem[] {
        this.setCart([]);
        clearCartStore();
        return [];
    }

    static getItemQuantity(
        productId: string,
        variantId?: string,
        combinationId?: string
    ): number {
        const cart = this.getCart();
        
        const item = cart.find(item => 
            item.productId === productId && 
            item.variantId === variantId && 
            item.combinationId === combinationId
        );
        
        return item ? item.quantity : 0;
    }

    static getTotalItems(): number {
        const cart = this.getCart();
        return cart.reduce((total, item) => total + item.quantity, 0);
    }

    static getTotalPrice(products: {
        id: string, 
        price: number,
        variantId?: string,
        combinationId?: string,
        variantPrice?: number
    }[] = []): number {
        const cart = this.getCart();
        
        return cart.reduce((total, cartItem) => {
            // Buscar el producto correspondiente
            const product = products.find(p => 
                p.id === cartItem.productId &&
                p.variantId === cartItem.variantId &&
                p.combinationId === cartItem.combinationId
            );
            
            if (product) {
                // Usar precio con variante si existe, sino precio base
                const price = product.variantPrice ?? product.price;
                return total + (price * cartItem.quantity);
            }
            
            return total;
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
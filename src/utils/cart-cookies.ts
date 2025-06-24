import type { CartItem } from "@/interfaces";
import Cookies from 'js-cookie';

export class CartCookiesClient {
    static getCart(): CartItem[] {
        return JSON.parse(Cookies.get('cart') ?? '[]');
    }

    static addItem(cartItem: CartItem): CartItem[] {
        const cart = this.getCart();
        const existingItem = cart.find(item => item.productId === cartItem.productId);

        if (existingItem) {
            existingItem.quantity += cartItem.quantity;
        } else {
            cart.push(cartItem);
        }

        this.setCart(cart);
        return cart;
    }

    static removeItem(productId: string): CartItem[] {
        const cart = this.getCart();
        const updatedCart = cart.filter(item => item.productId !== productId);
        this.setCart(updatedCart);
        return updatedCart;
    }

    static updateItemQuantity(productId: string, quantity: number): CartItem[] {
        if (quantity <= 0) return this.removeItem(productId);
        
        const cart = this.getCart();
        const item = cart.find(item => item.productId === productId);
        
        if (item) {
            item.quantity = quantity;
            this.setCart(cart);
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
        }
        
        return cart;
    }

    static clearCart(): CartItem[] {
        this.setCart([]);
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
import type { CartItem } from "@/interfaces";
import Cookies from 'js-cookie';



export class CartCookiesClient {

    static getCart(): CartItem[] {
        return JSON.parse(Cookies.get('cart') ?? '[]');
    }

    static addItem(cartItem: CartItem): CartItem[] {
        
        const cart = CartCookiesClient.getCart();

        const itemInCart = cart.find(
            (item) => item.productId === cartItem.productId 
        )

        if (itemInCart) {
            itemInCart.quantity += cartItem.quantity;
        } else {
            cart.push(cartItem)
        }

        Cookies.set('cart', JSON.stringify(cart))


        return cart;       
    }

    static removeItem(productId: string): CartItem[] {
        
        const cart = CartCookiesClient.getCart();

        console.log({productId})

        const updatedCart = cart.filter(
            (item) => !(item.productId === productId && item) 
        )
        console.log(updatedCart);
        Cookies.set('cart', JSON.stringify(updatedCart))

        return updatedCart;
    }
}
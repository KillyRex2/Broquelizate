import { loginUser, logout, registerUser } from "./auth";
import { getProductBySlug } from "./products/get-product-by-slug.action";
import { getProductsByPage } from "./products/get-products-by-page.action";
import { loadProductsFromCart } from "./cart/load-products-from-cart.actions";

export const server = {
    // server actions

    // Auth
    registerUser,
    logout,
    loginUser,
    
    // Products
    getProductsByPage,
    getProductBySlug,

    // Cart
    loadProductsFromCart,
}
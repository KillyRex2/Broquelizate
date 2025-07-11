import { loginUser, logout, registerUser } from "./auth";
import { getProductBySlug } from "./products/get-product-by-slug.action";
import { getProductsByPage } from "./products/get-products-by-page.action";
import { loadProductsFromCart } from "./cart/load-products-from-cart.actions";
import { crateUpdateProduct } from "./admin/create-update-product.action";
import { deleteProductImage } from "./products/delete-product-image.actions";
import { deleteProduct } from "./admin/create-update-product.action";
import { getClientById, updateClient } from './admin/update-client.action'

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

    // Admin (Products)
    crateUpdateProduct,
    deleteProductImage,
    deleteProduct,

    // Admin Client
    updateClient,
    getClientById
}
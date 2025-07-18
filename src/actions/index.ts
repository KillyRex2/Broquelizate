import { loginUser, logout, registerUser } from "./auth";
import { getProductBySlug } from "./products/get-product-by-slug.action";
import { getInventoryStats, getProductsByPage } from "./products/get-products-by-page.action";
import { loadProductsFromCart } from "./cart/load-products-from-cart.actions";
import { crateUpdateProduct } from "./admin/create-update-product.action";
import { deleteProductImage } from "./products/delete-product-image.actions";
import { deleteProduct } from "./admin/create-update-product.action";
import { getClientById, updateClient, getAllClients, updateClientBalance } from './admin/update-client.action'
import { getAllProductsWithImages } from "./admin/get-all-products.action";
import { capturePaypalOrder, createPaypalOrder } from "./admin/paypal";

export const server = {
    // server actions

    // Auth
    registerUser,
    logout,
    loginUser,
    
    // Products
    getProductsByPage,
    getProductBySlug,
    getInventoryStats,
    

    // Cart
    loadProductsFromCart,

    // Admin (Products)
    crateUpdateProduct,
    deleteProductImage,
    deleteProduct,
    getAllProductsWithImages,

    // Admin Client
    updateClient,
    getClientById,
    getAllClients,
    updateClientBalance,

    // Paypal
    createPaypalOrder,
    capturePaypalOrder
}
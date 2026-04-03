import { loginUser, logout, registerUser } from "./auth";
import { getProductBySlug } from "./products/get-product-by-slug.action";
import { getInventoryStats, getProductsByPage } from "./products/get-products-by-page.action";
import { loadProductsFromCart } from "./cart/load-products-from-cart.actions";
import { crateUpdateProduct, uploadEngravingImage, deleteEngravingImage, setProductCoverImage, deleteCustomizationImage, uploadCustomizationImage} from "./admin/create-update-product.action";
import { deleteProductImage, uploadVariantImage, deleteVariantImage } from "./admin/create-update-product.action";
import { deleteProduct } from "./admin/create-update-product.action";
import { getClientById, updateClient, getAllClients, updateClientBalance } from './admin/update-client.action'
import { getAllProductsWithImages } from "./admin/get-all-products.action";
import { capturePaypalOrder, createPaypalOrder } from "./admin/paypal";
import { subscribeToNewsletter } from "./newsletter/newsletter.action";
import { createBatchVariants, generateVariantCombinations, updateCombinationStock, getGroupedProductVariants, deleteVariant, deleteVariantGroup, updateVariant, getVariantCombination, updateVariantGroup, uploadCombinationImage, deleteCombinationImage } from "./admin/product-variants.action";
import {createShippingLabel, trackShipment, getUserShipments, getShippingRates, updateOrderStatus, updateOrderShippingAddress, updateShippingAddress, getUserProfile, updateUserProfile, getUserProfileByEmail} from './envia/envia.action';
import type { set } from "date-fns";

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
    uploadVariantImage,
    deleteVariantImage,
    uploadEngravingImage,
    deleteEngravingImage,
    setProductCoverImage,
    deleteCustomizationImage,
    uploadCustomizationImage,

    // Admin Client
    updateClient,
    getClientById,
    getAllClients,
    updateClientBalance,

    // Paypal
    createPaypalOrder,
    capturePaypalOrder,

    // Newsletter
    subscribeToNewsletter,
    
    // Variants
    getVariantCombination,
    getGroupedProductVariants,
    createBatchVariants,
    generateVariantCombinations,
    updateCombinationStock,
    deleteVariant,
    deleteVariantGroup,
    updateVariant,
    updateVariantGroup,
    uploadCombinationImage,
    deleteCombinationImage,


    // Shipment
    createShippingLabel,
    trackShipment,
    getShippingRates,
    getUserShipments,
    updateOrderStatus,
    updateOrderShippingAddress,
    updateShippingAddress,
    getUserProfile,
    updateUserProfile,
    getUserProfileByEmail
}
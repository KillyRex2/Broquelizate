export interface ProductWithImages {
    id: string;
    name: string;
    price: number;
    description: string;
    category: string;
    slug: string;
    type: string;
    stock: number;
    user: string;
    piercing_name: string[];
    images: string[];
}
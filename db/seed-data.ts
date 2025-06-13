interface SeedProduct {
    name: string;
    images: string[];
    price: number;
    description: string;
    category: ValidCategories;
    type: ValidTypes;
    slug: string;
    stock: number;
}

type ValidCategories = 'Titanio' | 'Acero Quirúrgico' | 'Oro 10k' | 'Oro 14k' | 'Oro 18k'| 'Chapa de Oro 14K' | 'Chapa de Oro 18k' | 'Acero Inoxidable'| 'Plástico'| 'Plata' | 'Rodio'
type ValidTypes =  'Anillos' | 'Broqueles'| 'Pulseras'| 'Cadenas'

export const seedProducts: SeedProduct[] = [
  {
    name: 'Arracada piedras 10mm (pieza)',
    images: [
      'product676.jpg',
      'product676hover.jpg'
    ],
    price: 380.0,
    description: 'Elegante arracada piedras 10mm (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Titanio',
    type: 'Broqueles',
    slug: 'arracada_piedras_10mm_pieza',
    stock: 7
  },
  {
    name: 'Arracada piedras 8mm (pieza)',
    images: [
      'product676.jpg',
      'product676hover.jpg'
    ],
    price: 360.0,
    description: 'Elegante arracada piedras 8mm (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Titanio',
    type: 'Broqueles',
    slug: 'arracada_piedras_8mm_pieza',
    stock: 4
  },
  {
    name: 'Espada gota (pieza)',
    images: [
      'product798.jpg',
      'product798hover.jpg'
    ],
    price: 360.0,
    description: 'Elegante espada gota (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Titanio',
    type: 'Broqueles',
    slug: 'espada_gota_pieza',
    stock: 0
  },
  {
    name: 'Arracadas diamantadas #6 (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 100.0,
    description: 'Elegante arracadas diamantadas #6 (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'arracadas_diamantadas_6_par',
    stock: 1
  },
  {
    name: 'Arracadas diamantadas #2.5 (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 70.0,
    description: 'Elegante arracadas diamantadas #2.5 (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'arracadas_diamantadas_2_5_par',
    stock: 1
  },
  {
    name: 'Recto estrella #4 (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 120.0,
    description: 'Elegante recto estrella #4 (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'recto_estrella_4_par',
    stock: 1
  },
  {
    name: 'Recto corazón #5 (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 130.0,
    description: 'Elegante recto corazón #5 (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'recto_corazon_5_par',
    stock: 1
  },
  {
    name: 'Bisel redondo #5 (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 130.0,
    description: 'Elegante bisel redondo #5 (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'bisel_redondo_5_par',
    stock: 1
  },
  {
    name: 'Arracada penacho 10mm (pieza)',
    images: [
      'product549.jpg',
      'product549hover.jpg'
    ],
    price: 550.0,
    description: 'Elegante arracada penacho 10mm (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Titanio',
    type: 'Broqueles',
    slug: 'arracada_penacho_10mm_pieza',
    stock: 0
  },
  {
    name: 'Piedra lágrima #7.5 (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 130.0,
    description: 'Elegante piedra lágrima #7.5 (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'piedra_lagrima_7_5_par',
    stock: 1
  },
  {
    name: 'Piercing arracada nostril delgada (pieza)',
    images: [
      'product558.jpg',
      'logo-blanco.png'
    ],
    price: 80.0,
    description: 'Elegante piercing arracada nostril delgada (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Acero Quirúrgico',
    type: 'Broqueles',
    slug: 'piercing_arracada_nostril_delgada_pieza',
    stock: 32
  },
  {
    name: 'VC Negro (par)',
    images: [
      'logo-blanco.png',
      'logo-blanco.png'
    ],
    price: 150.0,
    description: 'Elegante vc negro (par) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Chapa de Oro 14K',
    type: 'Broqueles',
    slug: 'vc_negro_par',
    stock: 0
  },
  {
    name: 'Piercing arracada con dije (pieza)',
    images: [
      'product559.jpg',
      'logo-blanco.png'
    ],
    price: 150.0,
    description: 'Elegante piercing arracada con dije (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Acero Quirúrgico',
    type: 'Broqueles',
    slug: 'piercing_arracada_con_dije_pieza',
    stock: 1
  },
  {
    name: 'Piercing septum (pieza)',
    images: [
      'product562.jpg',
      'logo-blanco.png'
    ],
    price: 100.0,
    description: 'Elegante piercing septum (pieza) que realza tu estilo con sofisticación y calidad excepcional.',
    category: 'Acero Quirúrgico',
    type: 'Broqueles',
    slug: 'piercing_septum_pieza',
    stock: 17
  },
];

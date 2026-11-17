
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database massively...');

  // 1. Neteja
  try {
      await prisma.price.deleteMany({});
      await prisma.product.deleteMany({});
      console.log('🧹 Cleaned up old data');
  } catch(e) {
      console.log('⚠️ Could not clean up old data');
  }

  // 2. Supermercats
  const supermarkets = [
    { name: 'Mercadona', slug: 'mercadona', website: 'https://www.mercadona.es', color: '#00a650' },
    { name: 'Lidl', slug: 'lidl', website: 'https://www.lidl.es', color: '#0050aa' },
    { name: 'Carrefour', slug: 'carrefour', website: 'https://www.carrefour.es', color: '#004e9f' },
    { name: 'Aldi', slug: 'aldi', website: 'https://www.aldi.es', color: '#00005f' },
    { name: 'Bonpreu', slug: 'bonpreu', website: 'https://www.bonpreuesclat.cat', color: '#e30613' },
    { name: 'Consum', slug: 'consum', website: 'https://www.consum.es', color: '#e2001a' },
    { name: 'Dia', slug: 'dia', website: 'https://www.dia.es', color: '#e30613' },
    { name: 'Eroski', slug: 'eroski', website: 'https://www.eroski.es', color: '#e30613' },
    { name: 'Alcampo', slug: 'alcampo', website: 'https://www.alcampo.es', color: '#00a651' },
  ];

  for (const supermarket of supermarkets) {
    await prisma.supermarket.upsert({
      where: { slug: supermarket.slug },
      update: supermarket,
      create: supermarket,
    });
  }
  console.log(`✅ Created ${supermarkets.length} supermarkets`);

  // 3. Generació massiva de productes
  const CATEGORIES: Record<string, string[]> = {
    'Fruita i Verdura': ['Poma', 'Plàtan', 'Pera', 'Taronja', 'Mandarina', 'Llimona', 'Patata', 'Ceba', 'All', 'Pastanaga', 'Enciam', 'Tomàquet', 'Pebrot', 'Carabassó', 'Albergínia', 'Cogombre', 'Espinacs', 'Bledes', 'Bròquil', 'Coliflor', 'Mongeta Verda'],
    'Carn i Peix': ['Pollastre', 'Pit de Pollastre', 'Hamburguesa', 'Porc', 'Llom', 'Vedella', 'Bistec', 'Carn Picada', 'Salsitxes', 'Lluç', 'Salmó', 'Tonyina', 'Bacallà', 'Sardines', 'Llagostins', 'Musclos'],
    'Lactis i Ous': ['Llet Sencera', 'Llet Semidesnatada', 'Llet Desnatada', 'Llet sense Lactosa', 'Iogurt Natural', 'Iogurt Maduixa', 'Iogurt Grec', 'Formatge Fresc', 'Formatge Ratllat', 'Formatge Tendre', 'Formatge Curat', 'Formatge Blau', 'Mantega', 'Ous L', 'Ous M', 'Nata Cuina'],
    'Pa i Pastisseria': ['Pa de Pagès', 'Barra de Pa', 'Pa de Motlle', 'Pa Integral', 'Croissants', 'Magdalenes', 'Galetes Maria', 'Galetes Xocolata', 'Biscotes'],
    'Begudes': ['Aigua Mineral', 'Aigua amb Gas', 'Coca-Cola', 'Fanta Taronja', 'Fanta Llimona', 'Aquarius', 'Nestea', 'Cervesa', 'Cervesa sense Alcohol', 'Vi Negre', 'Vi Blanc', 'Cava', 'Suc de Taronja', 'Suc de Pinya'],
    'Rebost': ['Arròs Rodó', 'Arròs Llarg', 'Pasta Macarrons', 'Pasta Espaguetis', 'Pasta Fideus', 'Oli d\'Oliva Verge Extra', 'Oli Gira-sol', 'Vinagre', 'Sal', 'Sucre', 'Farina', 'Lentilles', 'Cigrons', 'Mongetes Blanques', 'Tomàquet Fregit', 'Olives', 'Tonyina en Llauna', 'Cafè Mòlt', 'Càpsules Cafè', 'Cacao en Pols', 'Infusió Camamilla', 'Infusió Te'],
    'Neteja i Llar': ['Detergent Roba', 'Suavitzant', 'Rentaplats Màur', 'Pastilles Rentaplats', 'Lleixiu', 'Fregasols', 'Paper Higiènic', 'Paper de Cuina', 'Tovallons', 'Bossa Escombraries'],
    'Higiene': ['Gel de Dutxa', 'Xampú', 'Condicionador', 'Desodorant', 'Pasta de Dents', 'Raspall de Dents', 'Gel de Mans', 'Compreses', 'Bolquers']
  };

  const GENERIC_BRANDS = ['HACENDADO', 'BONPREU', 'CONSUM', 'DIA', 'CARREFOUR', 'LIDL', 'ALDI', 'EROSKI', 'AUCHAN', 'GENÈRIC'];
  const PREMIUM_BRANDS: Record<string, string[]> = {
    'Lactis i Ous': ['ATO', 'PASCUAL', 'LLET NOSTRA', 'DANONE', 'PRESIDENT', 'EL CIGARRAL', 'LA MASIA'],
    'Begudes': ['FONT VELLA', 'VILADRAU', 'BEZOYA', 'VICHY', 'DAMM', 'SAN MIGUEL', 'MAHOU', 'TORRES', 'CODORNIU', 'DON SIMON'],
    'Rebost': ['GALLO', 'BARILLA', 'NOMEN', 'SOS', 'BORGES', 'CARBONELL', 'LA FALLERA', 'LITORAL', 'NESTLE', 'MARCILLA', 'COLA CAO'],
    'Neteja i Llar': ['ARIEL', 'SKIP', 'FAIRY', 'FINISH', 'SCOTTEX', 'COLHOGAR', 'KH-7'],
    'Higiene': ['NIVEA', 'DOVE', 'PANTENE', 'COLGATE', 'ORAL-B', 'DODOT', 'EUREKA'],
    'Fruita i Verdura': ['GENÈRIC'],
    'Carn i Peix': ['GENÈRIC'],
    'Pa i Pastisseria': ['BIMBO', 'SILUETA', 'FONTANEDA', 'GENÈRIC']
  };

  const UNITS: Record<string, string> = {
    'Fruita i Verdura': 'kg',
    'Carn i Peix': 'kg',
    'Lactis i Ous': 'u',
    'Pa i Pastisseria': 'u',
    'Begudes': 'L',
    'Rebost': 'ud',
    'Neteja i Llar': 'ud',
    'Higiene': 'ud'
  };
  const REAL_MERCADONA_IMAGES: Record<string, string> = {
    "llet sencera": "https://prod-mercadona.imgix.net/images/c2919d36676cf45347b705030761e05d.jpg?fit=crop&h=300&w=300",
    "llet semidesnatada": "https://prod-mercadona.imgix.net/images/50849479e00643799863773177894a86.jpg?fit=crop&h=300&w=300",
    "oli d'oliva": "https://prod-mercadona.imgix.net/images/65c2349950feb1958362e06217003b10.jpg?fit=crop&h=300&w=300",
    "oli d'oliva verge extra": "https://prod-mercadona.imgix.net/images/efb4b2c1a0e2cb8d9d522a815c295fa0.jpg?fit=crop&h=300&w=300",
    "tomàquet fregit": "https://prod-mercadona.imgix.net/images/ca08b8d55e7b2261986a8b339346566e.jpg?fit=crop&h=300&w=300",
    "arròs": "https://prod-mercadona.imgix.net/images/a037840134015df614457e55959954a6.jpg?fit=crop&h=300&w=300",
    "macarrons": "https://prod-mercadona.imgix.net/images/87e795245842c0c16b14619736868848.jpg?fit=crop&h=300&w=300",
    "espaguetis": "https://prod-mercadona.imgix.net/images/1381389814407887d1591f81014cc679.jpg?fit=crop&h=300&w=300",
    "coca-cola": "https://prod-mercadona.imgix.net/images/4a9c69f201083161c8340df10bc75323.jpg?fit=crop&h=300&w=300",
    "aigua": "https://prod-mercadona.imgix.net/images/b078972579b1297ce71b8782cc12140e.jpg?fit=crop&h=300&w=300",
    "pollastre": "https://prod-mercadona.imgix.net/images/52077ef293144883bb37025875743b17.jpg?fit=crop&h=300&w=300",
    "formatge": "https://prod-mercadona.imgix.net/images/88d8b584764836691498b81313437c78.jpg?fit=crop&h=300&w=300",
    "ous": "https://prod-mercadona.imgix.net/images/ab5d32694b8c950157948218731057c3.jpg?fit=crop&h=300&w=300",
    "poma": "https://prod-mercadona.imgix.net/images/6df00d33b69205562095861614757366.jpg?fit=crop&h=300&w=300",
    "plàtan": "https://prod-mercadona.imgix.net/images/07d37750835848902517044037599723.jpg?fit=crop&h=300&w=300",
    "xampú": "https://prod-mercadona.imgix.net/images/b9829f07cc1393663a87693630f52627.jpg?fit=crop&h=300&w=300",
    "gel de dutxa": "https://prod-mercadona.imgix.net/images/d6872951f0458b98126742918e74567c.jpg?fit=crop&h=300&w=300",
    "paper higiènic": "https://prod-mercadona.imgix.net/images/735c05d7621c8334466986283738b555.jpg?fit=crop&h=300&w=300"
  };

  const REAL_IMAGES: Record<string, string> = {
    // Fruit & Veg
    'Poma': 'https://images.openfoodfacts.org/images/products/506/048/284/0179/front_en.25.400.jpg',
    'Plàtan': 'https://images.openfoodfacts.org/images/products/611/124/210/2941/front_en.47.400.jpg',
    'Tomàquet': 'https://images.openfoodfacts.org/images/products/611/118/400/4730/front_en.51.400.jpg',
    'Patata': 'https://images.openfoodfacts.org/images/products/327/655/485/3506/front_fr.4.400.jpg', // Generic potato like
    'Ceba': 'https://images.openfoodfacts.org/images/products/327/655/901/5686/front_fr.4.400.jpg', // Onion
    
    // Dairy
    'Llet': 'https://images.openfoodfacts.org/images/products/611/124/210/0992/front_fr.172.400.jpg',
    'Formatge': 'https://images.openfoodfacts.org/images/products/611/124/672/1261/front_fr.94.400.jpg',
    'Ous': 'https://images.openfoodfacts.org/images/products/500/015/707/6410/front_en.46.400.jpg',
    'Iogurt': 'https://images.openfoodfacts.org/images/products/303/349/000/4743/front_fr.65.400.jpg', // Danone like


    // Meat/Fish
    'Pollastre': 'https://images.openfoodfacts.org/images/products/501/366/511/2235/front_en.38.400.jpg',
    'Hamburguesa': 'https://images.openfoodfacts.org/images/products/326/385/988/3715/front_fr.4.400.jpg',
    
    // Pantry
    'Arròs': 'https://images.openfoodfacts.org/images/products/501/366/510/0065/front_en.58.400.jpg',
    'Pasta': 'https://images.openfoodfacts.org/images/products/807/680/019/5057/front_en.3704.400.jpg',
    'Oli': 'https://images.openfoodfacts.org/images/products/871/920/023/7902/front_en.29.400.jpg',
    'Pa': 'https://images.openfoodfacts.org/images/products/502/512/500/0006/front_en.106.400.jpg',

    // Drinks
    'Coca-Cola': 'https://images.openfoodfacts.org/images/products/544/900/021/4799/front_en.326.400.jpg',
    'Cervesa': 'https://images.openfoodfacts.org/images/products/506/010/845/0386/front_fr.43.400.jpg',
    'Aigua': 'https://images.openfoodfacts.org/images/products/611/103/500/0430/front_en.104.400.jpg',

    // Home
    'Paper Higiènic': 'https://images.openfoodfacts.org/images/products/356/007/109/5000/front_fr.18.400.jpg',
    'Detergent': 'https://images.openfoodfacts.org/images/products/356/470/044/4337/front_fr.4.400.jpg',
    'Xampú': 'https://images.openfoodfacts.org/images/products/871/895/162/4795/front_fr.7.400.jpg'
  };

  const getRandomImage = (baseName: string, category: string): string => {
    // 0. Prefer Mercadona Real Images (High Quality)
    const normalized = baseName.toLowerCase();
    const mercadonaKey = Object.keys(REAL_MERCADONA_IMAGES).find(k => normalized.includes(k));
    if (mercadonaKey) return REAL_MERCADONA_IMAGES[mercadonaKey];

    // 1. Direct match OpenFoodFacts
    if (REAL_IMAGES[baseName]) return REAL_IMAGES[baseName];
    
    // 2. Partial match OpenFoodFacts
    const key = Object.keys(REAL_IMAGES).find(k => baseName.includes(k));
    if (key) return REAL_IMAGES[key];

    // 3. Category Fallback
    if (category === 'Fruita i Verdura') return REAL_MERCADONA_IMAGES['poma'];
    if (category === 'Carn i Peix') return REAL_MERCADONA_IMAGES['pollastre'];
    if (category === 'Lactis i Ous') return REAL_MERCADONA_IMAGES['llet sencera'];
    if (category === 'Begudes') return REAL_MERCADONA_IMAGES['aigua'];
    if (category === 'Neteja i Llar') return REAL_MERCADONA_IMAGES['paper higiènic'];
    
    return 'https://images.openfoodfacts.org/images/products/506/048/284/0179/front_en.25.400.jpg'; // Default safe image
  };

  const SIZES: Record<string, number[]> = {
    'Begudes': [0.33, 0.5, 1, 1.5, 2],
    'Rebost': [0.25, 0.5, 1],
    'Lactis i Ous': [1, 0.5, 0.25],
    'default': [1]
  };

  let totalProducts = 0;
  const productsToCreate = [];

  // Generar llista de productes potencials
  for (const [category, items] of Object.entries(CATEGORIES)) {
      for (const itemBaseName of items) {
          // A. Marca Blanca (un per cada super)
          for (const superData of supermarkets) {
               if (Math.random() > 0.3) { // 70% de probabilitat que existeixi la marca blanca
                   const brandName = superData.slug === 'mercadona' ? 'HACENDADO' : 
                                     superData.slug === 'bonpreu' ? 'BONPREU' :
                                     superData.slug === 'lidl' ? 'MILBONA' : 
                                     superData.slug === 'aldi' ? 'MILSANI' : 
                                     superData.name.toUpperCase();
                   
                   productsToCreate.push({
                        baseName: itemBaseName,
                        brand: brandName,
                        category,
                        supermarket: superData.slug,
                        type: 'white_label'
                   });
               }
          }

          // B. Marques Premium (distribuïdes)
          const categoryBrands = PREMIUM_BRANDS[category] || [];
          const selectedBrands = categoryBrands.sort(() => 0.5 - Math.random()).slice(0, 3);
          
          for (const brand of selectedBrands) {
              productsToCreate.push({
                  baseName: itemBaseName,
                  brand: brand,
                  category,
                  supermarket: 'all',
                  type: 'brand'
              });
          }
      }
  }

  console.log(`📝 Generated ${productsToCreate.length} products specs. Inserting...`);

  // Inserir a la BBDD
  for (const p of productsToCreate) {
      const unit = UNITS[p.category] || 'ud';
      const possibleSizes = SIZES[p.category === 'Begudes' ? 'Begudes' : 'default'];
      const size = possibleSizes[Math.floor(Math.random() * possibleSizes.length)];
      
      const fullName = `${p.baseName} ${p.brand === 'GENÈRIC' ? '' : p.brand}`;
      // Normalized name important per al matching
      const normalizedName = `${p.baseName} ${p.brand} ${size}${unit}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

      // Imatge: Utilitzem imatges reals d'OpenFoodFacts
      const imageUrl = getRandomImage(p.baseName, p.category);

      const product = await prisma.product.upsert({
          where: { barcode: normalizedName },
          update: {
              imageUrl: imageUrl, // Forcem actualització d'imatges
              name: fullName,
              brand: p.brand
          },
          create: {
              name: fullName,
              normalizedName: normalizedName,
              brand: p.brand,
              category: p.category,
              unit: unit,
              size: size,
              imageUrl: imageUrl,
              barcode: normalizedName
          }
      });

      // Crear o actualitzar Preus
      const targetSupermarkets = p.supermarket === 'all' 
          ? supermarkets.map(s => s.slug).filter(() => Math.random() > 0.4) 
          : [p.supermarket];

      for (const slug of targetSupermarkets) {
           const superModel = await prisma.supermarket.findUnique({ where: { slug } });
           if (!superModel) continue;

           let base = 2.0;
           if (p.category.includes('Fruita') || p.category.includes('Verdura')) base = 1.5;
           if (p.category.includes('Carn')) base = 8.0;
           if (p.category.includes('Lactis')) base = 1.0;
           if (p.category.includes('Begudes')) base = 0.8;
           if (p.category.includes('Pa')) base = 1.0;
           if (p.category.includes('Rebost')) base = 1.8;
           
           if (p.type === 'white_label') base = base * 0.7;
           
           // Preu final amb petita variació random
           const price = parseFloat((base * (0.8 + Math.random() * 0.4)).toFixed(2));
           
           await prisma.price.upsert({
                where: {
                    productId_supermarketId: {
                        productId: product.id,
                        supermarketId: superModel.id
                    }
                },
                update: { price, pricePerUnit: parseFloat((price / size).toFixed(2)) },
                create: {
                    productId: product.id,
                    supermarketId: superModel.id,
                    price,
                    pricePerUnit: parseFloat((price / size).toFixed(2))
                }
           });
      }
      totalProducts++;
      if (totalProducts % 50 === 0) process.stdout.write('.');
  }

  console.log(`\n✅ Created ${totalProducts} products massively.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


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

  const IMAGE_KEYWORDS: Record<string, string> = {
    'Fruita i Verdura': 'fruit,vegetable',
    'Carn i Peix': 'meat,fish',
    'Lactis i Ous': 'dairy,milk,eggs',
    'Pa i Pastisseria': 'bread,bakery',
    'Begudes': 'drink,beverage,bottle',
    'Rebost': 'food,pantry,pasta,rice',
    'Neteja i Llar': 'cleaning,detergent',
    'Higiene': 'hygiene,soap,shampoo'
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

      // Imatge: Utilitzem Lorem Flickr per tenir imatges reals de menjar segons categoria
      const keywords = IMAGE_KEYWORDS[p.category] || 'grocery';
      // Afegim un timestamp o random per evitar caching agressiu del mateix URL en navegadors
      const randomLock = Math.floor(Math.random() * 10000);
      const imageUrl = `https://loremflickr.com/300/300/${keywords}?lock=${randomLock}`;

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

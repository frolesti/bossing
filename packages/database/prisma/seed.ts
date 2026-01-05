import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Crear supermercats
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

  // Crear alguns productes d'exemple
  const products = [
    { name: 'Llet Sencera 1L', normalizedName: 'llet sencera 1l', category: 'Lactis', unit: 'L', size: 1 },
    { name: 'Pa de Motlle', normalizedName: 'pa de motlle', category: 'Pa i Pastisseria', unit: 'ud' },
    { name: 'Ous L Pack 12', normalizedName: 'ous l pack 12', category: 'Altres', unit: 'ud', size: 12 },
    { name: 'Oli d\'Oliva Verge Extra 1L', normalizedName: 'oli oliva verge extra 1l', category: 'Altres', unit: 'L', size: 1 },
    { name: 'Arròs Bomba 1kg', normalizedName: 'arros bomba 1kg', category: 'Altres', unit: 'kg', size: 1 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { barcode: product.normalizedName }, // Usem normalizedName com a identificador temporal
      update: product,
      create: {
        ...product,
        barcode: product.normalizedName, // Temporal
      },
    });
  }

  console.log(`✅ Created ${products.length} sample products`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

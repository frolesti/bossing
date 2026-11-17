import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = 'https://tienda.mercadona.es';
const warehouse = 'bcn1';
const language = 'ca';
const privateBrands = /\b(?:hacendado|deliplus|compy|bosque verde)\b/gi;
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const internalId = value => createHash('sha256').update(value).digest('hex').slice(0, 20);

function safeImage(value) {
  if (typeof value !== 'string' || !value) return undefined;
  const url = new URL(value, origin);
  if (url.protocol !== 'https:' || !['tienda.mercadona.es', 'prod-mercadona.imgix.net'].includes(url.hostname)) return undefined;
  return url.href;
}

export function catalogProduct(product, categoryId, sourceUrl) {
  assert(product && /^\d+(?:\.\d+)?$/.test(String(product.id)), 'Invalid source identity');
  assert(typeof product.display_name === 'string' && product.display_name.trim(), 'Missing product name');
  const name = product.display_name.replace(privateBrands, '').replace(/\s+/g, ' ').trim();
  assert(name, 'Empty generic product name');
  const instructions = product.price_instructions || {};
  const sourceUnit = String(instructions.size_format || instructions.reference_format || '').toLowerCase();
  const eggs = /^(?:ous?|huevos?)\b/i.test(name) && !/\b(?:xocolata|chocolate|farcit|relleno|salsa)\b/i.test(name);
  const weighted = instructions.approx_size === true || instructions.selling_method === 1;
  const counted = ['u', 'ud', 'uds', 'dc'].includes(sourceUnit);
  const unit = eggs || counted ? 'u' : ['kg', 'g'].includes(sourceUnit) ? 'kg' : ['l', 'ml', 'cl'].includes(sourceUnit) ? 'l' : 'u';
  const quantityMode = eggs || weighted || counted ? 'amount' : 'packages';
  return {
    id: `bossing:import-${internalId(normalize(name) + ':' + unit + ':' + quantityMode)}`,
    name, category: categoryId, unit, quantityMode,
    defaultQuantity: eggs ? 12 : 1,
    imageUrl: safeImage(product.thumbnail), aliases: [product.display_name],
    sourceReferences: [{ productId: String(product.id), name: product.display_name, url: sourceUrl }],
  };
}

export function buildSnapshot(tree, branches, capturedAt, icons = {}) {
  assert(Array.isArray(tree) && tree.length > 0, 'Empty category tree');
  const categories = new Map();
  const products = new Map();
  const rejected = [];
  let sourceProducts = 0;
  for (const root of tree) {
    const rootId = `bossing-category:import-${root.id}`;
    const icon = { iconUrl: safeImage(root.icon_url || icons[root.id]?.url), iconPosition: icons[root.id]?.position };
    categories.set(rootId, { id: rootId, name: root.name, ...icon });
    for (const group of root.categories || []) {
      const groupId = `bossing-category:import-${group.id}`;
      categories.set(groupId, { id: groupId, name: group.name, parentId: rootId, ...icon });
      const branch = branches.get(group.id);
      assert(branch && Array.isArray(branch.categories), `Missing complete branch ${group.id}`);
      for (const leaf of branch.categories) {
        const leafId = `bossing-category:import-${leaf.id}`;
        assert(Array.isArray(leaf.products), `Missing products in ${leaf.id}`);
        categories.set(leafId, { id: leafId, name: leaf.name, parentId: groupId,
          ...icon, imageUrl: safeImage(leaf.image) });
        for (const sourceProduct of leaf.products) {
          sourceProducts++;
          try {
            const product = catalogProduct(sourceProduct, leafId, `${origin}/api/categories/${group.id}/?lang=${language}&wh=${warehouse}`);
            const previous = products.get(product.id);
            if (previous) {
              if (!previous.categoryIds.includes(leafId)) previous.categoryIds.push(leafId);
              if (!previous.sourceReferences.some(reference => reference.productId === String(sourceProduct.id))) previous.sourceReferences.push(...product.sourceReferences);
              if (!previous.aliases.includes(sourceProduct.display_name)) previous.aliases.push(sourceProduct.display_name);
            } else products.set(product.id, { ...product, categoryIds: [leafId] });
          } catch (error) { rejected.push({ productId: String(sourceProduct?.id), reason: error.message }); }
        }
      }
    }
  }
  assert(products.size > 0, 'No product metadata imported');
  assert.equal(rejected.length, 0, 'Rejected metadata must be resolved before publishing the snapshot');
  return {
    schemaVersion: 1, capturedAt, source: { provider: 'mercadona-rest-metadata',
      url: `${origin}/api/categories/?lang=${language}&wh=${warehouse}`, language, warehouse,
      pricingIncluded: false, availabilityIncluded: false, assets: 'Public original URL references; no asset files redistributed' },
    coverage: { rootCategories: tree.length, requestedBranches: tree.reduce((sum, root) => sum + (root.categories?.length || 0), 0),
      completedBranches: branches.size, sourceProducts, importedProducts: products.size, rejected },
    categories: [...categories.values()], products: [...products.values()],
  };
}

async function capture() {
  let lastRequest = 0;
  const read = async url => {
    const delay = Math.max(0, 350 - (Date.now() - lastRequest));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    lastRequest = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert(response.ok, `Source HTTP ${response.status}: ${url}`);
    return response.json();
  };
  const tree = (await read(`${origin}/api/categories/?lang=${language}&wh=${warehouse}`)).results;
  assert(Array.isArray(tree) && tree.length, 'Invalid category tree');
  const ids = [...new Set(tree.flatMap(root => root.categories.map(group => group.id)))];
  const homepage = await fetch(origin, { signal: AbortSignal.timeout(30000) });
  assert(homepage.ok, 'Cannot inspect original icon stylesheet');
  const html = await homepage.text();
  const stylesheetPath = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)][0]?.[1];
  assert(stylesheetPath, 'Missing original icon stylesheet');
  const stylesheetResponse = await fetch(new URL(stylesheetPath, origin), { signal: AbortSignal.timeout(30000) });
  assert(stylesheetResponse.ok, 'Cannot read original icon positions');
  const css = await stylesheetResponse.text();
  const spritePath = css.match(/\.ui-category-icon\{[^}]*background-image:url\(([^)]+)\)/)?.[1];
  assert(spritePath, 'Missing public category icon sprite');
  const spriteUrl = new URL(spritePath, origin).href;
  const icons = Object.fromEntries([...css.matchAll(/\.ui-category-icon--(\d+)\{background-position:([^}]+)\}/g)]
    .map(match => [match[1], { url: spriteUrl, position: match[2] }]));
  assert(tree.every(root => icons[root.id]), 'Some original category icons are missing');
  const branches = new Map();
  for (const id of ids) {
    branches.set(id, await read(`${origin}/api/categories/${id}/?lang=${language}&wh=${warehouse}`));
    if (branches.size % 10 === 0) console.log(`Metadata branches ${branches.size}/${ids.length}`);
  }
  const snapshot = buildSnapshot(tree, branches, new Date().toISOString(), icons);
  await publish(snapshot);
}

async function publish(snapshot) {
  const directory = new URL('../src/data/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const output = new URL('mercadona-catalog.ts', directory);
  await writeFile(output, "import type { CatalogSourceSnapshot } from '../catalog.js';\n\nexport const catalogSnapshot: CatalogSourceSnapshot = " + JSON.stringify(snapshot, null, 2) + ';\n');
  console.log(JSON.stringify({ output: fileURLToPath(output), ...snapshot.coverage }));
}

if (process.argv.includes('--self-test')) {
  const product = { id: '1', display_name: 'Ous M Hacendado', thumbnail: 'https://prod-mercadona.imgix.net/eggs.jpg',
    price_instructions: { unit_price: '9.99', size_format: 'ud' } };
  const mapped = catalogProduct(product, 'leaf', `${origin}/api/categories/1/`);
  assert.equal(mapped.name, 'Ous M');
  assert.equal(mapped.defaultQuantity, 12);
  assert.equal(mapped.unit, 'u');
  assert.equal(mapped.quantityMode, 'amount');
  assert(!('price' in mapped));
  assert(!('price_instructions' in mapped));
  assert.equal(catalogProduct({ ...product, display_name: 'Llet Hacendado', price_instructions: { size_format: 'l', approx_size: false, selling_method: 0 } }, 'leaf', origin).quantityMode, 'packages');
  assert.equal(catalogProduct({ ...product, display_name: 'Pomes', price_instructions: { size_format: 'kg', approx_size: true } }, 'leaf', origin).quantityMode, 'amount');
  for (const display_name of ['Macarró amb ou', "Flam d'ou", "Clares d'ou líquides pasteuritzades"]) {
    const prepared = catalogProduct({ ...product, display_name, price_instructions: { size_format: 'kg', approx_size: false } }, 'leaf', origin);
    assert.equal(prepared.defaultQuantity, 1);
    assert.equal(prepared.unit, 'kg');
    assert.equal(prepared.quantityMode, 'packages');
  }
  assert.throws(() => buildSnapshot([{ id: 1, name: 'Root', categories: [{ id: 2, name: 'Group' }] }], new Map(), new Date().toISOString()));
  console.log('Metadata importer self-test passed');
} else if (process.argv.includes('--capture')) await capture();
else if (process.argv.includes('--materialize')) {
  const input = new URL('../src/data/mercadona-catalog.json', import.meta.url);
  await publish(JSON.parse(await readFile(input, 'utf8')));
  await unlink(input);
}
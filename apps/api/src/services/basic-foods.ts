export interface BasicFood {
  id: string;
  name: string;
  specification: string;
}

export const BASIC_FOODS: readonly BasicFood[] = [
  { id: 'milk', name: 'Llet', specification: 'Semidesnatada UHT, 1 l' },
  { id: 'rice', name: 'Arròs', specification: 'Blanc rodó, 1 kg' },
  { id: 'eggs', name: 'Ous', specification: 'Classe M, 12 unitats' },
  { id: 'flour', name: 'Farina', specification: 'Blat, ús general, 1 kg' },
  { id: 'sugar', name: 'Sucre', specification: 'Blanc, 1 kg' },
  { id: 'salt', name: 'Sal', specification: 'Fina de taula, 1 kg' },
  { id: 'olive-oil', name: 'Oli d’oliva', specification: 'Verge extra, 1 l' },
  { id: 'sunflower-oil', name: 'Oli de gira-sol', specification: 'Refinat, 1 l' },
  { id: 'pasta', name: 'Pasta', specification: 'Macarrons de blat, 500 g' },
  { id: 'lentils', name: 'Llenties', specification: 'Cuites al natural, pes net 570 g' },
  { id: 'chickpeas', name: 'Cigrons', specification: 'Cuits al natural, pes net 570 g' },
  { id: 'tomato', name: 'Tomàquet', specification: 'Triturat al natural, 800 g' },
  { id: 'oats', name: 'Civada', specification: 'Flocs sense afegits, 800 g' },
  { id: 'bread', name: 'Pa de motlle', specification: 'Blanc amb crosta, 460 g' },
  { id: 'yogurt', name: 'Iogurt', specification: 'Natural sense sucre, 6 × 125 g' },
];

export const BASIC_CHAINS = ['mercadona', 'consum', 'carrefour', 'dia', 'bonpreu', 'ametller', 'caprabo'] as const;
export const ACTIVE_BASIC_CHAINS = ['mercadona', 'consum', 'caprabo', 'ametller'] as const;

export interface BasicReference {
  foodId: string;
  productId: string;
  name: string;
  amount: number;
  unit: string;
  sourceUrl?: string;
}

export const MERCADONA_BASICS: readonly BasicReference[] = [
  { foodId: 'milk', productId: 'merc-10382', name: 'Leche semidesnatada Hacendado', amount: 1, unit: 'l' },
  { foodId: 'rice', productId: 'merc-5044', name: 'Arroz redondo Hacendado', amount: 1, unit: 'kg' },
  { foodId: 'eggs', productId: 'merc-31505', name: 'Huevos medianos M', amount: 12, unit: 'ud' },
  { foodId: 'flour', productId: 'merc-29100', name: 'Harina de trigo Hacendado', amount: 1, unit: 'kg' },
  { foodId: 'sugar', productId: 'merc-19897', name: 'Azúcar blanco Hacendado', amount: 1, unit: 'kg' },
  { foodId: 'salt', productId: 'merc-19731', name: 'Sal fina Hacendado', amount: 1, unit: 'kg' },
  { foodId: 'olive-oil', productId: 'merc-4740', name: 'Aceite de oliva virgen extra Hacendado', amount: 1, unit: 'l' },
  { foodId: 'sunflower-oil', productId: 'merc-4040', name: 'Aceite de girasol refinado 0,2º Hacendado', amount: 1, unit: 'l' },
  { foodId: 'pasta', productId: 'merc-6326', name: 'Macarrón Hacendado', amount: 0.5, unit: 'kg' },
  { foodId: 'lentils', productId: 'merc-26030', name: 'Lenteja cocida Hacendado', amount: 0.57, unit: 'kg' },
  { foodId: 'chickpeas', productId: 'merc-26029', name: 'Garbanzo cocido Hacendado', amount: 0.57, unit: 'kg' },
  { foodId: 'tomato', productId: 'merc-16043', name: 'Tomate triturado Hacendado', amount: 0.8, unit: 'kg' },
  { foodId: 'oats', productId: 'merc-86341', name: 'Copos de avena Brüggen', amount: 0.8, unit: 'kg' },
  { foodId: 'bread', productId: 'merc-13810', name: 'Pan de molde blanco Hacendado', amount: 0.46, unit: 'kg' },
  { foodId: 'yogurt', productId: 'merc-22313', name: 'Yogur natural Hacendado', amount: 0.75, unit: 'kg' },
];

export const CONSUM_BASICS: readonly BasicReference[] = [
  { foodId: 'milk', productId: 'consum-5932', name: 'Leche Semidesnatada Brik', amount: 1, unit: 'l' },
  { foodId: 'rice', productId: 'consum-5458', name: 'Arroz Redondo Extra Origen España', amount: 1, unit: 'kg' },
  { foodId: 'eggs', productId: 'consum-6102', name: 'Huevos M Medianos Docena', amount: 12, unit: 'ud' },
  { foodId: 'flour', productId: 'consum-34091', name: 'Harina de Trigo Clásica', amount: 1, unit: 'kg' },
  { foodId: 'sugar', productId: 'consum-5245', name: 'Azúcar Blanco Paquete', amount: 1, unit: 'kg' },
  { foodId: 'salt', productId: 'consum-5937', name: 'Sal Fina Bolsa', amount: 1, unit: 'kg' },
  { foodId: 'olive-oil', productId: 'consum-11369', name: 'Aceite Oliva Virgen Extra Botella', amount: 1, unit: 'l' },
  { foodId: 'sunflower-oil', productId: 'consum-15627', name: 'Aceite de Girasol Botella', amount: 1, unit: 'l' },
  { foodId: 'pasta', productId: 'consum-5742', name: 'Macarrones Paquete', amount: 0.5, unit: 'kg' },
  { foodId: 'lentils', productId: 'consum-5584', name: 'Lenteja Pardina Cocida Frasco', amount: 0.4, unit: 'kg' },
  { foodId: 'chickpeas', productId: 'consum-5585', name: 'Garbanzo Cocido Frasco', amount: 0.4, unit: 'kg' },
  { foodId: 'tomato', productId: 'consum-5498', name: 'Tomate Triturado Lata', amount: 0.8, unit: 'kg' },
  { foodId: 'oats', productId: 'consum-33872', name: 'Copos de Avena', amount: 0.5, unit: 'kg' },
  { foodId: 'bread', productId: 'consum-5841', name: 'Pan de Molde Clasico 16 Rebanadas.', amount: 0.46, unit: 'kg' },
  { foodId: 'yogurt', productId: 'consum-23824', name: 'Yogur Natural Pack de 4 Unidades', amount: 0.5, unit: 'kg' },
];

export const CAPRABO_BASICS: readonly BasicReference[] = [
  { foodId: 'milk', productId: 'caprabo-18581678', name: 'Llet semidesnatada de Catalunya EROSKI, brik 1 litre', amount: 1, unit: 'l',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/18581678-llet-semidesnatada-de-catalunya-eroski-brik-1-litre/' },
  { foodId: 'rice', productId: 'caprabo-300434', name: 'Arròs extra EROSKI basic, paquet 1 kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/300434-arros-extra-eroski-basic-paquet-1-kg/' },
  { foodId: 'eggs', productId: 'caprabo-19548627', name: 'Ou fresc M sòl Catalunya EROSKI, cartó 1 dotzena', amount: 12, unit: 'ud',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/19548627-ou-fresc-m-sol-catalunya-eroski-carto-1-dotzena/' },
  { foodId: 'flour', productId: 'caprabo-362442', name: 'Farina de blat EROSKI BASIC, paquet 1 kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/362442-farina-de-blat-eroski-basic-paquet-1-kg/' },
  { foodId: 'sugar', productId: 'caprabo-26913889', name: 'Sucre blanc EROSKI, paquet 1 kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/26913889-sucre-blanc-eroski-paquet-1-kg/' },
  { foodId: 'salt', productId: 'caprabo-917372', name: 'Sal marina fina EROSKI BASIC, paquet 1 kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/917372-sal-marina-fina-eroski-basic-paquet-1-kg/' },
  { foodId: 'olive-oil', productId: 'caprabo-371658', name: 'Oli d`oliva verge extra EROSKI, ampolla 1 litre', amount: 1, unit: 'l',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/371658-oli-doliva-verge-extra-eroski-ampolla-1-litre/' },
  { foodId: 'sunflower-oil', productId: 'caprabo-377150', name: 'Oli de gira-sol EROSKI, ampolla 1 litre', amount: 1, unit: 'l',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/377150-oli-de-gira-sol-eroski-ampolla-1-litre/' },
  { foodId: 'pasta', productId: 'caprabo-361998', name: 'Macarrons EROSKI basic, paquet 500 g', amount: 0.5, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/361998-macarrons-eroski-basic-paquet-500-g/' },
  { foodId: 'lentils', productId: 'caprabo-25948431', name: 'Llenties cuites EROSKI, flascó 400 g', amount: 0.4, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/25948431-llenties-cuites-eroski-flasco-400-g/' },
  { foodId: 'chickpeas', productId: 'caprabo-25948423', name: 'Cigró cuit EROSKI, flascó 400 g', amount: 0.4, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/25948423-cigro-cuit-eroski-flasco-400-g/' },
  { foodId: 'tomato', productId: 'caprabo-320267', name: 'Tomàquet triturat EROSKI, llauna 800 g', amount: 0.8, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/320267-tomaquet-triturat-eroski-llauna-800-g/' },
  { foodId: 'oats', productId: 'caprabo-26747618', name: 'Flocs de civada integrals suaus EROSKI, 500 g', amount: 0.5, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/26747618-flocs-de-civada-integrals-suaus-eroski-500-g/' },
  { foodId: 'bread', productId: 'caprabo-17946732', name: 'Pa de motlle amb escorça EROSKI basic, paquet 820 g', amount: 0.82, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/17946732-pa-de-motlle-amb-escorca-eroski-basic-paquet-820-g/' },
  { foodId: 'yogurt', productId: 'caprabo-4810149', name: 'Iogurt natural EROSKI basic, pack 8x125 g', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.capraboacasa.com/ca/productdetail/4810149-iogurt-natural-eroski-basic-pack-8x125-g/' },
];

export const AMETLLER_BASICS: readonly BasicReference[] = [
  { foodId: 'milk', productId: 'ametller-2390', name: 'Llet semidesnatada A2 Llet Llet Ametller Origen 1l', amount: 1, unit: 'l',
    sourceUrl: 'https://www.ametllerorigen.com/ca/llet-semidesnatada-a2-llet-llet-ametller-origen-1l/2390.html' },
  { foodId: 'rice', productId: 'ametller-8100', name: "Arròs rodó Ametller Origen 1kg D.O Delta de l'Ebre", amount: 1, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/arros-rodo-ametller-origen-1kg-do-delta-de-lebre/8100.html' },
  { foodId: 'eggs', productId: 'ametller-59976', name: 'Ous de gallines soltes M Essencials - 12u.', amount: 12, unit: 'ud',
    sourceUrl: 'https://www.ametllerorigen.com/ca/ous-de-gallines-soltes-m-essencials-12u/59976.html' },
  { foodId: 'flour', productId: 'ametller-19418', name: 'Farina de blat Santa Rita 1kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/farina-de-blat-santa-rita-1kg/19418.html' },
  { foodId: 'sugar', productId: 'ametller-16129', name: 'Sucre blanc SUCREBÓ 1kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/sucre-blanc-sucrebo-1kg/16129.html' },
  { foodId: 'salt', productId: 'ametller-3250', name: 'Sal fina ecològica Marismeña 1 kg', amount: 1, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/sal-fina-ecologica-marismena-1-kg/3250.html' },
  { foodId: 'olive-oil', productId: 'ametller-41929', name: "Oli d'oliva verge extra Ametller Origen 1L", amount: 1, unit: 'l',
    sourceUrl: 'https://www.ametllerorigen.com/ca/oli-doliva-verge-extra-ametller-origen-1l/41929.html' },
  { foodId: 'sunflower-oil', productId: 'ametller-59703', name: 'Oli de gira-sol Essencials 1L', amount: 1, unit: 'l',
    sourceUrl: 'https://www.ametllerorigen.com/ca/oli-de-gira-sol-essencials-1l/59703.html' },
  { foodId: 'pasta', productId: 'ametller-56339', name: 'Macarrons Essencials 500g', amount: 0.5, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/macarrons-essencials-500g/56339.html' },
  { foodId: 'lentils', productId: 'ametller-54197', name: 'Llentia cuita Essencials 570g', amount: 0.57, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/llentia-cuita-essencials-570g/54197.html' },
  { foodId: 'chickpeas', productId: 'ametller-54198', name: 'Cigró cuit Essencials 570g', amount: 0.57, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/cigro-cuit-essencials-570g/54198.html' },
  { foodId: 'tomato', productId: 'ametller-19316', name: 'Tomàquet triturat natural Ametller Origen 660g', amount: 0.66, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/tomaquet-triturat-natural-ametller-origen-660g/19316.html' },
  { foodId: 'oats', productId: 'ametller-10864', name: 'Flocs de civada Essencials 500g', amount: 0.5, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/flocs-de-civada-essencials-500g/10864.html' },
  { foodId: 'yogurt', productId: 'ametller-59069', name: 'Iogurt natural Essencials 125g - 4u.', amount: 0.5, unit: 'kg',
    sourceUrl: 'https://www.ametllerorigen.com/ca/iogurt-natural-essencials-125g-4u/59069.html' },
];

export const BASIC_REFERENCES = { mercadona: MERCADONA_BASICS, consum: CONSUM_BASICS, caprabo: CAPRABO_BASICS, ametller: AMETLLER_BASICS };

export function captureDay(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
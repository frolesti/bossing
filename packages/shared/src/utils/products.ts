/**
 * Normalitza el nom d'un producte per a comparació
 * Elimina accents, converteix a minúscules, elimina espais extra
 */
export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina accents
    .replace(/[^a-z0-9\s]/g, '') // Només lletres, números i espais
    .replace(/\s+/g, ' ') // Unifica espais
    .trim();
}

/**
 * Extreu la quantitat i unitat d'un nom de producte
 * Ex: "Llet 1L" -> { quantity: 1, unit: "L" }
 */
export function extractQuantityFromName(name: string): {
  quantity: number | null;
  unit: string | null;
} {
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl|unitat|ud|pack)/i,
    /(\d+(?:[.,]\d+)?)\s*(litres?|litr[eo]s?)/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const quantity = parseFloat(match[1].replace(',', '.'));
      const unit = normalizeUnit(match[2]);
      return { quantity, unit };
    }
  }

  return { quantity: null, unit: null };
}

/**
 * Normalitza unitats
 */
function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    kg: 'kg',
    g: 'g',
    l: 'L',
    litre: 'L',
    litres: 'L',
    litro: 'L',
    litros: 'L',
    ml: 'mL',
    cl: 'cL',
    unitat: 'ud',
    ud: 'ud',
    pack: 'pack',
  };

  return unitMap[unit.toLowerCase()] || unit;
}

/**
 * Calcula el preu per unitat estàndard (per kg o per L)
 */
export function calculatePricePerUnit(
  price: number,
  quantity: number,
  unit: string
): number {
  switch (unit.toLowerCase()) {
    case 'g':
      return (price / quantity) * 1000; // Preu per kg
    case 'ml':
    case 'cl':
      const mlQuantity = unit.toLowerCase() === 'cl' ? quantity * 10 : quantity;
      return (price / mlQuantity) * 1000; // Preu per L
    case 'kg':
    case 'l':
      return price / quantity;
    default:
      return price / quantity;
  }
}

/**
 * Formata el preu en euros
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ca-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Formata la distància
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

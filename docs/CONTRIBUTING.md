# Contribuir a Bossing

Gràcies per voler contribuir a Bossing! 🎉

## Com contribuir

### 1. Fork del repositori

Fes un fork del repositori a la teva compte de GitHub.

### 2. Clonar el repositori

```bash
git clone https://github.com/EL_TEU_USUARI/bossing.git
cd bossing
```

### 3. Instal·lar dependències

```bash
pnpm install
```

### 4. Crear una branca

```bash
git checkout -b feature/nova-funcionalitat
```

### 5. Fer els canvis

- Segueix les guies d'estil del projecte
- Afegeix tests si és necessari
- Actualitza la documentació si cal

### 6. Fer commit

Utilitzem [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: afegeix scraper per Bonpreu"
git commit -m "fix: corregeix càlcul de distància"
git commit -m "docs: actualitza README"
```

### 7. Push i Pull Request

```bash
git push origin feature/nova-funcionalitat
```

Obre un Pull Request a GitHub.

## Afegir un nou scraper

1. Crea un nou fitxer a `packages/scrapers/src/sources/`:

```typescript
// packages/scrapers/src/sources/nou-supermercat.ts
import { BaseScraper, type ScraperConfig } from '../base.js';

const config: ScraperConfig = {
  name: 'Nou Supermercat',
  baseUrl: 'https://www.nousupermercat.es',
  rateLimit: 1,
  enabled: true,
};

export class NouSupermercatScraper extends BaseScraper {
  constructor() {
    super(config);
  }

  async scrapeProducts(category?: string) {
    // Implementació
    return [];
  }

  async scrapeProductDetails(productId: string) {
    return null;
  }

  async searchProducts(query: string) {
    return [];
  }
}

export const nouSupermercatScraper = new NouSupermercatScraper();
```

2. Registra'l a `packages/scrapers/src/index.ts`

3. Afegeix el supermercat a `packages/shared/src/index.ts`

## Estil de codi

- Utilitzem TypeScript estricte
- Formategem amb Prettier
- Lint amb ESLint
- Noms en anglès al codi, comentaris en català acceptats

## Tests

```bash
pnpm test
```

## Preguntes?

Obre un issue a GitHub!

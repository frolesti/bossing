# Arquitectura de Bossing

## Visió General

Bossing segueix una arquitectura de monorepo amb Turborepo, separant el frontend, backend i paquets compartits.

```
bossing/
├── apps/
│   ├── web/          # Frontend Next.js (PWA)
│   └── api/          # Backend Express
├── packages/
│   ├── shared/       # Tipus i utilitats
│   ├── scrapers/     # Scrapers de supermercats
│   └── database/     # Prisma + migracions
└── docker/           # Configuració Docker
```

## Flux de Dades

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCRAPERS                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Mercadona │ │  Lidl    │ │Carrefour │ │  ...     │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       │            │            │            │                   │
│       └────────────┴────────────┴────────────┘                   │
│                         │                                        │
│                    ┌────▼────┐                                   │
│                    │  Queue  │ (BullMQ + Redis)                  │
│                    └────┬────┘                                   │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │ PostgreSQL │
                    └─────┬─────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    ┌────▼────┐                                   │
│                    │   API   │ (Express)                         │
│                    └────┬────┘                                   │
│                         │                                        │
│    ┌────────────────────┼────────────────────┐                   │
│    │                    │                    │                   │
│ ┌──▼───┐          ┌─────▼─────┐        ┌────▼─────┐             │
│ │Search│          │Comparison │        │Optimize  │             │
│ └──────┘          └───────────┘        └──────────┘             │
└─────────────────────────────────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Frontend │ (Next.js PWA)
                    └───────────┘
```

## Scrapers

### Estratègies

1. **API Directa**: Alguns supermercats exposen APIs que podem consumir
2. **HTML Scraping**: Cheerio per pàgines server-rendered
3. **Headless Browser**: Puppeteer per SPAs i contingut dinàmic

### Rate Limiting

Cada scraper té un `rateLimit` configurat per evitar bloquejos:
- Mercadona: 2 req/s
- Lidl: 1.5 req/s
- Carrefour: 1 req/s

### Programació

Els scrapers s'executen:
- Cada 6 hores per preus generals
- En temps real per cerques específiques (amb cache)

## Base de Dades

### Entitats Principals

- **Product**: Producte normalitzat
- **Price**: Preu actual per producte/supermercat
- **PriceHistory**: Històric de preus
- **Supermarket**: Cadena de supermercats
- **SupermarketLocation**: Botigues físiques amb geolocalització

### Índexs Importants

- `Product.normalizedName`: Per cerca ràpida
- `SupermarketLocation.(lat, lng)`: Per cerques geogràfiques
- `Price.(productId, supermarketId)`: Únic per evitar duplicats

## Algoritme d'Optimització

### Inputs
- Llista de productes
- Ubicació de l'usuari
- Radi màxim
- Nombre màxim de parades
- Prioritat (preu/distància/balancejat)

### Procés

1. **Filtrar supermercats** dins del radi
2. **Obtenir preus** per cada producte a cada supermercat
3. **Generar combinacions** de fins a N parades
4. **Calcular cost total** = productes + (distància × factor)
5. **Ordenar** segons prioritat
6. **Retornar** les millors 3 rutes

### Complexitat

- Amb N supermercats i K parades màximes: O(N^K)
- Optimitzat amb poda i heurístiques

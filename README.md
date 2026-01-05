# 🛒 Bossing

> Aplicació mobile-first per comparar preus de supermercats i optimitzar la teva compra

## 📋 Descripció

**Bossing** és una aplicació que et permet:
- 🔍 Comparar preus de productes entre diferents supermercats en temps real
- 📍 Trobar les millors ofertes basades en la teva localització
- 📝 Crear llistes de la compra intel·ligents
- 🗺️ Optimitzar la ruta de compra per estalviar el màxim de diners

## 🏗️ Arquitectura

```
bossing/
├── apps/
│   ├── web/                 # Frontend Next.js (PWA mobile-first)
│   └── api/                 # Backend Node.js/Express
├── packages/
│   ├── shared/              # Tipus i utilitats compartides
│   ├── scrapers/            # Scrapers per cada supermercat
│   └── database/            # Esquemes i migracions
├── docker/                  # Configuració Docker
└── docs/                    # Documentació
```

## 🛠️ Tecnologies

### Frontend
- **Next.js 14** amb App Router
- **TypeScript**
- **Tailwind CSS** per estils
- **PWA** per experiència mobile nativa
- **React Query** per gestió d'estat del servidor
- **Leaflet/Mapbox** per mapes

### Backend
- **Node.js** amb **Express**
- **TypeScript**
- **PostgreSQL** amb **Prisma ORM**
- **Redis** per cache
- **Bull** per cues de scraping

### Scrapers Suportats
- [ ] Mercadona
- [ ] Carrefour
- [ ] Lidl
- [ ] Aldi
- [ ] Bonpreu
- [ ] Consum
- [ ] Dia
- [ ] Eroski
- [ ] Alcampo

## 🚀 Començar

### Requisits previs
- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose
- PostgreSQL (o usar Docker)

### Instal·lació

```bash
# Clonar el repositori
git clone https://github.com/YOUR_USERNAME/bossing.git
cd bossing

# Instal·lar dependències
pnpm install

# Configurar variables d'entorn
cp .env.example .env

# Iniciar base de dades amb Docker
docker-compose up -d postgres redis

# Executar migracions
pnpm db:migrate

# Iniciar en mode desenvolupament
pnpm dev
```

## 📱 Funcionalitats

### 1. Comparador de Preus
Cerca qualsevol producte i veu els preus a tots els supermercats propers.

### 2. Llista de la Compra Intel·ligent
- Afegeix productes a la teva llista
- L'app calcula automàticament la combinació òptima de supermercats
- Mostra l'estalvi potencial

### 3. Optimització de Ruta
- Introdueix la teva ubicació
- Defineix el radi màxim de desplaçament
- Obté 2-3 supermercats recomanats per minimitzar cost total (productes + desplaçament)

### 4. Historial i Estadístiques
- Seguiment dels teus estalvis
- Evolució de preus dels productes favorits
- Alertes de baixades de preu

## 🔧 Scripts Disponibles

```bash
pnpm dev          # Inicia tots els serveis en mode dev
pnpm build        # Construeix per producció
pnpm test         # Executa tests
pnpm lint         # Lint del codi
pnpm scrape       # Executa scrapers manualment
pnpm db:migrate   # Executa migracions de BD
pnpm db:seed      # Pobla BD amb dades de prova
```

## 📄 Llicència

MIT License - veure [LICENSE](LICENSE)

## 🤝 Contribuir

Les contribucions són benvingudes! Si us plau, llegeix [CONTRIBUTING.md](docs/CONTRIBUTING.md) primer.

---

Fet amb ❤️ a Catalunya

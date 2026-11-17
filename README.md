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

### Identitat visual: la llibreta del mercat

La interfície combina paper crema (`#fbf7ed`), kraft (`#d4b58b`) i tinta
verda (`#294c3b`). Les llistes tenen marge vermell, caselles per marcar i
ratlles de llibreta; el comparador es presenta com un comprovant de compra.
Georgia aporta els titulars editorials i Trebuchet MS els controls, sense
descarregar fonts externes. La textura de paper és un SVG local.

El disseny és mobile-first, amb una amplada màxima de 760 px en escriptori,
navegació inferior compartida i espai per a les àrees segures del mòbil.
Inclou focus de teclat visible, etiquetes als controls, zoom habilitat i
respecte per la preferència de moviment reduït. Es mantenen la persistència
de la llista, la cerca, les quantitats i les regles de comparació existents.

### Backend
- **Node.js** amb **Express**
- **TypeScript**
- **PostgreSQL** amb **Prisma ORM**
- **Redis** per cache
- **Bull** per cues de scraping

### Scrapers Suportats
Les marques amb captura automàtica validada disposen de captura diària de fins a 15 bàsics; això no
certifica totals equivalents entre cadenes ni preus per sucursal.

- [x] Mercadona
- [ ] Carrefour (1 observacio assistida; paquet minim de llet validat)
- [ ] Lidl (preus publics observats; les 15 referencies basiques continuen pendents)
- [ ] Aldi (10 referencies observades; lector HTML validat, captura diaria pendent)
- [ ] Bonpreu (15 observacions assistides disponibles; captura automàtica pendent)
- [x] Consum
- [x] Caprabo
- [x] Ametller Origen (14 aliments; pa de motlle pendent)
- [ ] bonÀrea (15 observacions reals; lector HTML validat, captura diària pendent)
- [ ] Condis (15 observacions reals; lector HTML validat, captura diària pendent)
- [ ] Sorli (15 observacions reals de l'assortiment 08338; captura diària pendent)
- [ ] Veritas (cerca i detall oficials validats; captura diària pendent)
- [ ] Plusfresc (API oficial amb sessió convidada validada; captura diària pendent)
- [ ] Dia (15 observacions assistides; captura automatica pendent)
- [ ] Eroski (15 referencies observades; lector HTML validat, captura diaria pendent)
- [ ] Alcampo (15 observacions assistides; captura automatica pendent)

## Pantalles i historic

### Comprovació d'accés del 17 de novembre de 2026

Una integració implementada o una observació històrica no demostren que la
font respongui avui. La prova manual consulta un SKU conegut (o una cerca
acotada), exigeix preu positiu, procedència i envàs verificable, i retorna
codi de sortida no zero si alguna cadena falla. No compra ni inicia sessió
amb un compte de client:

```bash
pnpm --filter @bossing/scrapers test:access all
pnpm --filter @bossing/scrapers test:access mercadona
```

Les comprovacions no certifiquen tot el catàleg, una cistella equivalent,
una botiga física ni disponibilitat futura. Els temps d'espera són fallades
de la comprovació, no prova que la cadena no disposi de catàleg.

| Cadena | Font implementada | Resultat de la comprovació |
| --- | --- | --- |
| Mercadona | REST oficial, CP 08001 / bcn1 | SKU de llet amb preu i envàs verificats |
| Consum | REST oficial, catàleg públic | SKU de llet amb preu i envàs verificats |
| bonÀrea | HTML oficial | SKU de llet amb preu i envàs verificats |
| Condis | HTML oficial | SKU de llet amb preu i envàs verificats |
| Veritas | JSON-LD del detall oficial | SKU de llet amb preu i envàs verificats |
| Plusfresc | REST observat en sessió convidada | 14 resultats normalitzats; context centre 12 / CP 25001 |
| Aldi | JSON-LD del detall oficial | SKU de llet verificat; cerca genèrica no integrada |
| Ametller Origen | API Salesforce observada al navegador | Temps d'espera; accés no revalidat avui |
| Caprabo | JSON-LD del detall oficial | Temps d'espera de navegació; accés no revalidat avui |
| Sorli | HTML oficial, assortiment 08338 | Temps d'espera del detall; accés no revalidat avui |
| Bonpreu / Esclat | JSON-LD del detall oficial | HTTP 403; automatització bloquejada, sense reintentar ni eludir-la |
| La Sirena | API pública VTEX | 7 resultats amb preu, procedència i envàs verificats a la cerca de pèsols |
| Lidl | Cerca de la web oficial | Cap mostra verificable de llet; no habilitat al comparador alimentari |

La Sirena conserva el preu individual `PriceWithoutDiscount` del venedor
oficial i la quantitat física explícita de l'etiqueta. `measurementUnit=un`
és un envàs comercial, no necessàriament un producte individual ni un quilo.
Les metadades incompletes no certifiquen un envàs. Els errors HTTP es
propaguen: no es desen com si fossin cerques buides correctes.

La resta de cadenes demanades **no tenen integració de preus a Bossing**:

| Cadena | Canal oficial revisat | Pendent |
| --- | --- | --- |
| Valvi / Spar Catalunya | [Valvi](https://www.valvi.com/), ofertes i localitzador | Font de preus per producte no confirmada; no confondre amb altres operadors Spar |
| Llobet | [Llobet Online](https://llobetonline.cat/), botiga amb algun preu visible | Validar fitxes, envasos i condicions d'accés; no hi ha API pública confirmada |
| SuperVerd | [Botiga oficial](https://botiga.superverd.es/es/2-inicio), HTTP 503 en revisar-la | Accés i contracte de dades no verificats |
| Roges | [Web oficial](https://roges.online/pages/es/inicio.php), anunci de nova botiga | Sense botiga operativa verificable en aquesta revisió |
| Montserrat | [Web oficial](https://smontserrat.com/), informació i promocions | Font de preus per producte no confirmada |
| Mas y Mas | [Botiga](https://tienda.masymas.com/es), aplicació JavaScript no carregada en aquesta revisió | Confirmar operador, cobertura catalana i font; no donar-la per integrada |
| Gros Mercat / GM Cash | [GM Cash](https://www.gmcash.es/), catàlegs i fullets professionals | Confirmar accés autoritzat a tarifes; un fullet no és una API |
| Pròxim / Suma | [Suma](https://www.sumasupermercados.es/ca/), xarxa de franquícies | Confirmar operador, assortiment i font de cada establiment |

No trobar documentació d'una API pública no demostra que no existeixi.
Les cadenes sense font validada requereixen investigació addicional o un
acord de dades; no es reutilitzen preus d'una altra marca del mateix grup.

La navegació principal té tres pestanyes, sense una portada duplicada:

- **Llista** (`/`): preparar la compra en quatre pantalles. `/list` conserva
	compatibilitat amb enllaços antics, mostrant el mateix component.
- **Mapa** (`/map`): consultar ubicació, radi i sucursals incloses, compartits
	amb el pas de selecció de supermercats. Cada canvi elimina el cercle de
	radi anterior i sortir del mapa també neteja aquesta capa.
- **Evolució** (`/history`): filtrar productes, períodes de 30/90/365 dies i
	consultar preus per envàs o unitat.

El procés de compra separa l'edició de la selecció i dels resultats:

1. **Llista** (`/`): apuntar productes i quantitats. Els productes ja comprats
	no s'envien al comparador.
2. **Botigues** (`/?step=stores`): definir la zona i seleccionar sucursals
	properes reals. Es distingeixen les trobades, les que tenen comparador
	i les seleccionades; una cadena sense lector no s'habilita.
3. **Preus** (`/?step=comparison`): consultar els resultats dels establiments
	seleccionats, amb productes trobats i pendents separats. Cada línia tria
	la marca compatible més barata per litre, quilo o unitat; el desplegable
	permet seleccionar una altra de les alternatives realment consultades.
4. **Compra** (`/?step=plan`): repartir cada línia una sola vegada pel menor
	import observat, canviar-la manualment a una altra sucursal amb lectura i
	marcar-la com a comprada. Els productes sense preu queden sense assignar.

Tornar als passos anteriors conserva la llista. Modificar productes, quantitats
o la zona invalida la comparació; marcar una compra no l'esborra. Recarregar
completament conserva la llista i la zona, però cal repetir la comparació.
Els imports del repartiment són de catàleg en línia, no equivalències
certificades ni preus de caixa de la sucursal.

La selecció és **Qualsevol marca** per defecte: un SKU utilitzat com a
referència no bloqueja la comparació amb una altra cadena. **Producte exacte**
manté la identitat i no se substitueix automàticament. La llista permet
escollir quantitats físiques o nombre d'envasos; comprar un envàs de pa no
equival a inventar un pes per a una unitat. Els formats es mostren i els
envasos obligatoris es compren sencers, encara que superin la quantitat demanada.
Els descartats distingeixen error de font, identitat, variant i format.

El procés diari desa 15 referències de Mercadona, 15 de Consum, 15 de Caprabo i 14 d'Ametller Origen,
amb identitat de producte, data original, font, context comercial i format físic.
Cada combinació de cadena, producte, magatzem i envàs té una sèrie separada.
Les lectures repetides d'una mateixa observació no creen punts nous; les
dades de mostra antigues sense procedència no apareixen al gràfic.
`GET /api/history?days=90` retorna aquestes sèries de catàleg en línia, no
preus de caixa certificats per sucursal. Comparar no crea més observacions.
Les dades anteriors es conserven, però les captures noves tenen un límit de
15 productes per dia i context per a cadascuna de les quatre cadenes actives.

### Captura diària de bàsics

La cistella inclou llet semidesnatada, arròs blanc, ous M, farina de blat,
sucre blanc, sal fina, oli d'oliva verge extra, oli de gira-sol, macarrons,
llenties cuites, cigrons cuits, tomàquet triturat, flocs de civada, pa de
motlle blanc i iogurt natural. Les referències, noms i envasos estan fixats
a `apps/api/src/services/basic-foods.ts`; un canvi no es substitueix automàticament.
Els formats varien entre cadenes: per exemple, el iogurt és de 6 x 125 g a
Mercadona, 4 x 125 g a Consum i 8 x 125 g a Caprabo. Es conserven com a
referències i sèries diferents, sense certificar substitucions pel nom.
La cobertura d'Ametller és de 14 dels 15 aliments: el pa blanc trobat és
sense crosta i declara 460 g al nom però 450 g a la quantitat estructurada.
No s'ha acceptat com a substitut. El panell el mostra com a aliment sense
referència validada, no com una fallada temporal ni com un producte sense estoc.

Cada cadena utilitza una sola font de preus, sense cadenes de fallback:

- Mercadona: REST oficial `tienda.mercadona.es/api`, amb magatzem confirmat.
- Consum: REST oficial `tienda.consum.es/api/rest/V1.0/catalog/product`, amb
	identificadors exactes i preu base `PRICE`, sense assumir les condicions
	de les ofertes. Malgrat el nom `centAmount`, el camp observat conté euros.
- Caprabo: dades estructurades `Product`/`Offer` del detall oficial del
	producte, carregat en navegador. No s'usen els preus dels camps d'analítica.
- Ametller: API Salesforce actual de `www.ametllerorigen.com/mobify/proxy/api/`,
  observada en carregar les fitxes oficials. Es valida identificador exacte,
  lloc `ametller`, moneda EUR, idioma `ca`, disponibilitat i coherència entre
  envàs, quantitat i preu per unitat. No s'apliquen promocions condicionades.
  El navegador gestiona la sessió anònima: no es desen cookies ni credencials.
  Es conserva l'URL de l'API com a procedència i s'ofereix la fitxa pública
  com a enllaç navegable; l'API directa requereix la sessió.
- Bonpreu: dades estructurades `Product`/`Offer` de les fitxes HTML oficials
	de `www.compraonline.bonpreuesclat.cat/products/`. La cerca només descobreix
	enllaços; el preu sempre es llegeix al detall del SKU exacte. Es validen
	moneda EUR, estoc i envàs explícits, inclosos multipacks i `12 per paquet`.
	Els pesos aproximats i les promocions condicionades no s'accepten com a
	preus d'un envàs fix. L'API `webproductpagews` no és una font alternativa.

Consum, Caprabo, Ametller i Bonpreu es consulten com a catàleg públic anònim: no s'ha confirmat
una zona postal ni un establiment. Aquest context es mostra explícitament.

El capturador és un procés separat, sense dependència de Redis per a aquest
volum. A les **04:00 Europe/Madrid** captura els identificadors fixats de cada cadena
directament, sense descarregar tot el catàleg. Comprova cada hora si cal recuperar
una captura fallida, amb tres intents màxims per cadena i dia i respectant
`Retry-After`. Un 403 o 429 atura les peticions restants d'aquella cadena.
Els errors, límits i reintents d'una cadena no impedeixen capturar les altres.
En arrencar després de les 04:00 recupera la captura del dia, però no inventa
captures de dies anteriors. La data de cada preu és la de consulta real.

L'estat i el resultat per aliment es desen a `ScrapingJob.result`. La feina
té una identitat estable per data/cadena/zona, un bloqueig persistent de
30 minuts i punts de continuació per reprendre només els aliments pendents.
Cada observació diària té un identificador estable: reiniciar o repetir la
feina no duplica els preus. La indisponibilitat, els errors de font i els
canvis de format queden diferenciats. La resposta normalitzada amb la seva
procedència es conserva dins del resultat; no és una còpia del payload HTTP original.

`GET /api/history/tracking` exposa cistella, referències i envasos, context,
captura més recent, vigència i errors per cadena. El panell Evolució permet
seleccionar el supermercat i mostra aquest estat i la font real del gràfic.

bonÀrea, Condis i Sorli tenen 15 observacions reals cadascun, llegides entre
el 10 i l'11 de novembre de 2026 (Europe/Madrid). Els 45 registres normalitzats
es conserven a `apps/api/data/catalan-observations-2026-11-10.json`, amb SKU,
envàs, preu, URL i hora originals. La data del lot i els identificadors
`official-html:<cadena>:2026-11-10` no substitueixen la data real de cada lectura.
Reimportar el mateix lot no crea punts nous. És un arxiu d'auditoria, no un
fallback ni una font de preus actuals; no conté cookies ni credencials.

Les tres cadenes tenen una única font: l'HTML del detall oficial. bonÀrea
valida el SKU ocult i el control de compra associat; Condis valida la URL
canònica, el preu actual i la quantitat neta, i rebutja còpies responsives
contradictòries; Sorli aïlla el modal de producte, valida el seu codi i
conserva l'assortiment postal observat `postal:08338`. Les targetes de cerca
només serveixen per descobrir fitxes. No s'inventen identificadors ni estoc.

Condis normalitza els ous per les unitats explícites del nom, no pel pes
que també publica la fitxa. Als llegums conserva el pes net explícit, que
pot diferir del pes escorregut del nom comercial. Els envasos i les marques
no són necessàriament equivalents entre cadenes: l'oli bonÀrea consultat és
de 3 l i el de Condis de 0,75 l; no es certifiquen totals comparables.

Els lectors locals han completat lectures reals sense CAPTCHA, però això
no acredita estabilitat diària. bonÀrea, Condis i Sorli encara no formen
part del planificador de quatre cadenes; Evolució mostra l'automatització
pendent. bonÀrea i Condis són catàlegs públics sense sucursal confirmada.
Sorli correspon a l'assortiment 08338, no a una botiga física certificada.
Condis i Sorli disposen de cerca general validada, sense el límit de quinze
referències. Condis descobreix SKU i URL amb la cerca oficial Empathy
`/search/v1/query/condis/search`, idioma `es`, context `store=718`, paginant
fins al total observat. Sorli utilitza el `POST /api/articulos/filtersort`
del navegador i carrega les pàgines amb el desplaçament del contenidor
`.layout-main-container`; les targetes obren les URL reals dels detalls.
Els preus continuen provenint només de l'HTML del detall oficial.
bonÀrea també disposa de cerca general validada: el formulari
oficial `/es/shop/find?searchWords=...` només descobreix noms, SKU i URL de
fitxes. Els preus es llegeixen exclusivament a cada detall oficial compatible,
mai de les targetes de cerca. Una fallada de xarxa conserva les lectures
ja validades, però marca la comparació com a lectura parcial, no completa.

El comparador conserva les referències registrades per a lectures exactes
conegudes de Condis, Sorli i bonÀrea, però utilitza cerca general per a
peticions genèriques. L'arxiu d'auditoria només
aporta metadades (aliment, SKU, nom i URL), mai preus actuals. Els bàsics es
normalitzen en català i castellà sense dependre d'un traductor extern.
Es conserven les variants demanades: desnatada no és semidesnatada, pa no és
pa ratllat i no s'afegeixen variants sense lactosa o enriquides sense demanar-les.
Ametller pagina la mateixa API oficial fins al total observat i aïlla fitxes
invàlides sense descartar les vàlides; no es limita als primers 48 resultats.
bonÀrea i Sorli es reconeixen en seleccionar botigues, sense ampliar el radi.
El context postal de Sorli es manté visible en la comparació i la compra.

### Veritas, Plusfresc, Condis i Sorli

Les quatre cadenes estan connectades a `POST /api/optimize`, no al catàleg
intern. Veritas també es reconeix entre les botigues reals del
mapa, sense inventar sucursals ni ampliar el radi.

El catàleg propi està versionat a `packages/shared/src/catalog.ts`, amb
identificadors `bossing:*`, categories pròpies, variants i sinònims. Les seves
dades són de només lectura i no contenen preus, disponibilitat ni
mides d'envàs atribuïdes als supermercats. La web cerca i navega localment per aquestes
dades, sense peticions de productes ni dependència de l'API.

La versió 2 incorpora una captura de les metadades públiques de Mercadona en
català, context `bcn1`: 26 categories principals i 152 de 152 branques llegides,
amb 4.655 aparicions de productes agrupades en 4.000 registres interns, més els
bàsics anteriors. No són 4.655 SKU diferents ni una certificació de tots els
assortiments geogràfics. Es conserven els identificadors interns anteriors quan
coincideix el producte i les marques pròpies s'eliminen del nom genèric.
Els noms que encara especifiquen una marca no certifiquen equivalents d'altres
cadenes. Les icones de categoria i miniatures referencien les URL originals;
no es redistribueixen fitxers gràfics ni es carrega el CSS del supermercat.

La captura és explícita i reproduïble, no forma part del planificador diari:

```sh
node packages/shared/scripts/import-mercadona-catalog.mjs --self-test
node packages/shared/scripts/import-mercadona-catalog.mjs --capture
pnpm --filter @bossing/shared build
```

L'importador publica `packages/shared/src/data/mercadona-catalog.ts` només si
acaba totes les branques sense registres rebutjats. Desa URL, context i hora de
captura de les metadades, però no importa preus ni disponibilitat. La cobertura
es pot consultar a `GET /api/products/suggestions`, camp `capture`.

Els endpoints de catàleg exposen les mateixes dades internes:

```http
GET /api/products/suggestions
GET /api/products/search?q=llet%20desnatada
GET /api/products/categories/bossing-category:dairy/generics
GET /api/products/bossing:milk-skimmed
```

La llista desa `catalogProductId`, quantitat i mesura de compra. Només en
comparar es consulten les fonts externes. L'optimitzador valida l'identificador
intern i recupera les especificacions canòniques; no el confon amb un SKU.
Per exemple, una línia pot enviar `catalogProductId: "bossing:milk-skimmed"`,
`name: "Llet desnatada"`, `quantity: 2`, `unit: "l"` i `quantityMode: "amount"`.
Les llistes anteriors es conserven: les referències genèriques coincidents
reben identificador intern i els SKU explícits mantenen la seva identitat.

Les mesures desades són `kg`, `l` i `u`. El selector de visualització converteix
grams/quilos, mil·lilitres/litres o unitats/dotzenes sense modificar la demanda:
500 g són 0,5 kg i una dotzena són 12 ous. Els ous nous comencen en 12 unitats;
els iogurts i altres formats comercials comencen en un envàs. Un envàs és una
unitat comercial, no necessàriament un pot individual. Els envasos i unitats
són enters positius; pes i volum admeten decimals. No es converteixen litres o
quilos en envasos sense dades reals: l'envàs observat en comparar determina el
nombre de paquets a comprar. Per exemple, 12 ous requereixen dos cartons reals
de sis. Les quantitats explícites de les llistes antigues es conserven.

Les ofertes de la comparació conserven envàs, preu per unitat, disponibilitat,
hora i `source`. Els errors de font no es presenten com una cerca completa:
les lectures ja validades es conserven com a parcials. Condis també continua després de fitxes indexades que
retornen 400, 404 o 410, sense certificar que la font sigui completa.

Veritas utilitza l'host actual `www.veritas.es`. El mapa publicat
`/media/sitemap/sitemap_es.xml` només descobreix URL; el preu s'obté de l'únic
`Product/Offer` JSON-LD del detall, amb SKU i URL canònica coincidents,
disponibilitat explícita i envàs fix. Les URL del mapa no són observacions
de preu ni acrediten disponibilitat. El context és `public-catalog`.

Plusfresc utilitza exclusivament la resposta oficial
`https://wscompra.plusfresc.cat/api/search/languages/ca/<consulta>/products/12`
que rep la seva botiga en una sessió convidada ordinària. No es desa ni
s'exposa l'autenticació de la sessió. El context observat és
`centre:12;postal:25001`, no una sucursal física certificada ni un altre CP.
El lector valida envàs i compra per unitat. Els preus mitjans de segones
unitats o promocions condicionals no substitueixen el preu individual; només
s'accepta una reducció explícita, incondicional i vigent com a preu actual.

Aquestes integracions permeten cercar marques i formats verificables, però
no certifiquen tots els articles ni tots els formats de cada catàleg.
No s'han afegit al planificador diari de quatre cadenes.
La comprovació conjunta de llet desnatada es conserva a
`apps/api/data/four-chain-observations-2026-11-11.json`, amb els quatre preus
seleccionats, URL, context i hora originals. La lectura de Condis és parcial
per fitxes indexades que retornen 400; les vuit alternatives vàlides es
conserven a la comparació, sense afirmar cobertura completa de la font.

La captura assistida del 10 de novembre de 2026 va aportar 15 observacions
reals de DIA i 15 d'Alcampo, 3 d'Eroski, 1 d'Aldi i 1 de Carrefour.
Les 35 observacions es conserven a
`apps/api/data/remaining-observations-2026-11-10.json`, amb URL i hora originals,
i s'importen amb identitat estable `browser-assisted:<cadena>:2026-11-10`.
Reimportar-les no crea punts nous i l'arxiu no s'utilitza com a preu actual.

L'11 de novembre de 2026 s'han llegit 21 referencies noves amb navegador
ordinari: 12 d'Eroski i 9 d'Aldi. Es conserven a
`apps/api/data/additional-observations-2026-11-11.json`, amb identitat de captura
`official-html:additional:2026-11-11`. La importacio repetida manté 21 punts,
sense duplicats ni canvis a les hores originals. Eroski arriba a 15 grups basics
observats i Aldi a 10, comptant les captures del dia anterior; no equival a
una cistella de quinze envasos identics ni a quinze preus nous del mateix dia.
La sal d'Aldi es iodada i els olis observats tenen envasos de 3 i 5 litres.
El lector admet el iogurt `pack de 8 x 125 g`, pero rebutja les llenties,
els cigrons i el tomàquet etiquetats nomes amb `peso esc.`: no es confon el
pes escorregut amb el net. Ous i sucre d'Aldi continuen sense fitxa validada.

Cada cadena te una unica font de preus: les fitxes HTML oficials. DIA,
Alcampo, Aldi i Carrefour llegeixen `Product`/`Offer` JSON-LD; Eroski llegeix
les microdades de l'oferta i exigeix un control de compra visible vinculat
al SKU. Les cerques nomes descobreixen enllacos, no aporten preus alternatius.
Aldi valida l'envas explicit de la fitxa; no admet ofertes amb dates encara
no validades. Carrefour incorpora els paquets obligatoris al preu i format:
la llet consultada es ven de sis en sis, 6 l per 4,98 EUR, no un bric independent.
La cerca general d'Aldi i Carrefour encara no esta validada; els seus lectors
accepten URL de producte exactes i fallen explicitament en la cerca general.

El navegador integrat pot llegir DIA, Alcampo i Carrefour, pero el capturador
local rep 403 a les fitxes exactes provades; Carrefour ho ha tornat a confirmar
l'11 de novembre. Aldi i Eroski permeten les lectures locals indicades, pero
aixo no acredita estabilitat diaria. Cap de les cinc cadenes noves s'ha
afegit al planificador. El context es `public-catalog`, no una sucursal
catalana certificada: Alcampo mostra per defecte 28029 i Carrefour 28232;
Aldi adverteix de diferencies a les illes i disponibilitat segons botiga.

Lidl publica ofertes de botiga, tant temporals com baixades permanents, pero
la cerca oficial de llet semidesnatada no ha retornat cap coincidencia i les
pagines revisades no acrediten la cistella de quinze basics. Els descomptes
Lidl Plus, pesos aproximats i productes a granel no s'importen com si fossin
envasos fixos de disponibilitat general. Aquesta cobertura continua pendent.

Bonpreu té 15 observacions reals del 10 de novembre de 2026 importades a
l'històric amb lectura assistida. L'API retorna 403 i el navegador automatitzat
també rep denegacions. El navegador integrat va permetre llegir les fitxes,
però va exigir després una verificació humana; l'usuari la va completar i
es van recuperar les quinze observacions. Això valida l'extracció del producte,
no una captura desatesa: Bonpreu no forma part de les quatre cadenes del
planificador i l'històric mostra explícitament l'automatització pendent.
La projecció dels camps JSON-LD llegits, URL i hora originals es conserva a
`apps/api/data/bonpreu-observations-2026-11-10.json`, sense cookies ni credencials.
És un registre d'auditoria, no un fallback ni un catàleg de preus actualitzat.
La importació usa la identitat estable `browser-assisted:bonpreu:2026-11-10`
per no duplicar observacions si es repeteix.

No es pot garantir una lectura diaria de Bonpreu sense CAPTCHA: una frequencia
baixa o conservar una sessio no impedeix que el repte reaparegui. Cal una
font autoritzada estable per al servei desates, o mantenir una represa humana
quan la web la demani. No es resolen ni s'esquiven reptes de robot.

No s'han esquivat aquests bloquejos ni activat captures fictícies.
L'antic endpoint Empathy d'Ametller retornava 404 i s'ha substituït per la
font Salesforce observada al web actual, sense mantenir-lo com a fallback.

```bash
pnpm --filter @bossing/scrapers build
pnpm --filter @bossing/api build
pnpm --filter @bossing/api capture:once  # Una captura manual idempotent
pnpm --filter @bossing/api capture      # Procés permanent programat
pnpm --filter @bossing/api test
```

`BASIC_CAPTURE_POSTAL_CODE` configura la zona de Mercadona; per defecte és
`08001`, confirmada per la font a cada intent. No s'aplica al catàleg públic
de Consum, Caprabo, Ametller ni Bonpreu. És independent de la ubicació
del dispositiu. Cada procés ha d'usar una zona configurada explícitament en
desplegar; no s'han d'arrencar zones redundants del mateix magatzem.

El procés ha de viure en un servidor sempre encès amb arrencada automàtica
i reinici supervisat. Deixar-lo en una terminal local no cobreix apagades del
PC ni garanteix servei 24/7. La base SQLite i les captures persistides s'han
de conservar en disc persistent i incloure en còpies de seguretat consistents.
La còpia externa automatitzada, les alertes externes i el desplegament 24/7
encara no estan configurats. No hi ha recuperació retrospectiva de preus.

La base de dades local usa SQLite. Per aplicar els camps de procedència
additius en aquest entorn, sense sembrar dades de prova:

```bash
pnpm --filter @bossing/database exec prisma db push
pnpm --filter @bossing/database generate
pnpm --filter @bossing/api build
```

Les migracions antigues del repositori encara són de PostgreSQL; cal
alinear-les amb el proveïdor del desplegament abans d'usar `migrate deploy`.
No s'han reiniciat bases de dades ni convertit aquelles migracions.

## Zona de compra compartida

El mapa i la llista comparteixen ubicació, radi i establiments seleccionats.
La ubicació es demana al dispositiu; si no està disponible, es pot escollir una
adreça o municipi. El radi es pot ajustar entre 50 m i 2 km, en passos de 50 m. Desmarcar una
botiga no descarta les altres sucursals de la mateixa cadena. El radi i les
exclusions es conserven localment; canviar la zona o la selecció invalida les
comparacions anteriors. No cal introduir cap codi postal: es resol internament.

Google Maps/Places és la font del mapa i dels establiments reals. L'API resol
adreces i codis postals amb Nominatim/OpenStreetMap, sense proveïdor alternatiu,
amb memòria cau i un màxim d'una petició per segon per procés. Cal respectar la
política d'ús de Nominatim; per desplegar a escala, configureu una instància o
servei dimensionat per a aquest ús abans de posar-lo en producció.

`POST /api/optimize` accepta `stores` amb `id`, `chain`, `name`, `address`, `lat`
i `lng`, el centre a `location` i `maxRadius` en km. Rebutja seleccions buides,
duplicades o fora del radi. Només consulta les cadenes seleccionades i retorna
els establiments originals amb les seves distàncies. `pricingScope` és
`online-catalog`: no s'ha certificat el preu de caixa de cada sucursal.

```bash
pnpm --filter @bossing/scrapers exec vitest run --root ../.. apps/web/src/lib/shopping-area.test.ts apps/api/src/services/price-history.service.test.ts packages/scrapers/src/sources/mercadona.test.ts --globals --pool=forks --poolOptions.forks.singleFork
pnpm --filter @bossing/scrapers exec tsx src/manual-tests/mercadona-api.ts --api-url=http://localhost:3001
```

## Cistella de referencia Mercadona

Mercadona utilitza exclusivament `https://tienda.mercadona.es/api` per a
productes i preus, sense recórrer a Algolia ni HTML quan falla. Un error
de la font no és una cerca sense coincidències. El catàleg només es desa
si totes les categories han respost correctament.

La prova de referència fixa el codi postal `08001` i aquests productes:
- `merc-10382`: 2 litres de llet semidesnatada Hacendado, en brics d'1 litre.
- `merc-5044`: 2 kg d'arròs rodó Hacendado, en paquets d'1 kg.
- `merc-31505`: 12 ous mitjans M, en una capsa de 12.

El 9 de novembre de 2026, el carro oficial, el motor i l'endpoint de Bossing
han coincidit en **6,81 EUR de productes**, sense tramitar cap comanda.
No inclou transport, mínim de compra ni garantia d'estoc en preparar la comanda.
Això valida aquesta cistella i aquesta zona, no tots els productes ni els
altres supermercats.

```bash
pnpm exec turbo build --filter=@bossing/api
pnpm --filter @bossing/scrapers exec vitest run src/sources/mercadona.test.ts --pool=forks --poolOptions.forks.singleFork
pnpm --filter @bossing/scrapers exec tsx src/manual-tests/mercadona-api.ts --catalog
```

Amb l'API en marxa, després de consultar de nou el carro oficial, es pot
contrastar també l'endpoint. El valor de 681 cèntims és l'observat aquell dia,
no un preu immutable:

```bash
pnpm --filter @bossing/scrapers exec tsx src/manual-tests/mercadona-api.ts --expected-total-cents=681 --api-url=http://localhost:3001
```

`POST /api/optimize` interpreta `quantity` com a quantitat física en la `unit`
indicada (`l`, `ml`, `kg`, `g`, `u` o `ud`), no com a nombre d'envasos. Retorna
els envasos necessaris, la quantitat real comprada i els imports calculats en
cèntims. Els productes de pes variable o sense format verificable no es
consideren resolts. Una cistella només té `comparable: true` i `totalCost`
numèric si és completa, amb identitats exactes i zona confirmada. La cerca
només pel nom no certifica equivalència entre supermercats. En la resta de
casos, `totalCost` és `null`, `subtotal` és parcial o no validat i no es
calculen estalvis. Els estats són `verified`, `incomplete`, `unverified` i
`source_error`. Aquesta certificació encara només està implementada per a
Mercadona; Consum, Caprabo i Ametller ja disposen de captures històriques verificades,
però no de certificació de cistella equivalent amb zona confirmada.

## 🚀 Començar

### Requisits previs
- Node.js >= 18
- pnpm >= 8
- SQLite local (gestionat per Prisma; no requereix servidor separat)
- Clau de Google Maps amb les APIs del mapa i Places habilitades per a la zona de compra

### Instal·lació

```powershell
# Clonar el repositori
git clone https://github.com/frolesti/bossing.git
cd bossing

# Instal·lar dependències
pnpm install

# Configurar variables locals (no sobreescriure fitxers existents)
Copy-Item .env.example .env
Copy-Item .env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local

# Preparar Prisma i els paquets que importa l'API
pnpm --filter @bossing/database generate
pnpm --filter @bossing/database exec prisma db push
pnpm exec turbo build --filter=@bossing/api
```

Configura les claus locals sense versionar-les. Inicia en dues terminals:

```powershell
pnpm --filter @bossing/api dev  # http://localhost:3001/health
```

```powershell
pnpm --filter @bossing/web dev  # http://localhost:3000
```

La web i l'API no activen el capturador diari. És un procés opcional separat,
descrit a la secció de captures. No cal Redis per provar aquests dos serveis
ni s'ha d'executar el seed per preservar l'històric local existent.
Les migracions antigues PostgreSQL no són el procediment SQLite local.

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
- Gràfics d'observacions verificades de Mercadona, Consum, Caprabo, Ametller i lectures assistides de Bonpreu, DIA, Alcampo, Eroski, Aldi i Carrefour, per producte, envàs i context
- Períodes de 30 dies, 90 dies i un any; preu per envàs o unitat
- Sense dades històriques inventades ni alertes implementades

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

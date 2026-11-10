# CupreWeb – CUPRÉ webshop (Next.js 16 + TypeScript)

A CUPRÉ statikus prototípus (`Eredeti/CUPRE-CODEX-TELJES-ATADAS/CUPRE-CODEX-ATADAS`) Next.js-re átültetett változata. A dizájn 1:1 egyezik az eredetivel (1440, 800 és 375 px szélességen elemenként összevetve).

## Indítás

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build && pnpm start   # production, :3002
```

## Struktúra

Két root layout van route groupokkal, hogy a Tailwind/HeroUI alapstílusok ne torzítsák a CUPRÉ dizájnt:

| Útvonal | Hely | Layout |
|---|---|---|
| `/`, `/en`, `/de` | `src/app/(shop)/[lang]/page.tsx` | `(shop)/[lang]/layout.tsx` – csak `cupre.css` |
| `/termekek`, `/termekek/[slug]` (+ `/en/…`, `/de/…`) | `src/app/(shop)/[lang]/termekek/…` | `(shop)/[lang]` |
| `/penztar` (+ `/en/…`, `/de/…`) | `src/app/(shop)/[lang]/penztar/page.tsx` | `(shop)/[lang]` |
| `POST /api/orders` | `src/app/api/orders/route.ts` | – |
| `/login`, `/register`, `/lassu` | `src/app/(main)/…` | `(main)/layout.tsx` – HeroUI + Tailwind demó |
| ismeretlen URL | `src/app/global-not-found.tsx` | saját HTML (`experimental.globalNotFound`) |

- `src/app/(shop)/cupre.css` – az eredeti `css/style.css` változatlanul, a végén az új elemek (termék, pénztár, nyelvválasztó) kiegészítő stílusaival.
- `src/components/cupre/` – szekció és oldal komponensek; a fejléc (nyelvválasztóval), lábléc, kosár és toast a `(shop)/[lang]/layout.tsx`-ben van, így a kosár oldalváltáskor is megmarad (és `localStorage`-ban is).
- `src/services/` – szerveroldali adatelérés: `data-paths.ts` (környezet adatkönyvtára), `dictionary-service.ts` (szótárak), `product-service.ts`, `faq-service.ts`, `customer-db.ts` (SQLite), `order-service.ts` (rendelés validálása és mentése).
- `src/lib/` – `i18n.ts` (nyelvek, útvonalak, árformázás), `app-env.ts` (környezet), `cupre-content.ts` (menü, képek).
- `src/proxy.ts` – a magyar címeket előtag nélkül szolgálja ki (belsőleg `/hu/…`), a `/hu/…` címet átirányítja.
- `src/types/` – `product.ts`, `faq.ts`, `order.ts`, `cupre.ts`.

## Nyelvek (magyar, angol, német)

| Nyelv | URL | Példa |
|---|---|---|
| magyar (alapértelmezett) | előtag nélkül | `/termekek/cupre-original` |
| angol | `/en/…` | `/en/termekek/cupre-original` |
| német | `/de/…` | `/de/termekek/cupre-original` |

- A nyelvválasztó a fejlécben van (520 px alatt a mobil menüben), és ugyanarra az oldalra visz a másik nyelven. Az oldalak `hreflang` alternatívákat adnak a keresőknek.
- **Felületi szövegek:** `src/data/i18n/hu.json`, `en.json`, `de.json`. Ezek környezetfüggetlenek; a szerkezetet a `hu.json` adja, és a build hibát dob, ha az angolból vagy a németből hiányzik egy kulcs.
- **Üzleti adatok:** a `products.json` és a `faq.json` szöveges mezői `{ "hu": …, "en": …, "de": … }` objektumok; az árak és cikkszámok közösek. Hiányzó fordításnál a build hibát dob.
- A rendelés nyelve az `orders.lang` oszlopba kerül (a meglévő adatbázisokat a szerviz automatikusan bővíti), a tételnév az alapnyelven (magyarul) tárolódik.
- Az ajándékbanner képébe égetett felirat magyar; idegen nyelven csak az alt szöveg fordított.

## Adatok és környezetek (`src/data`)

Minden üzleti adat a `src/data/<környezet>/` alatt van; a környezetet az `APP_ENV` dönti el:

| Parancs | `APP_ENV` | Adatkönyvtár |
|---|---|---|
| `pnpm dev` | – | `src/data/development/` |
| `pnpm build:test` / `pnpm start:test` | `test` | `src/data/test/` |
| `pnpm build` / `pnpm start` | `production` | `src/data/production/` |

Környezetenként:

- `products.json` – termékek (háromnyelvű szövegekkel); minden termék `variants` tömbje a **méret × osztály** (`grade`: `first` = I. osztály, `second` = II. osztály) változatokat tartalmazza saját cikkszámmal (`sku`) és árral (`priceHuf`). A slug és az SKU egyedi kell legyen, különben a build hibát dob.
- `faq.json` – GYIK (háromnyelvű); ismétlődő azonosító vagy kérdés esetén a build hibát dob.
- `products.json` → `productInfo` – kötelező termékadatok: szálösszetétel (EU 1007/2011), kezelés, gyártó, EU-s felelős személy (ha a gyártó nem uniós, különben `null`), termékazonosító, biztonsági információk (GPSR, EU 2023/988). A termékoldal „Termékinformációk” blokkja mutatja.
- `company.json` – a szolgáltató adatai (impresszum, ÁSZF, adatkezelés), tárhelyszolgáltató, békéltető testület, NAIH, valamint a webshop beállításai: `shop.liveOrders` (élesítéskor `true` → a gomb „Megrendelés fizetési kötelezettséggel”), `shop.shippingFeeHuf` (szállítási díj, `null` = még nincs), `shop.legalUpdated` (a jogi dokumentumok hatálya).
- `customers.sqlite` – ügyfelek és rendelések (Node beépített `node:sqlite`), első rendeléskor jön létre. Táblák: `customers` (e-mail szerint egyedi), `orders` (nyelv, szállítási díj, az ÁSZF elfogadásának időpontja), `order_items` (az ár a rendelés pillanatában rögzítve). A `.gitignore` kizárja, mert személyes adatot tartalmaz.
- `outbox/` – a kimenő levelek szövege (rendelés-visszaigazolás, hírlevél-megerősítés, jelszó-visszaállítás), amíg nincs e-mail-szolgáltató bekötve (`src/services/mail-service.ts` → `sendMail`). Szintén `.gitignore`-ban.

## Szállítási módok

Egyenként be/kikapcsolható, módonként fix díjjal, környezetenként a `company.json` → `shop.shipping` alatt (ha egyik sincs bekapcsolva: „Szállítási díj: egyeztetés alatt”, díj 0):

| Mód | Beállítás | Átvételi pont |
|---|---|---|
| Házhozszállítás futárral | `home: { enabled, feeHuf, carrierName, deliveryDays }` | – |
| Foxpost csomagautomata | `foxpost: { enabled, feeHuf, deliveryDays }` | **térképes választó** (Foxpost automatakereső, `cdn.foxpost.hu/apt-finder/v1/app/` iframe, `postMessage`) – csak a gomb megnyomásakor töltődik be |
| MPL PostaPont / automata | `mplPoint: { enabled, feeHuf, deliveryDays }` | kézi megadás (pont neve + címe, link a posta.hu-ra) – a hivatalos MPL beágyazható pontkereső még nincs bekötve |

- A díjat mindig a szerver számolja a beállításból; a rendelés a módot és a pontot (`shipping_method`, `pickup_point_*`) is tárolja; levélben, visszaigazoláson és a „Rendeléseim” listában is megjelenik.
- Átvételi pontos módnál a pénztár címmezői a számlázási címet jelentik.
- A pontválasztó (`src/components/cupre/pickup-point-picker.tsx`) szolgáltatónként bővíthető (pl. MPL widget, Packeta), ha megvan a hivatalos integrációs leírás / kulcs.

## Rendeléskezelés (admin)

**`/admin/rendelesek`** (közös admin menü: Rendelések · Kuponok · Hírlevél; belépés `ADMIN_PASSWORD`-del a `/admin/hirlevel` oldalon):

- Lista állapot-fülekkel (Beérkezett / Feldolgozás alatt / Feladva / Teljesítve / Lemondva, darabszámmal), keresés rendelésszámra, névre, e-mailre; **CSV export** a szűrőkkel.
- Részletek: vásárló, tételek, szállítás (átvételi ponttal), fizetés (mód, állapot, azonosító, kupon), állapotnapló és fizetési események.
- **Állapotváltás** megjegyzéssel (`order_status_history` tábla). **Feladva** állapotnál a vásárló a rendelés nyelvén levelet kap; a megjegyzés (pl. csomagkövetési szám) a levélben is megjelenik.
- **Fizetés beérkezett**: átutalásos és utánvétes rendelésnél rögzíthető → `paid`, a vásárló „fizetés beérkezett” levelet kap. Kártyás fizetést nem lehet kézzel átírni (azt a szolgáltató állapota adja).
- A vásárló a „Rendeléseim” listában látja a rendelés állapotát.

## Kuponok (akciók)

- **Fix összegű** kupon, **érvényességi idővel** (tól–ig, napra pontosan, budapesti idő szerint; üresen hagyva nincs korlát), be/kikapcsolható.
- Kezelés: **`/admin/kuponok`** (ugyanazzal az `ADMIN_PASSWORD`-del, mint a hírlevél admin): létrehozás, be/kikapcsolás, törlés, felhasználási számláló. Az adatok a környezet SQLite adatbázisában (`coupons` tábla).
- Beváltás a pénztár összesítőjében (`/api/coupons/check`, próbálkozás-korláttal); a rendeléskor a szerver **újra ellenőrzi**. A kód kis- és nagybetűtől független.
- A kedvezmény csak a termékek árából vonódik le, legfeljebb annak összegéig; a szállítási és utánvételi díjat nem érinti. Rendelésenként egy kupon. A rendelés tárolja a kódot és a levont összeget (`coupon_code`, `discount_huf`); a levélben is megjelenik.
- Barion kártyás fizetésnél kuponos rendelésnél egyetlen összesítő tétel megy át (a tételek összege így biztosan egyezik a végösszeggel).

## Fizetési módok

Három mód, egyenként be/kikapcsolható környezetenként a `company.json` → `shop.payments` alatt (ha egyik sincs bekapcsolva, a rendelés fizetési mód nélkül rögzül):

| Mód | Beállítás | Állapot a rendelés után |
|---|---|---|
| Bankkártya | `card: { enabled, provider: "barion" \| "mock" }` | `pending` → `paid` / `failed` / `canceled` / `expired` |
| Banki átutalás | `transfer: { enabled, accountHolder, bankName, accountNumber, iban, swift, dueDays }` | `awaiting_transfer` (közlemény: `CUPRE-<rendelésszám>`) |
| Utánvét | `cod: { enabled, feeHuf }` | `awaiting_cod` (a díj a végösszegben) |

- **Barion** (`src/services/barion-client.ts`): `POST /v2/Payment/Start`, állapot: `GET /v4/Payment/{id}/PaymentState`, `x-pos-key` fejléccel – a hivatalos [barion-web-php](https://github.com/barion/barion-web-php) könyvtár alapján (a docs.barion.com automatikusan nem volt elérhető). Kell hozzá: `BARION_POS_KEY`, `BARION_PAYEE`, `BARION_ENVIRONMENT` és **https** `SITE_URL` (lásd `.env.example`); ezek nélkül a kártyás mód nem jelenik meg. A kártyaadat csak a Barion fizetőoldalán kerül megadásra.
- **Callback** (`/api/payments/barion/callback`): csak a fizetési azonosítót veszi át, az állapotot mindig a Barion API-tól kérdezi le; a frissítés idempotens (kifizetett rendelés nem írható vissza). Minden lépés a `payment_events` táblába naplózódik.
- **Eredményoldal** (`/fizetes/eredmeny?order=…&token=…`): csak a rendeléshez kiadott titkos tokennel ad ki adatot; függő fizetésnél újrakérdez, sikertelennél újrapróbálást kínál.
- **Teszt-szolgáltató** (`provider: "mock"`, `/fizetes/teszt`): fejlesztéshez, Barion kulcsok nélkül – siker / sikertelen / megszakítás szimulálása. `APP_ENV=production` alatt tiltott.
- A development környezetben mindhárom mód be van kapcsolva (kártya = mock, utánvét díja 990 Ft helyőrző); test/production alatt kikapcsolva.

## Vásárlói fiók és hírlevél

| Oldal | URL (+ `/en`, `/de`) |
|---|---|
| Regisztráció (vásárlás nélkül is) | `/fiok/regisztracio` |
| Belépés | `/fiok/belepes` |
| Elfelejtett jelszó / új jelszó | `/fiok/jelszo-emlekezteto`, `/fiok/uj-jelszo?token=…` |
| Fiókom (profil, hírlevél be/ki, rendeléseim, jelszócsere, kilépés, fióktörlés) | `/fiok` |
| Hírlevél-feliratkozás / megerősítés / leiratkozás | `/hirlevel`, `/hirlevel/megerosites?token=…`, `/hirlevel/leiratkozas?token=…` |
| Admin: feliratkozók listája, szűrés, törlés, CSV | `/admin/hirlevel` (csak magyarul) |

- **Biztonság:** a jelszó `scrypt` hash-ként (sóval) tárolódik; a munkamenet véletlen tokenje httpOnly sütiben van (`cupre_session`, 30 nap), az adatbázisban csak a SHA-256 hash-e. Jelszócsere és jelszó-visszaállítás után minden munkamenet megszűnik. A belépés, a regisztráció, a jelszó-emlékeztető és a feliratkozás próbálkozásai korlátozottak (`src/lib/rate-limit.ts`, folyamaton belüli – több szerverpéldánynál közös tárra kell cserélni). A jelszó-emlékeztető nem árulja el, létezik-e fiók egy címhez.
- **Rendelés és fiók:** belépett ügyfélnél a pénztár előtölti a szállítási adatokat, a rendelés a fiókhoz kötődik. A rendelés a szállítási adatokat pillanatképként is tárolja; egy vendégrendelés egy regisztrált e-mail címmel nem írja felül a fiók profilját.
- **Hírlevél:** dupla megerősítés (opt-in) – a feliratkozás a levélben lévő linkre kattintva lesz aktív. Feliratkozni a `/hirlevel` oldalon (a főoldali „Értesítést kérek” gomb ide visz), regisztrációkor, a fiókban és a pénztárban lehet. Kiküldés külső szolgáltatóval: az admin oldalról az **aktív** feliratkozók CSV-ben exportálhatók.
- **Fióktörlés:** a fiók, a munkamenetek és a hírlevél-feliratkozás törlődik; a rendelések a számviteli megőrzés miatt megmaradnak (rendelés nélküli ügyfélsor is törlődik).
- **Admin:** az `ADMIN_PASSWORD` környezeti változóval kapcsol be (legalább 12 karakter), lásd `.env.example`. Fejlesztéshez a `.env.development.local` tartalmaz egy véletlen jelszót (nincs verziókezelésben).

## Jogi oldalak

| Oldal | URL (+ `/en`, `/de`) | Tartalom forrása |
|---|---|---|
| ÁSZF | `/aszf` | `src/data/legal/<nyelv>.json` → `aszf` |
| Adatkezelési tájékoztató | `/adatvedelem` | `… → adatvedelem` |
| Elállási tájékoztató + nyilatkozatminta | `/elallas` | `… → elallas` |
| Impresszum | `/impresszum` | `company.json` |

A jogi szövegekben a `{companyName}`, `{email}`, `{conciliationName}` stb. helyettesítőket a `company.json` adataival tölti ki a rendszer (`src/services/company-service.ts` → `getLegalTokens`). **A szövegek vázlatok:** a `[KITÖLTENDŐ]` és `[JOGÁSZ ÁLTAL VÉGLEGESÍTENDŐ]` jelölésű részeket élesítés előtt jogásszal kell véglegesíteni; amíg ez nem történik meg, minden jogi oldal tetején figyelmeztetés látszik. A láblécben mindegyik oldal linkje szerepel; a pénztárban kötelező az ÁSZF elfogadása, az adatkezelési tájékoztató pedig linkkel van megjelölve (hozzájárulás nem kell, a jogalap a szerződés teljesítése).

A JSON-ok build közben kerülnek a statikus oldalakba: production/test környezetben módosítás után újra kell buildelni; `pnpm dev` alatt azonnal látszik. A rendelés árát mindig a szerver számolja a `products.json`-ból, a kliens által küldött árat nem fogadja el.

## Képek (`public/images/`)

| Fájl | Eredeti | Szerep |
|---|---|---|
| `logo-crescent.png` | asset-01 | holdsarló logó (fejléc, márka, hírlevél, favicon) |
| `hero-bedroom.webp` | asset-02 | hero háttér |
| `product-cupre-original.webp` | asset-03 | termékkép, csomagolás, kosár |
| `gift-banner.png` | asset-04 | ajándékbanner |
| `story-texture.webp` | asset-05 | „Különleges textúra” kártya |
| `story-home.webp` | asset-06 | „Az otthon nyugalma” kártya |
| `story-protection.webp` | asset-07 | „Rézszálas technológia és védelem” kártya |
| `technology-detail.webp` | asset-08 | technológia szekció |
| `care-bedroom.webp` | asset-09 | használat szekció |

## Élesítés előtt cserélendő / ellenőrizendő

- Minden kép AI-generált látványterv – valós Lorix-termékfotókra cserélendő.
- Árak (I. o. 24 900 Ft tesztár, II. o. 19 900 Ft **helyőrző**), méretek, anyagösszetétel, az osztályok pontos szempontjai – mindhárom környezet `products.json`/`faq.json` fájljában véglegesítendő.
- Technológiai állítások (árnyékolás, antimikrobiális tulajdonság) – csak termékspecifikus mérési adatokkal.
- `company.json` (mindhárom környezet) kitöltése, `shop.liveOrders: true`, a `shipping` és `payments` kapcsolók és díjak beállítása.
- `products.json` → `productInfo` kitöltése (szálösszetétel, kezelés, gyártó, GPSR-adatok).
- Jogi szövegek véglegesítése jogásszal (`src/data/legal/*.json`), majd a `legal.draftNotice` figyelmeztetés eltávolítása a szótárakból.
- Visszaigazoló e-mail: a `sendMail` cseréje valódi küldésre (SMTP vagy e-mail API), `SITE_URL` környezeti változó beállítása a levél linkjeihez.
- Számlázás (pl. Számlázz.hu / Billingo bekötés) és visszatérítés (Barion refund) – még nincs.
- Cookie-hozzájárulás: most nem kell (csak a működéshez szükséges kosártárolás van); analitika/marketing bekötésekor kötelező.
- `ADMIN_PASSWORD` és `SITE_URL` beállítása a test és production szerveren (a `SITE_URL` https-sel biztonságos sütiket is bekapcsol).
- Hírlevélküldő szolgáltató (pl. Brevo, Mailchimp) kiválasztása; a leiratkozások szinkronizálása vele (most CSV-export van).
- A regisztrációkor megadott e-mail címet a rendszer nem ellenőrzi külön levéllel (a hírlevélnél van megerősítés).
- Fizetés: Barion szerződés és fiók; sandbox kulcsokkal végigpróbálni (a valódi Barion hívás még nincs tesztelve, csak a teszt-szolgáltató); a Barion által előírt logó-megjelenítés és a **Barion Pixel** követelményeinek ellenőrzése (süti-hozzájárulás!); a callback paraméter nevének (`paymentId`) egyeztetése a dokumentációval; bankszámlaadatok és utánvételi díj kitöltése; a `payments` kapcsolók beállítása test/production alatt.
- Szállítás: futárszolgálat neve, végleges díjak és szállítási idők; Foxpost és MPL szerződés; az MPL hivatalos pontkeresőjének beágyazása (ha van partneri leírás), a csomagfeladás (címke, API) még nincs bekötve.
- Keresés – jelenleg csak tájékoztató toast.

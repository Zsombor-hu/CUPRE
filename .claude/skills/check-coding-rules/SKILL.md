---
name: check-coding-rules
description: >
  Ellenőrzi a Merkit.NextJS projekt kódolási szabályainak betartását két
  részben: (A) projekt-konvenciók (Next.js 16 / App Router sajátosságok,
  mappa-rétegzés, `any` tiltás, `pnpm lint`, környezet és titkok, build
  környezetek összhangja, verzió-konzisztencia) és (B) a négy szigorú
  stíluszabály (kapcsos zárójel minden control structure-nél, komment minden
  control structure és function fölött, verzió-szinkron). Strukturált
  jelentést ad fájl:sor hivatkozásokkal, kódot NEM módosít automatikusan.
  Használd ezt a skillt MINDIG, amikor a felhasználó kódolási szabályok,
  stíluskompliancia, konvenciók, zárójelezés, kommentelés vagy verzió-szinkron
  ellenőrzését kéri ebben a projektben (vagy: "nézd át a kódot a szabályok
  szerint", "kompliancia ellenőrzés", "coding style check", "brace check",
  "van-e hiányzó komment", "szinkronban van-e a verzió"), még akkor is, ha nem
  explicit a "check-coding-rules" nevet mondja. Alapértelmezetten a
  Merkit.NextJS-re fut, de más útvonalra is irányítható, ha a felhasználó
  explicit más projektet/mappát nevez meg.
---

# Kódolási szabályok ellenőrzése (check-coding-rules)

## Miért van ez a skill

A Merkit.NextJS-nek két szabálykészlete van, mindkettő **kötelező**:

- **A. rész – projekt-konvenciók.** Az `AGENTS.md`-ben, az
  `eslint.config.mjs`-ben, a `tsconfig.json`-ban, a `next.config.ts`-ben és a
  kód szerkezetében rögzítettek.
- **B. rész – négy szigorú stíluszabály:** kapcsos zárójel, komment a control
  structure-ök és a function-ök fölött, verzió-szinkron.

A skill újra és újra lefuttatható ellenőrzés, ami **csak riportál**, sosem
javít automatikusan. A tényleges javítást mindig a felhasználó rendeli el,
külön kérésre.

## Hatókör

- **Alapértelmezett célpont:** `C:\Merkit\Merkit.NextJS`
  - kódfájlok: `src/` (`app`, `components`, `hooks`, `lib`, `services`,
    `types`)
  - konfiguráció és doksi: `package.json`, `eslint.config.mjs`,
    `next.config.ts`, `tsconfig.json`, `AGENTS.md`, `README.md`,
    `.gitignore`
- **Kizárva:** `node_modules/`, `.next*/`, `package-lock.json`,
  `pnpm-lock.yaml`, `next-env.d.ts`, `public/`, `*.placeholder`/`placeholder.txt`
  tartalma, valódi `.env*` fájlok tartalma (titkokat tartalmazhatnak, ne olvasd
  és ne idézd őket).
- Ha a felhasználó explicit más útvonalat vagy projektet nevez meg, azt
  ellenőrizd az alapértelmezett helyett.
- A skill futása közben **semmit nem módosítasz**, kivéve a `pnpm lint`
  által keletkező ideiglenes fájlokat (ezek nem forrásfájlok).
- A projekt **nem git repository**, ezért `git ls-files` nem használható.

## A. rész – Projekt-konvenciók

### A1. Next.js sajátosságok
- Az `AGENTS.md` szerint ez a Next.js (16.x, `cacheComponents`,
  `partialPrefetching`) eltérhet a megszokottól. Ha egy API vagy konvenció
  használata gyanús (pl. `instant`, `connection()`, `LayoutProps<"/">`),
  a `node_modules/next/dist/docs/` az irányadó; ne a memóriára támaszkodj.
- Az App Router speciális fájljai (`page`, `layout`, `route`, `error`,
  `loading`, `not-found`) a `src/app` alatt, a megfelelő nevekkel vannak.
  Az `error.tsx` `"use client"` direktívát igényel.
- `"use client"` csak ott szerepeljen, ahol valóban kell (state, effect,
  eseménykezelő, böngészőspecifikus API). Jelezd a felesleges használatot.
- A `route.ts` handlerek `Response`/`NextResponse`-t adnak vissza, és a
  bejövő törzset validálják (lásd a meglévő `POST` handlert: típusellenőrzés
  és 400-as válasz).
- Ahol blokkoló kérésfüggő kód van (pl. `await connection()`), annak
  szándékát komment indokolja (lásd `src/app/(unittest)/lassu/page.tsx`).

### A2. Mappák és rétegzés
- UI-komponensek: `src/components` (alap UI primitívek: `src/components/ui`).
- Egyedi React hookok: `src/hooks`; harmadik fél konfigurációi: `src/lib`;
  adatelérés és üzleti logika: `src/services`; típusok: `src/types`.
  Jelezd, ha ilyen jellegű kód ezeken kívül (főleg `src/app` alatt)
  jelent meg, és újrafelhasználható lenne.
- Az importokban az `@/*` alias (`./src/*`) használandó; jelezd a mély
  relatív importokat (`../../..`) olyan fájlokra, amelyek a `src/` alatt
  vannak.
- Ha egy mappában, ahol `placeholder.txt` van, már van valódi kód, a
  placeholder törlendő ("javaslat").

### A3. TypeScript és lint
- `any` az alkalmazás kódjában **tiltott**. Keresd: `: any`, `as any`,
  `<any>`, `any[]`.
- `@ts-ignore`, `@ts-expect-error`, `eslint-disable` indoklás-komment nélkül
  jelzendő.
- Futtasd a `pnpm lint` parancsot (ha a környezet nem engedi, `npx eslint`),
  és add vissza az eredményt fájl:sor szerint. Ha a futtatás nem lehetséges,
  jelezd, hogy kimaradt.
- Tesztszkript és tesztkeretrendszer jelenleg **nincs**; ezt írd le
  "nincs teszt" megjegyzéssel, ne hibaként. Opcionálisan futtasd:
  `npx tsc --noEmit` típusellenőrzéshez.
- A gyökérben egyszerre van `pnpm-lock.yaml` és `package-lock.json`: jelezd
  ezt "javaslat"-ként, mert két csomagkezelő lockfile-ja eltérhet.

### A4. Környezet és titkok
- `.env*` fájl nem kerülhet verziókezelésbe (a `.gitignore` tiltja); jelezd,
  ha a `.gitignore` ezt a sort elveszítette.
- Titok (kulcs, jelszó, token, kapcsolati string jelszóval) nincs beégetve a
  kódba. A kliensoldali kódba (`"use client"`, `NEXT_PUBLIC_*`) titok nem
  kerülhet.

### A5. Build-környezetek összhangja
A projektnek két futtatási környezete van (`APP_ENV=production` és `test`),
külön build könyvtárral (`.next` / `.next-test`). Ellenőrizd, hogy:
- a `package.json` scriptjei (`build`, `start`, `build:test`, `start:test`),
  a `next.config.ts` `distDir`-je, a `tsconfig.json` `include` listája és az
  `eslint.config.mjs` `globalIgnores` listája ugyanazokat a könyvtárakat
  nevezi meg;
- a két környezet portjai nem ütköznek (`dev` 3000, `start:test` 3001,
  `start` 3002).
Ha új környezet vagy `distDir` kerül be, mind a négy helyen szerepeljen.

### A6. Kommentstílus (ami a kódban ténylegesen van)
A kód magyar nyelvű, rövid, a **miértet** magyarázó `//` kommenteket
használ az exportált függvények fölött (pl. `route.ts`, `button.tsx`,
`lassu/page.tsx`). `/** ... */` JSDoc is elfogadott. Angol nyelvű vagy
hiányzó komment "javaslat" besorolású (a hiányzó komment a B2-B3 szerint
egyben szabálysértés is).

### A7. Verzió-konzisztencia
Az alkalmazás verziójának egyetlen forrása a `package.json` `"version"`
mezője. Ellenőrizd, hogy:
- a `src/` alatt (főleg `src/app/api/version/route.ts`) nincs beégetett
  verziószám, ami eltér a `package.json` értékétől (jelenleg a `route.ts`
  `"1.0.0"` értéket ad, a `package.json` pedig `0.1.0`);
- a `README.md` vagy más dokumentum nem említ eltérő verziót.
Javasolt megoldás: a verziót a `package.json`-ból olvassa a kód
(`import pkg from "@/../package.json"` vagy relatív import; a
`resolveJsonModule` be van kapcsolva), ne beégetett konstansból.

## B. rész – A négy szigorú stíluszabály

### B1. Zárójelezés (TS/TSX/MJS)
Minden `if`/`for`/`while`/`try` (és hasonló control structure) test-je mindig
`{}`-ben legyen, még egysoros ág esetén is. Keress bare formákat, pl.
`if (x) return;`, `for (...) sum += ...;` zárójel nélkül.

Ajánlott módszer: célzott grep, pl. `^\s*(if|for|while) \(.*\) [a-zA-Z]`
olyan sorokon, amelyek nem `{`-re végződnek, majd kézi átnézés a
találatokon (hamis pozitívok: ternary, JSX, többsoros feltétel, `else if`
lánc folytatása).

### B2. Komment minden control structure fölött
Minden `if`/`for`/`while`/`try` blokk közvetlenül fölött legyen egy rövid
komment, ami a **szándékot** magyarázza (miért van ez az ág/ciklus), nem
csak azt, hogy technikailag mit csinál.

### B3. Komment minden function fölött
Minden function/arrow-function/metódus definíció fölött legyen komment.
A `//` és a `/** ... */` is megfelel, ha a függvény fölött közvetlenül áll.
Ide tartoznak a React komponensek és a `route.ts` handlerek is.

### B4. Verzió-szinkron
Ugyanaz, mint az A7: a `package.json` `"version"` és minden `src/` alatti,
verziót kiadó hely (pl. `/api/version`) kötelezően ugyanazt az értéket adja.
Ha a verzió később beégetett konstansra kerül, jelezd, hogy a szinkront
külön kell biztosítani.

### Határesetek a B2-B3 szabálynál

Értelmezd konzisztensen, hogy a jelentések futtatások között
összevethetők legyenek:

- **"Komment közvetlenül fölötte" = a kulcsszó (`if`/`for`/`try`/`function`)
  sora fölötti sorban, NEM a blokk belsejében.** Ha a magyarázat a
  `try {` / `catch {` blokk *belsejében* van, az szabálysértés; jelezd:
  "a komment a blokk belsejében van, nem fölötte".
- **Beágyazott control structure egy már kommentelt blokkon belül:** ha
  önálló, új elágazási logikát vezet be, saját kommentet igényel. Ha a külső
  blokk egyetlen, triviális tartalma, külön komment nélkül is elfogadható.
  Bizonytalan esetben jelezd "borderline"-ként, ne dobd el csendben.
- **`if`/`else if`/`else` lánc:** elég a láncot kezdő `if` fölött kommentet
  adni; az `else` ágakhoz csak akkor kell külön, ha az ág jelentősen új
  logikát tartalmaz.
- **Inline JSX-prop callback-ek** (pl. `onClick={() => doX()}`) és triviális
  `.map()`/`.filter()` lambda argumentumok NEM számítanak önálló
  function-nek; kivétel, ha a törzsük nem triviális, többsoros logikát
  (pl. `if`-ágat) tartalmaz.
- **Egysoros, magától értetődő komponensek és segédfüggvények** (pl. egy üres
  `Footer`) akkor is kommentet kapnak a szabály szerint; a jelentésben ezeket
  "alacsony súlyúként" különítsd el.
- **Next.js fájlok** (`page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`,
  `not-found.tsx`, `route.ts`): a default exportált komponens, illetve az
  exportált handler (`GET`, `POST` stb.) function-nek számít, kommentet
  igényel.
- **Típusok és interfészek** (`src/types`) nem function-ök, a B3 rájuk nem
  vonatkozik (a kommentjük az A6 szerint javaslat).
- **Konfigurációs fájlok** (`next.config.ts`, `eslint.config.mjs`): csak ha
  function-t vagy control structure-t tartalmaznak, akkor vonatkozik rájuk.
- Tesztkeretrendszer nincs; ha később bevezetésre kerül, ezt a szakaszt a
  `describe`/`it`/`test` blokkokra vonatkozó szabállyal ki kell egészíteni.

## Hogyan végezd az ellenőrzést

1. Mérd fel a méretet: `find src -type f` (kb. 20 fájl, a `placeholder.txt`
   fájlok nélkül kb. 15 kódfájl).
2. **A. rész:** célzott grep-ekkel (`any`, `"use client"`, `@/` vs `../`,
   beégetett verzió), a konfigurációs fájlok összevetésével és a
   `pnpm lint` futtatásával, majd a találatok kézi validálásával.
3. **B. rész:** az 1. szabályhoz grep, a 2-3. szabályhoz fájlonkénti
   olvasás (regex-szel nem megbízható). A projekt kicsi, ezért nincs szükség
   segéd-ügynökökre.
4. Ha a felhasználó szűk kört nevez meg (pl. csak `src/app/`), arra szűkítsd
   a hatókört, és ezt jelezd a jelentés fejlécében.

## Jelentés formátuma

MINDIG ezt a szerkezetet használd:

```
# Kódolási szabályok ellenőrzése — <célpont útvonala>

## Összefoglaló táblázat

### A. Projekt-konvenciók
| Terület | Állapot | Megjegyzés |
|---|---|---|
| Next.js sajátosságok | ... | ... |
| Mappák és rétegzés | ... | ... |
| TypeScript / lint | ... | ... |
| Környezet és titkok | ... | ... |
| Build-környezetek összhangja | ... | ... |
| Verzió-konzisztencia | ... | ... |

### B. Szigorú stíluszabályok
| Szabály | Állapot | Darabszám | Megjegyzés |
|---|---|---|---|
| Zárójelezés | ... | ... | ... |
| Komment (control structure) | ... | ... | ... |
| Komment (function) | ... | ... | ... |
| Verzió-szinkron | ... | ... | ... |

## Részletes hiányosságok
(Szabályonként fájl:sor hivatkozásokkal; ha nincs hiányosság:
"Nem található kivétel." A projekt kicsi, ezért a B. rész is teljes
fájl:sor listát kap, az alacsony súlyú találatok külön csoportban.)

## Javaslatok (opcionális)
(csak ha a felhasználó kéri; rövid, rangsorolt lista, javítás nélkül)
```

Sose módosíts kódot ennek a skillnek a futása közben, kizárólag a fenti
jelentést add vissza. Ha a felhasználó a jelentés alapján javítást kér, az
egy külön, explicit lépés.

import type huDictionary from "@/data/i18n/hu.json";

// Támogatott nyelvek; a magyar az alapértelmezett, URL-előtag nélkül (/, /termekek), a többi /en/…, /de/… alatt
export const LOCALES = ["hu", "en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "hu";

// A szótár szerkezete a magyar szótárból származik; az en/de szótáraknak ugyanezt kell követniük
export type Dictionary = typeof huDictionary;

// Háromnyelvű szöveg az adatfájlokban (products.json, faq.json)
export type LocalizedText = Record<Locale, string>;

// Számformátum nyelvenként (ezres tagolás)
export const NUMBER_LOCALES: Record<Locale, string> = { hu: "hu-HU", en: "en-GB", de: "de-DE" };

// Ellenőrzi, hogy a szöveg támogatott nyelvkód-e (pl. az URL [lang] szegmense)
export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

// Háromnyelvű adatmező ellenőrzése: mindhárom nyelven nem üres szöveg kell
export function isLocalizedText(value: unknown): value is LocalizedText {
  const text = value as LocalizedText;
  return (
    typeof text === "object" &&
    text !== null &&
    LOCALES.every((lang) => typeof text[lang] === "string" && text[lang] !== "")
  );
}

// Nyelvhez tartozó útvonal: a magyar előtag nélküli, a többi /en, /de előtagot kap; a #horgony megmarad
export function localePath(lang: Locale, path: string): string {
  // Magyarul az útvonal változatlan
  if (lang === DEFAULT_LOCALE) {
    return path;
  }
  // A főoldal és a főoldali horgonyok (pl. "/#gyik") esetén nem kell perjel az előtag után
  if (path === "/" || path.startsWith("/#")) {
    return `/${lang}${path.slice(1)}`;
  }
  return `/${lang}${path}`;
}

// Nyelvi előtag levágása az útvonalról (a nyelvváltó így ugyanarra az oldalra visz másik nyelven)
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  // Csak a nem alapértelmezett nyelvek kerülnek az URL-be előtagként
  if (first && hasLocale(first)) {
    return `/${rest.join("/")}`;
  }
  return pathname;
}

// Ár formázása a nyelv ezres tagolásával, forintban (pl. 24 900 Ft / 24,900 Ft / 24.900 Ft)
export function formatPrice(value: number, lang: Locale): string {
  return `${value.toLocaleString(NUMBER_LOCALES[lang])} Ft`;
}

// Dátum formázása a nyelv szerint; az SQLite „ÉÉÉÉ-HH-NN ÓÓ:PP:MM” (UTC) formátumát és az ISO formátumot is kezeli
export function formatDate(value: string, lang: Locale): string {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(NUMBER_LOCALES[lang]);
}

// Egyszerű sablonkitöltés a szótárszövegekben: "{qty} db" + { qty: 2 } → "2 db"
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

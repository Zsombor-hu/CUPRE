"use cache";

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/lib/i18n";
import { getCompanyInfo } from "@/services/company-service";
import { getFaqItems } from "@/services/faq-service";
import { getLegalDocument } from "@/services/legal-service";
import { paymentOptions } from "@/services/payment-service";
import {
  getCatalogVariants,
  getFeaturedProduct,
  getProductBySlug,
  getProductSlugs,
  getProducts,
} from "@/services/product-service";
import { shippingOptions } from "@/services/shipping-service";
import type { LegalDocumentKey } from "@/types/legal";

// Megjelenítő oldalak adatai időalapú gyorsítótárból: a JSON fájlok módosítása build nélkül,
// legfeljebb a CATALOG_LIFE ideje után megjelenik az oldalakon.
// A rendelési logika (árak, díjak, kapcsolók) NEM ezeket használja, hanem közvetlenül a fájlt olvassa.

// A termék/GYIK/cégadat JSON módosítása build nélkül ennyi időn belül jelenik meg (expire >= 5 perc, hogy az oldal előgenerálható maradjon)
const CATALOG_LIFE = { stale: 30, revalidate: 30, expire: 3600 };

// Közös cache-beállítás: profil + címke (a címkével később azonnali frissítés is kérhető)
function catalogCache() {
  cacheLife(CATALOG_LIFE);
  cacheTag("catalog");
}

// Termékek az adott nyelven
export async function getCachedProducts(lang: Locale) {
  catalogCache();
  return getProducts(lang);
}

// Termék slugok (generateStaticParams-hoz)
export async function getCachedProductSlugs() {
  catalogCache();
  return getProductSlugs();
}

// Egy termék slug alapján
export async function getCachedProductBySlug(slug: string, lang: Locale) {
  catalogCache();
  return getProductBySlug(slug, lang) ?? null;
}

// Kiemelt termék a főoldalra
export async function getCachedFeaturedProduct(lang: Locale) {
  catalogCache();
  return getFeaturedProduct(lang);
}

// Összes változat a kosárhoz
export async function getCachedCatalogVariants(lang: Locale) {
  catalogCache();
  return getCatalogVariants(lang);
}

// GYIK kérdések
export async function getCachedFaqItems(lang: Locale) {
  catalogCache();
  return getFaqItems(lang);
}

// Cégadatok és webshop-beállítások
export async function getCachedCompanyInfo() {
  catalogCache();
  return getCompanyInfo();
}

// Fizetési és szállítási módok a pénztárhoz
export async function getCachedCheckoutOptions() {
  catalogCache();
  return { shippingOptions: shippingOptions(), paymentOptions: paymentOptions() };
}

// Jogi dokumentum a cégadatokkal kitöltve
export async function getCachedLegalDocument(lang: Locale, key: LegalDocumentKey) {
  catalogCache();
  return getLegalDocument(lang, key);
}

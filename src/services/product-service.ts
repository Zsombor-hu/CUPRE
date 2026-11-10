import "server-only";
import type {
  CatalogVariant,
  EconomicOperator,
  Product,
  ProductData,
  ProductInfoData,
  ProductVariantData,
} from "@/types/product";
import { isLocalizedText as isLocalized, type Locale } from "@/lib/i18n";
import { readJsonData } from "@/services/data-paths";

// Egy változat szerkezeti ellenőrzése
function isVariant(value: unknown): value is ProductVariantData {
  const variant = value as ProductVariantData;
  return (
    typeof variant === "object" &&
    variant !== null &&
    typeof variant.sku === "string" &&
    typeof variant.size === "string" &&
    (variant.grade === "first" || variant.grade === "second") &&
    Number.isInteger(variant.priceHuf) &&
    variant.priceHuf > 0 &&
    isLocalized(variant.priceNote)
  );
}

// Gazdasági szereplő (gyártó, EU-s felelős) ellenőrzése
function isOperator(value: unknown): value is EconomicOperator {
  const operator = value as EconomicOperator;
  return typeof operator === "object" && operator !== null && typeof operator.name === "string" && typeof operator.address === "string";
}

// Kötelező termékadatok (összetétel, kezelés, gyártó, termékbiztonság) ellenőrzése
function isProductInfo(value: unknown): value is ProductInfoData {
  const info = value as ProductInfoData;
  return (
    typeof info === "object" &&
    info !== null &&
    isLocalized(info.composition) &&
    isLocalized(info.care) &&
    isOperator(info.manufacturer) &&
    (info.euResponsible === null || isOperator(info.euResponsible)) &&
    typeof info.productId === "string" &&
    isLocalized(info.safety)
  );
}

// Egy termék szerkezeti ellenőrzése (a változatokkal és a fordításokkal együtt)
function isProduct(value: unknown): value is ProductData {
  const product = value as ProductData;
  return (
    typeof product === "object" &&
    product !== null &&
    typeof product.slug === "string" &&
    typeof product.featured === "boolean" &&
    typeof product.image === "string" &&
    Number.isInteger(product.imageWidth) &&
    Number.isInteger(product.imageHeight) &&
    typeof product.tag === "string" &&
    isLocalized(product.name) &&
    isLocalized(product.subtitle) &&
    isLocalized(product.imageAlt) &&
    isLocalized(product.description) &&
    isLocalized(product.disclaimer) &&
    Array.isArray(product.points) &&
    product.points.every((point) => typeof point?.icon === "string" && isLocalized(point.label)) &&
    Array.isArray(product.variants) &&
    product.variants.length > 0 &&
    product.variants.every(isVariant) &&
    isProductInfo(product.productInfo)
  );
}

// Nyers termékadatok a környezet products.json fájljából; hibás szerkezet vagy ismétlődő slug/SKU esetén hibát dob
function getProductData(): ProductData[] {
  const data = readJsonData("products.json");
  // A fájlnak legalább egy érvényes, minden nyelven kitöltött terméket kell tartalmaznia
  if (!Array.isArray(data) || data.length === 0 || !data.every(isProduct)) {
    throw new Error("A products.json szerkezete hibás (vagy hiányzik egy fordítás).");
  }
  const slugs = new Set<string>();
  const skus = new Set<string>();
  // A slug és a cikkszám egyedi azonosító, ismétlődés adathiba
  for (const product of data) {
    // Ismétlődő slug két termékoldalt ütköztetne
    if (slugs.has(product.slug)) {
      throw new Error(`Duplikált termék slug: ${product.slug}`);
    }
    slugs.add(product.slug);
    // Ismétlődő SKU esetén a kosár és a rendelés nem tudná megkülönböztetni a változatokat
    for (const variant of product.variants) {
      // Egy cikkszám csak egyszer szerepelhet a teljes katalógusban
      if (skus.has(variant.sku)) {
        throw new Error(`Duplikált cikkszám: ${variant.sku}`);
      }
      skus.add(variant.sku);
    }
  }
  return data;
}

// Nyers termék feloldása egy nyelvre
function localizeProduct(product: ProductData, lang: Locale): Product {
  return {
    slug: product.slug,
    featured: product.featured,
    image: product.image,
    imageWidth: product.imageWidth,
    imageHeight: product.imageHeight,
    tag: product.tag,
    name: product.name[lang],
    subtitle: product.subtitle[lang],
    imageAlt: product.imageAlt[lang],
    description: product.description[lang],
    disclaimer: product.disclaimer[lang],
    points: product.points.map((point) => ({ icon: point.icon, label: point.label[lang] })),
    variants: product.variants.map((variant) => ({ ...variant, priceNote: variant.priceNote[lang] })),
    productInfo: {
      composition: product.productInfo.composition[lang],
      care: product.productInfo.care[lang],
      manufacturer: product.productInfo.manufacturer,
      euResponsible: product.productInfo.euResponsible,
      productId: product.productInfo.productId,
      safety: product.productInfo.safety[lang],
    },
  };
}

// Összes termék a megadott nyelven
export function getProducts(lang: Locale): Product[] {
  return getProductData().map((product) => localizeProduct(product, lang));
}

// Az összes termék slugja (a termékoldalak előgenerálásához)
export function getProductSlugs(): string[] {
  return getProductData().map((product) => product.slug);
}

// Termék slug alapján (termékoldalhoz); ismeretlen slug esetén undefined
export function getProductBySlug(slug: string, lang: Locale): Product | undefined {
  return getProducts(lang).find((product) => product.slug === slug);
}

// A főoldalon kiemelt termék; ha nincs megjelölve, az első termék
export function getFeaturedProduct(lang: Locale): Product {
  const products = getProducts(lang);
  return products.find((product) => product.featured) ?? products[0];
}

// A katalógus összes változata termékadatokkal kiegészítve (a kliensoldali kosár ezt kapja meg)
export function getCatalogVariants(lang: Locale): CatalogVariant[] {
  return getProducts(lang).flatMap((product) =>
    product.variants.map((variant) => ({
      ...variant,
      productSlug: product.slug,
      productName: product.name,
      image: product.image,
    })),
  );
}

// Változat keresése cikkszám alapján (a rendelés árszámításához)
export function findVariant(sku: string, lang: Locale): CatalogVariant | undefined {
  return getCatalogVariants(lang).find((variant) => variant.sku === sku);
}

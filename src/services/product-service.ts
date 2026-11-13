import "server-only";
import type {
  AdminProduct,
  CatalogVariant,
  EconomicOperator,
  Product,
  ProductData,
  ProductInfoData,
  ProductVariantData,
} from "@/types/product";
import { isLocalizedText as isLocalized, type Locale } from "@/lib/i18n";
import { readJsonData } from "@/services/data-paths";
import { getCustomerDb } from "@/services/customer-db";

// Változatonkénti admin felülírás (ár, aktív, készlet)
type VariantOverride = { priceHuf: number | null; active: boolean; stock: number | null };

// Termékenkénti admin felülírás (aktív, kiemelt)
type ProductOverride = { active: boolean; featured: boolean | null };

// Az admin felületen beállított felülírások az adatbázisból; ha az adatbázis nem érhető el (pl. build), nincs felülírás
function readOverrides(): { variants: Map<string, VariantOverride>; products: Map<string, ProductOverride> } {
  const variants = new Map<string, VariantOverride>();
  const products = new Map<string, ProductOverride>();
  // Az adatbázis hiánya nem akadályozhatja a katalógus megjelenítését
  try {
    const db = getCustomerDb();
    const variantRows = db.prepare("SELECT sku, price_huf AS priceHuf, active, stock FROM product_overrides").all() as {
      sku: string;
      priceHuf: number | null;
      active: number;
      stock: number | null;
    }[];
    // Cikkszámonként egy felülírás
    for (const row of variantRows) {
      variants.set(row.sku, {
        priceHuf: row.priceHuf === null ? null : Number(row.priceHuf),
        active: Number(row.active) === 1,
        stock: row.stock === null ? null : Number(row.stock),
      });
    }
    const productRows = db.prepare("SELECT slug, active, featured FROM product_settings").all() as {
      slug: string;
      active: number;
      featured: number | null;
    }[];
    // Slugonként egy felülírás
    for (const row of productRows) {
      products.set(row.slug, { active: Number(row.active) === 1, featured: row.featured === null ? null : Number(row.featured) === 1 });
    }
  } catch (error) {
    console.error("A termék-felülírások nem olvashatók, a products.json adatai érvényesek:", error);
  }
  return { variants, products };
}

// Változat a felülírások után (a soldOut a nyilvántartott készletből)
type MergedVariant = ProductVariantData & { soldOut: boolean };

// Termék a felülírások után
type MergedProduct = Omit<ProductData, "variants"> & { variants: MergedVariant[] };

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

// A vásárlók számára elérhető katalógus: az admin felülírásai (ár, kikapcsolás, kiemelés, készlet) a products.json adataira.
// A kikapcsolt termék és változat kimarad; ha emiatt egy termék sem maradna, a products.json adatai érvényesek.
function getActiveProductData(): MergedProduct[] {
  const data = getProductData();
  const overrides = readOverrides();
  const merged: MergedProduct[] = [];
  // Termékenként alkalmazzuk a felülírásokat
  for (const product of data) {
    const productOverride = overrides.products.get(product.slug);
    // Kikapcsolt termék
    if (productOverride && !productOverride.active) {
      continue;
    }
    const variants: MergedVariant[] = [];
    // Változatonként ár, aktív és készlet
    for (const variant of product.variants) {
      const override = overrides.variants.get(variant.sku);
      // Kikapcsolt változat
      if (override && !override.active) {
        continue;
      }
      variants.push({
        ...variant,
        priceHuf: override?.priceHuf ?? variant.priceHuf,
        soldOut: override?.stock !== null && override?.stock !== undefined && override.stock <= 0,
      });
    }
    // Változat nélkül a termék nem rendelhető
    if (variants.length === 0) {
      continue;
    }
    merged.push({ ...product, featured: productOverride?.featured ?? product.featured, variants });
  }
  // Biztonsági háló: üres katalógus helyett az eredeti adatok
  if (merged.length === 0) {
    return data.map((product) => ({ ...product, variants: product.variants.map((variant) => ({ ...variant, soldOut: false })) }));
  }
  return merged;
}

// Az admin terméklistája: minden termék és változat (a kikapcsoltak is) a felülírásokkal; a név az alapnyelven
export function getAdminProducts(): AdminProduct[] {
  const overrides = readOverrides();
  return getProductData().map((product) => {
    const productOverride = overrides.products.get(product.slug);
    return {
      slug: product.slug,
      name: product.name.hu,
      image: product.image,
      active: productOverride?.active ?? true,
      featured: productOverride?.featured ?? product.featured,
      variants: product.variants.map((variant) => {
        const override = overrides.variants.get(variant.sku);
        return {
          sku: variant.sku,
          size: variant.size,
          grade: variant.grade,
          basePriceHuf: variant.priceHuf,
          priceOverrideHuf: override?.priceHuf ?? null,
          priceHuf: override?.priceHuf ?? variant.priceHuf,
          active: override?.active ?? true,
          stock: override?.stock ?? null,
        };
      }),
    };
  });
}

// Nyers termék feloldása egy nyelvre
function localizeProduct(product: MergedProduct, lang: Locale): Product {
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

// Összes (bekapcsolt) termék a megadott nyelven
export function getProducts(lang: Locale): Product[] {
  return getActiveProductData().map((product) => localizeProduct(product, lang));
}

// Az összes bekapcsolt termék slugja (a termékoldalak előgenerálásához)
export function getProductSlugs(): string[] {
  return getActiveProductData().map((product) => product.slug);
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

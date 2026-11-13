import "server-only";
import { getCustomerDb, inTransaction } from "@/services/customer-db";
import { getAdminProducts } from "@/services/product-service";
import { record } from "@/lib/validation";
import type { AdminProduct, AdminVariant } from "@/types/product";

// Hibakódok (az admin szótár products.errors kulcsai)
export type ProductAdminError = "notFound" | "invalidPrice" | "invalidStock" | "lastActive";

// Legnagyobb beállítható ár és készlet (elírás elleni védelem)
const MAX_PRICE_HUF = 10_000_000;
const MAX_STOCK = 1_000_000;

// Érvényes-e a katalógus: legalább egy bekapcsolt termék legalább egy bekapcsolt változattal
function hasActiveProduct(products: AdminProduct[]): boolean {
  return products.some((product) => product.active && product.variants.some((variant) => variant.active));
}

// Változat módosítása: ár (null: a products.json ára), aktív, készlet (null: nincs nyilvántartás).
// A válasz a módosítás előtti és utáni állapot (a naplóhoz).
export function updateVariant(
  sku: string,
  body: unknown,
): { ok: true; before: AdminVariant; after: AdminVariant } | { ok: false; error: ProductAdminError } {
  const raw = record(body);
  const products = getAdminProducts();
  const variant = products.flatMap((product) => product.variants).find((candidate) => candidate.sku === sku);
  // Ismeretlen cikkszám
  if (!variant) {
    return { ok: false, error: "notFound" };
  }
  const priceOverride = raw.priceHuf === undefined ? variant.priceOverrideHuf : raw.priceHuf;
  // Az ár üres (alapár) vagy pozitív egész forint
  if (priceOverride !== null && (!Number.isInteger(priceOverride) || (priceOverride as number) <= 0 || (priceOverride as number) > MAX_PRICE_HUF)) {
    return { ok: false, error: "invalidPrice" };
  }
  const stock = raw.stock === undefined ? variant.stock : raw.stock;
  // A készlet üres (nincs nyilvántartás) vagy nemnegatív egész
  if (stock !== null && (!Number.isInteger(stock) || (stock as number) < 0 || (stock as number) > MAX_STOCK)) {
    return { ok: false, error: "invalidStock" };
  }
  const active = typeof raw.active === "boolean" ? raw.active : variant.active;
  const after: AdminVariant = {
    ...variant,
    priceOverrideHuf: priceOverride as number | null,
    priceHuf: (priceOverride as number | null) ?? variant.basePriceHuf,
    active,
    stock: stock as number | null,
  };
  const next = products.map((product) => ({
    ...product,
    variants: product.variants.map((candidate) => (candidate.sku === sku ? after : candidate)),
  }));
  // Az utolsó rendelhető változatot nem lehet kikapcsolni
  if (!hasActiveProduct(next)) {
    return { ok: false, error: "lastActive" };
  }
  getCustomerDb()
    .prepare(
      `INSERT INTO product_overrides (sku, price_huf, active, stock, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(sku) DO UPDATE SET price_huf = excluded.price_huf, active = excluded.active, stock = excluded.stock, updated_at = excluded.updated_at`,
    )
    .run(sku, after.priceOverrideHuf, active ? 1 : 0, after.stock);
  return { ok: true, before: variant, after };
}

// Termék módosítása: bekapcsolt, kiemelt (egyszerre egy termék lehet kiemelt)
export function updateProduct(
  slug: string,
  body: unknown,
): { ok: true; before: { active: boolean; featured: boolean }; after: { active: boolean; featured: boolean } } | { ok: false; error: ProductAdminError } {
  const raw = record(body);
  const products = getAdminProducts();
  const product = products.find((candidate) => candidate.slug === slug);
  // Ismeretlen termék
  if (!product) {
    return { ok: false, error: "notFound" };
  }
  const active = typeof raw.active === "boolean" ? raw.active : product.active;
  const featured = typeof raw.featured === "boolean" ? raw.featured : product.featured;
  const next = products.map((candidate) => (candidate.slug === slug ? { ...candidate, active } : candidate));
  // Az utolsó bekapcsolt terméket nem lehet kikapcsolni
  if (!hasActiveProduct(next)) {
    return { ok: false, error: "lastActive" };
  }
  inTransaction((db) => {
    const upsert = db.prepare(
      `INSERT INTO product_settings (slug, active, featured, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(slug) DO UPDATE SET active = excluded.active, featured = excluded.featured, updated_at = excluded.updated_at`,
    );
    // Kiemeléskor a többi termék kiemelése megszűnik
    if (featured && !product.featured) {
      // Minden más termék kiemelésének levétele
      for (const other of products) {
        // A módosított terméket alább mentjük
        if (other.slug !== slug) {
          upsert.run(other.slug, other.active ? 1 : 0, 0);
        }
      }
    }
    upsert.run(slug, active ? 1 : 0, featured ? 1 : 0);
  });
  return { ok: true, before: { active: product.active, featured: product.featured }, after: { active, featured } };
}

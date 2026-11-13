import { revalidateTag } from "next/cache";
import { getAdminProducts } from "@/services/product-service";
import { updateProduct, updateVariant } from "@/services/product-admin-service";
import { logAdminAction } from "@/services/audit-service";
import { noStoreJson, requireAdminName } from "@/services/admin-guard";
import { formError, readJson } from "@/services/api-helpers";

// Admin: termékek és változatok (ár, aktív, kiemelt, készlet)
export async function GET() {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  return noStoreJson({ products: getAdminProducts() });
}

// Admin: változat (?sku=…: priceHuf, active, stock) vagy termék (?slug=…: active, featured) módosítása
export async function PATCH(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku");
  const slug = url.searchParams.get("slug");
  const body = await readJson(request);
  // Változat módosítása
  if (sku) {
    const result = updateVariant(sku, body);
    // Hibás adat vagy ismeretlen cikkszám
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    logAdminAction(admin.name, "variant.update", "variant", sku, { before: result.before, after: result.after });
    revalidateTag("catalog", "max");
    return Response.json({ variant: result.after });
  }
  // Termék módosítása
  if (slug) {
    const result = updateProduct(slug, body);
    // Hibás adat vagy ismeretlen termék
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    logAdminAction(admin.name, "product.update", "product", slug, { before: result.before, after: result.after });
    revalidateTag("catalog", "max");
    return Response.json({ product: result.after });
  }
  return formError("invalidRequest");
}

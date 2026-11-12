import { adminPasswordConfigured, createAdminCaptcha } from "@/services/auth-service";
import { formError } from "@/services/api-helpers";

// Új captcha feladvány az admin belépéshez (összeadás, véletlen számokkal)
export async function GET() {
  // Beállított admin felhasználó nélkül nincs belépés
  if (!adminPasswordConfigured()) {
    return formError("unauthorized", 403);
  }
  return Response.json(createAdminCaptcha(), { headers: { "Cache-Control": "no-store" } });
}

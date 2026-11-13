import "server-only";
import { adminPasswordConfigured, currentAdminName } from "@/services/auth-service";
import { formError } from "@/services/api-helpers";

// A belépett admin neve, vagy hibaválasz: letiltott admin → 403, belépés (vagy név nélküli régi munkamenet) nélkül → 401
export async function requireAdminName(): Promise<{ name: string } | { denied: Response }> {
  // Beállított ADMIN_USER_1…5 nélkül az admin felület tiltott
  if (!adminPasswordConfigured()) {
    return { denied: formError("unauthorized", 403) };
  }
  const name = await currentAdminName();
  return name ? { name } : { denied: formError("unauthorized", 401) };
}

// Az ?id= paraméter számként (hiányzó vagy hibás érték: NaN)
export function idParam(request: Request): number {
  return Number(new URL(request.url).searchParams.get("id"));
}

// Gyorsítótár nélküli JSON válasz (admin adatok)
export function noStoreJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

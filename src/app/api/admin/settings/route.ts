import { adminPasswordConfigured, currentAdminName } from "@/services/auth-service";
import { getAdminSettings, saveAdminSettings } from "@/services/admin-settings-service";
import { formError, readJson } from "@/services/api-helpers";

// A belépett admin neve, vagy hibaválasz: letiltott admin → 403, belépés (vagy név nélküli régi munkamenet) nélkül → 401
async function requireAdminName(): Promise<{ name: string } | { denied: Response }> {
  // Beállított ADMIN_USER_1…5 nélkül az admin felület tiltott
  if (!adminPasswordConfigured()) {
    return { denied: formError("unauthorized", 403) };
  }
  const name = await currentAdminName();
  return name ? { name } : { denied: formError("unauthorized", 401) };
}

// Admin: a belépett felhasználó neve és beállításai (nyelv, lapméret, téma)
export async function GET() {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  return Response.json({ user: admin.name, settings: getAdminSettings(admin.name) }, { headers: { "Cache-Control": "no-store" } });
}

// Admin: beállítások mentése (részleges módosítás is lehet; az érvénytelen mezők változatlanok maradnak)
export async function PUT(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const body = await readJson(request);
  // Hibás törzs
  if (body === null) {
    return formError("invalidRequest", 400);
  }
  return Response.json({ user: admin.name, settings: saveAdminSettings(admin.name, body) });
}

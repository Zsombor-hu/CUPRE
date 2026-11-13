import { backupStatus, createBackup, readBackup } from "@/services/backup-service";
import { logAdminAction } from "@/services/audit-service";
import { noStoreJson, requireAdminName } from "@/services/admin-guard";
import { formError } from "@/services/api-helpers";

// Admin: a mentések állapota, vagy egy mentés letöltése (?file=…)
export async function GET(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const file = new URL(request.url).searchParams.get("file");
  // Letöltés
  if (file) {
    const data = readBackup(file);
    // Ismeretlen vagy érvénytelen fájlnév
    if (!data) {
      return formError("invalidRequest", 404);
    }
    logAdminAction(admin.name, "backup.download", "backup", file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${file}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return noStoreJson(backupStatus());
}

// Admin: azonnali mentés készítése
export async function POST() {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const backup = createBackup("manual");
  logAdminAction(admin.name, "backup.create", "backup", backup.name);
  return Response.json({ backup, status: backupStatus() }, { status: 201 });
}

import { listAudit } from "@/services/audit-service";
import { noStoreJson, requireAdminName } from "@/services/admin-guard";

// Admin: a napló bejegyzései (legújabb elöl; ?entity=…&entityId=… szűréssel)
export async function GET(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const url = new URL(request.url);
  const entityId = url.searchParams.get("entityId");
  return noStoreJson({ entries: listAudit({ entity: url.searchParams.get("entity") ?? undefined, entityId: entityId ?? undefined }) });
}

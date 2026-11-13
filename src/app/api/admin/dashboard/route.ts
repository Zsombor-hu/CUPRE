import { getDashboard } from "@/services/dashboard-service";
import { noStoreJson, requireAdminName } from "@/services/admin-guard";

// Admin: az áttekintő oldal adatai (bevétel, teendők, napi grafikon, toplista, alacsony készlet)
export async function GET() {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  return noStoreJson(getDashboard());
}

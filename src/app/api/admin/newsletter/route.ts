import { adminPasswordConfigured, isAdmin } from "@/services/auth-service";
import { logAdminAction } from "@/services/audit-service";
import { requireAdminName } from "@/services/admin-guard";
import { deleteSubscriber, listSubscribers, subscriberCounts } from "@/services/newsletter-service";
import { formError, okResponse } from "@/services/api-helpers";
import type { NewsletterStatus } from "@/types/account";

// Állapotszűrő a query-ből (ismeretlen érték → nincs szűrés)
function statusFilter(request: Request): NewsletterStatus | undefined {
  const value = new URL(request.url).searchParams.get("status");
  return value === "pending" || value === "active" || value === "unsubscribed" ? value : undefined;
}

// Admin: feliratkozók listája és darabszámai; belépés nélkül 401, letiltott adminnál 403
export async function GET(request: Request) {
  // Letiltott admin felület
  if (!adminPasswordConfigured()) {
    return formError("unauthorized", 403);
  }
  // Admin munkamenet nélkül nincs hozzáférés
  if (!(await isAdmin())) {
    return formError("unauthorized", 401);
  }
  return Response.json(
    { counts: subscriberCounts(), subscribers: listSubscribers(statusFilter(request)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Admin: feliratkozó végleges törlése (?id=…)
export async function DELETE(request: Request) {
  const admin = await requireAdminName();
  // Admin munkamenet nélkül nincs hozzáférés
  if ("denied" in admin) {
    return admin.denied;
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  // Érvénytelen vagy nem létező azonosító
  if (!Number.isInteger(id) || !deleteSubscriber(id)) {
    return formError("invalidRequest", 404);
  }
  // A naplóba személyes adat (e-mail) nem kerül, csak az azonosító
  logAdminAction(admin.name, "newsletter.delete", "newsletter", id);
  return okResponse();
}

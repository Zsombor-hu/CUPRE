import { adminPasswordConfigured, isAdmin } from "@/services/auth-service";
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
  // Admin munkamenet nélkül nincs hozzáférés
  if (!(await isAdmin())) {
    return formError("unauthorized", 401);
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  // Érvénytelen vagy nem létező azonosító
  if (!Number.isInteger(id) || !deleteSubscriber(id)) {
    return formError("invalidRequest", 404);
  }
  return okResponse();
}

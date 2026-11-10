import { adminPasswordConfigured, isAdmin } from "@/services/auth-service";
import {
  getOrderDetail,
  filterFromUrl,
  isOrderStatus,
  listOrders,
  markPaymentReceived,
  orderStatusCounts,
  updateOrderStatus,
} from "@/services/order-admin-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { record, text } from "@/lib/validation";

// Admin jogosultság: letiltott admin → 403, munkamenet nélkül → 401, egyébként null
async function requireAdmin(): Promise<Response | null> {
  // Beállított ADMIN_PASSWORD nélkül az admin felület tiltott
  if (!adminPasswordConfigured()) {
    return formError("unauthorized", 403);
  }
  return (await isAdmin()) ? null : formError("unauthorized", 401);
}

// Admin: rendelések listája (szűrővel, kereséssel) vagy egy rendelés részletei (?id=…)
export async function GET(request: Request) {
  const denied = await requireAdmin();
  // Nincs jogosultság
  if (denied) {
    return denied;
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  // Egy rendelés részletei
  if (id) {
    const detail = getOrderDetail(Number(id));
    return detail
      ? Response.json({ order: detail }, { headers: { "Cache-Control": "no-store" } })
      : formError("invalidRequest", 404);
  }
  return Response.json(
    { counts: orderStatusCounts(), orders: listOrders(filterFromUrl(url)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// Admin: rendelésállapot módosítása ({ status, note }) vagy a fizetés beérkezésének rögzítése ({ action: "markPaid" })
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  // Nincs jogosultság
  if (denied) {
    return denied;
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  const body = record(await readJson(request));
  // Fizetés beérkezésének rögzítése (átutalás / utánvét)
  if (body.action === "markPaid") {
    return markPaymentReceived(id) ? okResponse() : formError("invalidRequest", 409);
  }
  // Ismeretlen állapot
  if (!isOrderStatus(body.status)) {
    return formError("invalidRequest");
  }
  return updateOrderStatus(id, body.status, text(body.note, 300)) ? okResponse() : formError("invalidRequest", 404);
}

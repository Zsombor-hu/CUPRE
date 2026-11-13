import {
  getOrderDetail,
  filterFromUrl,
  isOrderStatus,
  listOrders,
  markPaymentReceived,
  orderStatusCounts,
  setInternalNote,
  setTrackingNumber,
  updateOrderStatus,
} from "@/services/order-admin-service";
import { invoiceConfig, issueInvoice, setInvoiceNumber } from "@/services/invoice-service";
import { logAdminAction } from "@/services/audit-service";
import { idParam, noStoreJson, requireAdminName } from "@/services/admin-guard";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { record, text } from "@/lib/validation";

// Admin: rendelések listája (szűrővel, kereséssel) vagy egy rendelés részletei (?id=…)
export async function GET(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  // Egy rendelés részletei (és hogy van-e beállított számlázó)
  if (id) {
    const detail = getOrderDetail(Number(id));
    return detail ? noStoreJson({ order: detail, invoicing: invoiceConfig() !== null }) : formError("invalidRequest", 404);
  }
  return noStoreJson({ counts: orderStatusCounts(), orders: listOrders(filterFromUrl(url)) });
}

// Admin: rendelés módosítása. Műveletek ({ action }):
// - status (alapértelmezés): { status, note, tracking } – állapotváltás, feladáskor csomagkövetési számmal
// - markPaid: átutalás / utánvét beérkezésének rögzítése
// - tracking: { tracking } – csomagkövetési szám mentése
// - internalNote: { note } – belső megjegyzés
// - issueInvoice: számla kiállítása a Számlázz.hu-val
// - setInvoice: { invoiceNumber } – máshol kiállított számla számának rögzítése (üres: törlés)
export async function PATCH(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const id = idParam(request);
  // Hibás azonosító
  if (!Number.isInteger(id)) {
    return formError("invalidRequest");
  }
  const body = record(await readJson(request));
  const action = typeof body.action === "string" ? body.action : "status";

  // Fizetés beérkezésének rögzítése (átutalás / utánvét)
  if (action === "markPaid") {
    // Csak függő átutalásos/utánvétes rendelésnél
    if (!markPaymentReceived(id)) {
      return formError("invalidRequest", 409);
    }
    logAdminAction(admin.name, "order.markPaid", "order", id);
    return okResponse();
  }
  // Csomagkövetési szám
  if (action === "tracking") {
    const tracking = text(body.tracking, 100);
    // Ismeretlen rendelés
    if (!setTrackingNumber(id, tracking)) {
      return formError("invalidRequest", 404);
    }
    logAdminAction(admin.name, "order.tracking", "order", id, { tracking });
    return okResponse();
  }
  // Belső megjegyzés
  if (action === "internalNote") {
    const note = text(body.note, 2000);
    // Ismeretlen rendelés
    if (!setInternalNote(id, note)) {
      return formError("invalidRequest", 404);
    }
    logAdminAction(admin.name, "order.internalNote", "order", id, { length: note.length });
    return okResponse();
  }
  // Számla kiállítása
  if (action === "issueInvoice") {
    const result = await issueInvoice(id);
    // Hiba: a kód és a szolgáltató üzenete a felületnek
    if (!result.ok) {
      return Response.json({ error: result.error, message: result.message ?? null }, { status: 400 });
    }
    logAdminAction(admin.name, "order.invoice", "order", id, { invoiceNumber: result.invoiceNumber, issued: true });
    return Response.json({ invoiceNumber: result.invoiceNumber });
  }
  // Számlaszám kézi rögzítése
  if (action === "setInvoice") {
    const result = setInvoiceNumber(id, body.invoiceNumber);
    // Hibás szám vagy ismeretlen rendelés
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    logAdminAction(admin.name, "order.invoice", "order", id, { invoiceNumber: result.invoiceNumber, issued: false });
    return Response.json({ invoiceNumber: result.invoiceNumber });
  }
  // Állapotváltás: ismeretlen állapot
  if (!isOrderStatus(body.status)) {
    return formError("invalidRequest");
  }
  const note = text(body.note, 300);
  const tracking = typeof body.tracking === "string" ? body.tracking : null;
  const result = updateOrderStatus(id, body.status, note, admin.name, tracking);
  // Ismeretlen rendelés
  if (!result) {
    return formError("invalidRequest", 404);
  }
  // Csak tényleges változást naplózunk
  if (result.previous !== body.status) {
    logAdminAction(admin.name, "order.status", "order", id, { from: result.previous, to: body.status, note });
  }
  return okResponse();
}

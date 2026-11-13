import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from "@/services/coupon-service";
import { logAdminAction } from "@/services/audit-service";
import { idParam, noStoreJson, requireAdminName } from "@/services/admin-guard";
import { formError, okResponse, readJson } from "@/services/api-helpers";

// Egy kupon a listából azonosító alapján (a naplóhoz)
function findCoupon(id: number) {
  return listCoupons().find((coupon) => coupon.id === id) ?? null;
}

// Admin: kuponok listája
export async function GET() {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  return noStoreJson({ coupons: listCoupons() });
}

// Admin: új kupon (kód, összeg, érvényesség tól–ig, aktív, megjegyzés)
export async function POST(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const result = createCoupon(await readJson(request));
  // Hibás adatok vagy foglalt kód: a hibakódot az admin felület fordítja le
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  logAdminAction(admin.name, "coupon.create", "coupon", result.coupon.id, { coupon: result.coupon });
  return Response.json({ coupon: result.coupon }, { status: 201 });
}

// Admin: kupon módosítása (?id=…)
export async function PATCH(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const id = idParam(request);
  const before = findCoupon(id);
  const result = updateCoupon(id, await readJson(request));
  // Hibás adatok vagy ismeretlen kupon
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  logAdminAction(admin.name, "coupon.update", "coupon", id, { before, after: findCoupon(id) });
  return okResponse();
}

// Admin: kupon törlése (?id=…)
export async function DELETE(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const id = idParam(request);
  const before = findCoupon(id);
  // Ismeretlen kupon
  if (!deleteCoupon(id)) {
    return formError("invalidRequest", 404);
  }
  logAdminAction(admin.name, "coupon.delete", "coupon", id, { coupon: before });
  return okResponse();
}

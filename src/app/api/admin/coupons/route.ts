import { adminPasswordConfigured, isAdmin } from "@/services/auth-service";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon } from "@/services/coupon-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";

// Admin jogosultság ellenőrzése: letiltott admin → 403, munkamenet nélkül → 401, egyébként null
async function requireAdmin(): Promise<Response | null> {
  // Beállított ADMIN_USER_1…5 nélkül az admin felület tiltott
  if (!adminPasswordConfigured()) {
    return formError("unauthorized", 403);
  }
  return (await isAdmin()) ? null : formError("unauthorized", 401);
}

// Az ?id= paraméter
function idParam(request: Request): number {
  return Number(new URL(request.url).searchParams.get("id"));
}

// Admin: kuponok listája
export async function GET() {
  const denied = await requireAdmin();
  // Nincs jogosultság
  if (denied) {
    return denied;
  }
  return Response.json({ coupons: listCoupons() }, { headers: { "Cache-Control": "no-store" } });
}

// Admin: új kupon (kód, összeg, érvényesség tól–ig, aktív, megjegyzés)
export async function POST(request: Request) {
  const denied = await requireAdmin();
  // Nincs jogosultság
  if (denied) {
    return denied;
  }
  const result = createCoupon(await readJson(request));
  // Hibás adatok vagy foglalt kód: a hibaüzenetet az admin felület mutatja
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ coupon: result.coupon }, { status: 201 });
}

// Admin: kupon módosítása (?id=…)
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  // Nincs jogosultság
  if (denied) {
    return denied;
  }
  const result = updateCoupon(idParam(request), await readJson(request));
  // Hibás adatok vagy ismeretlen kupon
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return okResponse();
}

// Admin: kupon törlése (?id=…)
export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  // Nincs jogosultság
  if (denied) {
    return denied;
  }
  // Ismeretlen kupon
  if (!deleteCoupon(idParam(request))) {
    return formError("invalidRequest", 404);
  }
  return okResponse();
}

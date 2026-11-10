import { validateCoupon } from "@/services/coupon-service";
import { formError, readJson } from "@/services/api-helpers";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";
import { record } from "@/lib/validation";
import type { CouponCheckResponse } from "@/types/coupon";

// Kupon ellenőrzése a pénztárban (a rendeléskor a szerver újra ellenőrzi); a kódtalálgatás forrásonként korlátozott
export async function POST(request: Request) {
  // Kódpróbálgatás lassítása
  if (!hitRateLimit(`coupon:${clientKey(request)}`, 20)) {
    return formError("tooManyAttempts", 429);
  }
  const body = await readJson(request);
  const result = validateCoupon(record(body).code);
  // Érvénytelen, lejárt vagy még nem érvényes kupon
  if (!result.ok) {
    return Response.json({ errors: { coupon: result.error } }, { status: 400 });
  }
  return Response.json({ code: result.coupon.code, amountHuf: result.coupon.amountHuf } satisfies CouponCheckResponse);
}

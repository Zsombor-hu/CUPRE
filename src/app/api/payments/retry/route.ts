import { startCardPayment } from "@/services/payment-service";
import { formError, readJson } from "@/services/api-helpers";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";
import { record, text } from "@/lib/validation";

// Sikertelen vagy megszakított kártyás fizetés újraindítása ugyanarra a rendelésre (a rendelés tokenjével)
export async function POST(request: Request) {
  // Fizetésindítások korlátozása forrásonként
  if (!hitRateLimit(`payment-retry:${clientKey(request)}`, 10)) {
    return formError("tooManyAttempts", 429);
  }
  const body = record(await readJson(request));
  // A fizetőoldal címe, vagy hiba, ha a rendeléshez nem indítható fizetés
  try {
    const redirectUrl = await startCardPayment(Number(body.order), text(body.token, 100));
    return Response.json({ redirectUrl });
  } catch (error) {
    console.error("Kártyás fizetés újraindítása sikertelen:", error);
    return formError("invalidRequest", 409);
  }
}

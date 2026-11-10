import { requestPasswordReset } from "@/services/account-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";

// Jelszó-visszaállító link kérése; a válasz mindig ugyanaz, így nem derül ki, létezik-e fiók az e-mail címhez
export async function POST(request: Request) {
  // Levélküldéssel járó végpont: forrásonként korlátozott
  if (!hitRateLimit(`reset:${clientKey(request)}`)) {
    return formError("tooManyAttempts", 429);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  requestPasswordReset(body);
  return okResponse();
}

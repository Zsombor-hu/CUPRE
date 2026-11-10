import { login } from "@/services/account-service";
import { signInCustomer } from "@/services/auth-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";
import { clearRateLimit, clientKey, hitRateLimit } from "@/lib/rate-limit";
import { normalizeEmail, record } from "@/lib/validation";

// Belépés e-mail + jelszó párossal; forrásonként és e-mail címenként korlátozott próbálkozással
export async function POST(request: Request) {
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const limitKey = `login:${clientKey(request)}:${normalizeEmail(record(body).email)}`;
  // Túl sok sikertelen próbálkozás
  if (!hitRateLimit(limitKey)) {
    return formError("tooManyAttempts", 429);
  }
  const result = login(body);
  // Hibás e-mail vagy jelszó (nem áruljuk el, melyik)
  if (!result.ok) {
    return errorResponse(result.errors, 401);
  }
  clearRateLimit(limitKey);
  await signInCustomer(result.value);
  return okResponse();
}

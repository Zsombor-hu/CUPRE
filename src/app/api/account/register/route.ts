import { register } from "@/services/account-service";
import { signInCustomer } from "@/services/auth-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";

// Regisztráció vásárlás nélkül: sikeres regisztráció után az ügyfél azonnal be is lép
export async function POST(request: Request) {
  // Tömeges regisztráció lassítása forrásonként
  if (!hitRateLimit(`register:${clientKey(request)}`, 10, 60 * 60 * 1000)) {
    return formError("tooManyAttempts", 429);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const result = register(body);
  // Validációs hiba vagy foglalt e-mail cím
  if (!result.ok) {
    return errorResponse(result.errors);
  }
  await signInCustomer(result.value);
  return okResponse();
}

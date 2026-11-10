import { adminPasswordConfigured, signInAdmin } from "@/services/auth-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { clearRateLimit, clientKey, hitRateLimit } from "@/lib/rate-limit";
import { password, record } from "@/lib/validation";

// Admin belépés az ADMIN_PASSWORD környezeti változóban megadott jelszóval
export async function POST(request: Request) {
  // Beállított jelszó nélkül az admin felület le van tiltva
  if (!adminPasswordConfigured()) {
    return formError("unauthorized", 403);
  }
  const limitKey = `admin:${clientKey(request)}`;
  // Jelszópróbálgatás lassítása
  if (!hitRateLimit(limitKey)) {
    return formError("tooManyAttempts", 429);
  }
  const body = await readJson(request);
  // Hibás jelszó vagy hibás törzs
  if (body === null || !(await signInAdmin(password(record(body).password)))) {
    return formError("invalidCredentials", 401);
  }
  clearRateLimit(limitKey);
  return okResponse();
}

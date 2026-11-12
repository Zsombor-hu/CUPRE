import { adminPasswordConfigured, signInAdmin, verifyAdminCaptcha } from "@/services/auth-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { clearRateLimit, clientKey, hitRateLimit } from "@/lib/rate-limit";
import { password, record, text } from "@/lib/validation";

// Admin belépés: felhasználónév, jelszó és a captcha (összeadás) helyes megoldása; a felhasználók az ADMIN_USER_1…5 változókban vannak
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
  // Hibás törzs
  if (body === null) {
    return formError("invalidCredentials", 401);
  }
  const fields = record(body);
  // Rossz vagy lejárt captcha: a jelszót nem is vizsgáljuk
  if (!verifyAdminCaptcha(text(fields.captchaToken, 200), text(fields.captchaAnswer, 10))) {
    return formError("invalidCaptcha", 400);
  }
  // Hibás felhasználónév vagy jelszó
  if (!(await signInAdmin(text(fields.username, 100), password(fields.password)))) {
    return formError("invalidCredentials", 401);
  }
  clearRateLimit(limitKey);
  return okResponse();
}

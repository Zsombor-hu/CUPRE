import { resetPassword } from "@/services/account-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";

// Új jelszó beállítása a levélben kapott tokennel (utána újra be kell lépni)
export async function POST(request: Request) {
  // Token-próbálgatás lassítása
  if (!hitRateLimit(`reset-confirm:${clientKey(request)}`, 10)) {
    return formError("tooManyAttempts", 429);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const result = resetPassword(body);
  // Érvénytelen token vagy gyenge jelszó
  if (!result.ok) {
    return errorResponse(result.errors);
  }
  return okResponse();
}

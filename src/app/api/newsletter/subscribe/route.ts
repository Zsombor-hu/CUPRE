import { subscribe } from "@/services/newsletter-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";
import { clientKey, hitRateLimit } from "@/lib/rate-limit";
import { DEFAULT_LOCALE, hasLocale } from "@/lib/i18n";
import { isValidEmail, normalizeEmail, record, text } from "@/lib/validation";
import type { AccountErrorCode } from "@/types/account";

// Hírlevél-feliratkozás vásárlás és fiók nélkül: kifejezett hozzájárulás kell, utána megerősítő levél megy ki
export async function POST(request: Request) {
  // Levélküldéssel járó végpont: forrásonként korlátozott
  if (!hitRateLimit(`newsletter:${clientKey(request)}`, 10)) {
    return formError("tooManyAttempts", 429);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const raw = record(body);
  const email = normalizeEmail(raw.email);
  const lang = text(raw.lang, 5);
  const errors: Record<string, AccountErrorCode> = {};
  // Kötelező, formailag érvényes e-mail cím
  if (!email) {
    errors.email = "required";
  } else if (!isValidEmail(email)) {
    errors.email = "invalidEmail";
  }
  // A hírlevélhez kifejezett hozzájárulás kell (GDPR 6. cikk (1) a))
  if (raw.consent !== true) {
    errors.consent = "consentRequired";
  }
  // Hibák esetén nem mentünk és nem küldünk levelet
  if (Object.keys(errors).length > 0) {
    return errorResponse(errors);
  }
  subscribe({ email, name: text(raw.name), lang: hasLocale(lang) ? lang : DEFAULT_LOCALE, source: "form" });
  return okResponse();
}

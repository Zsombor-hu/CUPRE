// Egyszerű e-mail formátum ellenőrzés (a cím valódiságát a megerősítő levél igazolja)
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Jelszó minimális hossza
export const MIN_PASSWORD_LENGTH = 8;

// Ismeretlen értékből szöveg kinyerése, levágott szóközökkel és hosszkorláttal
export function text(value: unknown, maxLength = 200): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// E-mail cím normalizálása (kisbetűs, levágott) – az adatbázisban így tároljuk
export function normalizeEmail(value: unknown): string {
  return text(value, 254).toLowerCase();
}

// Formailag érvényes-e az e-mail cím
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

// Jelszó beolvasása: nem vágjuk le a szóközöket (a jelszó része lehet), csak a hosszt korlátozzuk
export function password(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 200) : "";
}

// Ismeretlen kérés törzséből objektum (vagy üres objektum)
export function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

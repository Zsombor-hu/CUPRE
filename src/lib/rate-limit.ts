// Egyszerű, folyamaton belüli próbálkozás-korlát (belépés, jelszó-emlékeztető, feliratkozás ellen irányuló
// tömeges kísérletek lassítására). Több szerverpéldány esetén közös tárra (pl. Redis) kell cserélni.

type Bucket = { count: number; resetAt: number };

const globalForLimits = globalThis as typeof globalThis & { cupreRateLimits?: Map<string, Bucket> };
const buckets = (globalForLimits.cupreRateLimits ??= new Map<string, Bucket>());

// Igaz, ha a kulcshoz tartozó kísérlet még belefér a korlátba; minden hívás egy kísérletnek számít
export function hitRateLimit(key: string, limit = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  // Lejárt vagy új ablak: újrakezdjük a számlálást
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

// Sikeres művelet után a számláló törlése (pl. sikeres belépés)
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

// A kérés forrásának azonosítása a korláthoz (proxy mögött az X-Forwarded-For első eleme)
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : (request.headers.get("x-real-ip") ?? "local");
}

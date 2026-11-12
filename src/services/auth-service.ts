import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getCustomerDb } from "@/services/customer-db";

// Süti nevek: vásárlói és admin munkamenet
export const SESSION_COOKIE = "cupre_session";
export const ADMIN_COOKIE = "cupre_admin";

// Munkamenetek élettartama
const CUSTOMER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

// scrypt paraméterek (Node alapértelmezés: N=16384, r=8, p=1) és a kulcs hossza
const KEY_LENGTH = 64;

// Jelszó hash-elése véletlen sóval; formátum: scrypt$<só>$<hash> (base64url)
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

// Jelszó ellenőrzése állandó idejű összehasonlítással
export function verifyPassword(plain: string, stored: string): boolean {
  const [scheme, saltText, hashText] = stored.split("$");
  // Ismeretlen formátumú hash-t nem fogadunk el
  if (scheme !== "scrypt" || !saltText || !hashText) {
    return false;
  }
  const expected = Buffer.from(hashText, "base64url");
  const actual = scryptSync(plain, Buffer.from(saltText, "base64url"), expected.length);
  return timingSafeEqual(expected, actual);
}

// Nem létező fióknál is lefuttatjuk az ellenőrzést, hogy a válaszidő ne árulja el, létezik-e az e-mail cím
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));
export function verifyAgainstDummy(plain: string): void {
  verifyPassword(plain, DUMMY_HASH);
}

// Véletlen, URL-biztos token (süti, jelszó-visszaállító és hírlevél link)
export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

// Token hash-e: az adatbázisba csak ez kerül, így egy adatbázis-szivárgásból nem lehet munkamenetet átvenni
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Biztonságos (csak HTTPS-en küldött) süti, ha a nyilvános cím https
function secureCookies(): boolean {
  return (process.env.SITE_URL ?? "").startsWith("https://");
}

// Munkamenet létrehozása és a süti beállítása
async function startSession(kind: "customer" | "admin", accountId: number | null): Promise<void> {
  const token = createToken();
  const ttl = kind === "customer" ? CUSTOMER_SESSION_MS : ADMIN_SESSION_MS;
  getCustomerDb()
    .prepare("INSERT INTO sessions (token_hash, kind, account_id, expires_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), kind, accountId, new Date(Date.now() + ttl).toISOString());
  const store = await cookies();
  store.set(kind === "customer" ? SESSION_COOKIE : ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: Math.floor(ttl / 1000),
  });
}

// Érvényes munkamenet sora a süti alapján (lejárt munkamenetet töröl)
async function readSession(kind: "customer" | "admin"): Promise<{ id: number; account_id: number | null } | null> {
  const store = await cookies();
  const token = store.get(kind === "customer" ? SESSION_COOKIE : ADMIN_COOKIE)?.value;
  // Süti nélkül nincs munkamenet
  if (!token) {
    return null;
  }
  const db = getCustomerDb();
  const row = db
    .prepare("SELECT id, account_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?")
    .get(hashToken(token), kind) as { id: number; account_id: number | null; expires_at: string } | undefined;
  // Ismeretlen token
  if (!row) {
    return null;
  }
  // Lejárt munkamenet: töröljük
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }
  return row;
}

// Munkamenet és süti törlése
async function endSession(kind: "customer" | "admin"): Promise<void> {
  const store = await cookies();
  const name = kind === "customer" ? SESSION_COOKIE : ADMIN_COOKIE;
  const token = store.get(name)?.value;
  // Csak létező tokent kell az adatbázisból törölni
  if (token) {
    getCustomerDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }
  store.delete(name);
}

// Vásárlói belépés: új munkamenet a fiókhoz
export async function signInCustomer(accountId: number): Promise<void> {
  await startSession("customer", accountId);
}

// Vásárlói kilépés
export async function signOutCustomer(): Promise<void> {
  await endSession("customer");
}

// A belépett vásárló fiókazonosítója, vagy null
export async function currentAccountId(): Promise<number | null> {
  const session = await readSession("customer");
  return session?.account_id ?? null;
}

// Az adott fiók összes munkamenetének törlése (jelszócsere, jelszó-visszaállítás után)
export function revokeAccountSessions(accountId: number): void {
  getCustomerDb().prepare("DELETE FROM sessions WHERE kind = 'customer' AND account_id = ?").run(accountId);
}

// Legfeljebb ennyi admin felhasználó léphet be (ADMIN_USER_1 … ADMIN_USER_5)
export const MAX_ADMIN_USERS = 5;

// Admin jelszó minimális hossza
const MIN_ADMIN_PASSWORD_LENGTH = 12;

// Admin felhasználó: név és jelszó
type AdminUser = { name: string; password: string };

// Az admin felhasználók a környezeti változókból: ADMIN_USER_1="név:jelszó" … ADMIN_USER_5; a jelszó legalább 12 karakter
function adminUsers(): AdminUser[] {
  const users: AdminUser[] = [];
  // Az öt lehetséges hely végigolvasása
  for (let index = 1; index <= MAX_ADMIN_USERS; index += 1) {
    const raw = process.env[`ADMIN_USER_${index}`] ?? "";
    const separator = raw.indexOf(":");
    const name = separator > 0 ? raw.slice(0, separator).trim() : "";
    const password = separator > 0 ? raw.slice(separator + 1) : "";
    // Csak teljes, elég hosszú jelszóval megadott felhasználót fogadunk el
    if (name && password.length >= MIN_ADMIN_PASSWORD_LENGTH) {
      users.push({ name, password });
    }
  }
  return users;
}

// Be van-e állítva legalább egy admin felhasználó; nélkülük az admin felület le van tiltva
export function adminPasswordConfigured(): boolean {
  return adminUsers().length > 0;
}

// Állandó idejű szövegegyezés (hash-eken keresztül, hogy a hossz se szivárogjon)
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

// Captcha aláírásához használt titok: az admin hitelesítő adatokból származik, így nem kell külön beállítani
function captchaSecret(): string {
  const material = adminUsers()
    .map((user) => `${user.name}:${user.password}`)
    .join("|");
  return createHash("sha256").update(`cupre-admin-captcha|${material}`).digest("hex");
}

// Captcha érvényessége
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

// Már felhasznált captcha azonosítók (egyszeri használat), lejáratukig megőrizve
const globalForCaptcha = globalThis as typeof globalThis & { cupreUsedCaptchas?: Map<string, number> };
const usedCaptchas = (globalForCaptcha.cupreUsedCaptchas ??= new Map<string, number>());

// Aláírás a feladvány megoldására: HMAC(titok, azonosító|lejárat|eredmény)
function captchaSignature(id: string, expires: number, answer: number): string {
  return createHmac("sha256", captchaSecret()).update(`${id}|${expires}|${answer}`).digest("base64url");
}

// Új összeadós feladvány: a kérdés két véletlen szám összege; a token a megoldást csak aláírva tartalmazza
export function createAdminCaptcha(): { question: string; token: string } {
  const a = randomInt(2, 20);
  const b = randomInt(2, 20);
  const id = randomBytes(8).toString("base64url");
  const expires = Date.now() + CAPTCHA_TTL_MS;
  return { question: `${a} + ${b}`, token: `${id}.${expires}.${captchaSignature(id, expires, a + b)}` };
}

// Captcha ellenőrzése: érvényes aláírás, nem járt le, helyes a válasz, és még nem használták fel
export function verifyAdminCaptcha(token: string, answer: string): boolean {
  const [id, expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  const value = Number(answer.trim());
  // Hibás formátumú token vagy válasz
  if (!id || !signature || !Number.isInteger(expires) || !Number.isInteger(value)) {
    return false;
  }
  const now = Date.now();
  // Lejárt azonosítók takarítása, hogy a tár ne nőjön korlátlanul
  for (const [usedId, usedExpires] of usedCaptchas) {
    if (usedExpires <= now) {
      usedCaptchas.delete(usedId);
    }
  }
  // Lejárt vagy már felhasznált feladvány
  if (expires <= now || usedCaptchas.has(id)) {
    return false;
  }
  // A feladványt sikeres és sikertelen próbálkozás után is eldobjuk
  usedCaptchas.set(id, expires);
  return safeEqual(signature, captchaSignature(id, expires, value));
}

// Admin belépés: felhasználónév + jelszó; minden felhasználót végigellenőrzünk, hogy a válaszidő ne áruljon el semmit
export async function signInAdmin(name: string, plain: string): Promise<boolean> {
  let matched = false;
  // Mindkét adatot állandó idejű összehasonlítással vetjük össze
  for (const user of adminUsers()) {
    const nameOk = safeEqual(user.name.toLowerCase(), name.trim().toLowerCase());
    const passwordOk = safeEqual(user.password, plain);
    matched = (nameOk && passwordOk) || matched;
  }
  // Hibás adatoknál nem jön létre munkamenet
  if (!matched) {
    return false;
  }
  await startSession("admin", null);
  return true;
}

// Admin kilépés
export async function signOutAdmin(): Promise<void> {
  await endSession("admin");
}

// Van-e érvényes admin munkamenet
export async function isAdmin(): Promise<boolean> {
  return adminPasswordConfigured() && (await readSession("admin")) !== null;
}

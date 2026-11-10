import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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

// Admin jelszó a környezeti változóból; ha nincs beállítva, az admin felület le van tiltva
export function adminPasswordConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD ?? "").length >= 12;
}

// Admin belépés: a megadott jelszót állandó idejű összehasonlítással ellenőrizzük
export async function signInAdmin(plain: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  // Beállított jelszó nélkül nincs admin belépés
  if (!adminPasswordConfigured()) {
    return false;
  }
  const a = createHash("sha256").update(plain).digest();
  const b = createHash("sha256").update(expected).digest();
  // Hibás jelszónál nem jön létre munkamenet
  if (!timingSafeEqual(a, b)) {
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

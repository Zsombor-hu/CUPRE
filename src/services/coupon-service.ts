import "server-only";
import { getCustomerDb } from "@/services/customer-db";
import { record, text } from "@/lib/validation";
import type { Coupon, CouponErrorCode } from "@/types/coupon";

// Kuponkód normalizálása: nagybetűs, csak betű, szám és kötőjel, legfeljebb 32 karakter
export function normalizeCouponCode(value: unknown): string {
  return text(value, 64)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

// Mai dátum (ÉÉÉÉ-HH-NN) budapesti idő szerint – az érvényesség napra pontos, a kezdő és a záró nap is beleszámít
function todayInBudapest(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(now);
}

// Adatbázis-sor → kupon
type CouponRow = {
  id: number;
  code: string;
  amount_huf: number;
  valid_from: string | null;
  valid_until: string | null;
  active: number;
  note: string;
  used_count: number;
  created_at: string;
};

// Sor átalakítása a kliens felé küldött formára
function toCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    code: row.code,
    amountHuf: row.amount_huf,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    active: row.active === 1,
    note: row.note,
    usedCount: row.used_count,
    createdAt: row.created_at,
  };
}

// Kupon ellenőrzése beváltáskor: létezik, aktív, és a mai nap az érvényességi időn belül van
export function validateCoupon(code: unknown, now: Date = new Date()): { ok: true; coupon: Coupon } | { ok: false; error: CouponErrorCode } {
  const normalized = normalizeCouponCode(code);
  // Üres kód
  if (!normalized) {
    return { ok: false, error: "couponInvalid" };
  }
  const row = getCustomerDb().prepare("SELECT * FROM coupons WHERE code = ?").get(normalized) as CouponRow | undefined;
  // Ismeretlen vagy kikapcsolt kupon (kifelé ugyanaz az üzenet)
  if (!row || row.active !== 1) {
    return { ok: false, error: "couponInvalid" };
  }
  const today = todayInBudapest(now);
  // Még nem érvényes
  if (row.valid_from && today < row.valid_from) {
    return { ok: false, error: "couponNotYetValid" };
  }
  // Lejárt
  if (row.valid_until && today > row.valid_until) {
    return { ok: false, error: "couponExpired" };
  }
  return { ok: true, coupon: toCoupon(row) };
}

// Admin: összes kupon, a legújabb elöl
export function listCoupons(): Coupon[] {
  return (getCustomerDb().prepare("SELECT * FROM coupons ORDER BY id DESC").all() as CouponRow[]).map(toCoupon);
}

// Dátum (ÉÉÉÉ-HH-NN) vagy üres → null; érvénytelen formátumnál undefined
function readDate(value: unknown): string | null | undefined {
  const raw = text(value, 10);
  // Üres mező: nincs korlát
  if (!raw) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : undefined;
}

// Admin: kupon adatainak beolvasása és ellenőrzése (létrehozás és módosítás közösen); hiba esetén nyelvfüggetlen hibakódot ad, amit az admin felület fordít
function readCouponInput(
  body: unknown,
): { ok: true; value: { code: string; amountHuf: number; validFrom: string | null; validUntil: string | null; active: boolean; note: string } } | { ok: false; error: string } {
  const raw = record(body);
  const code = normalizeCouponCode(raw.code);
  const amountHuf = Number(raw.amountHuf);
  const validFrom = readDate(raw.validFrom);
  const validUntil = readDate(raw.validUntil);
  // Kötelező, legalább 3 karakteres kód
  if (code.length < 3) {
    return { ok: false, error: "codeTooShort" };
  }
  // Pozitív egész forintösszeg
  if (!Number.isInteger(amountHuf) || amountHuf <= 0 || amountHuf > 1_000_000) {
    return { ok: false, error: "invalidAmount" };
  }
  // Hibás dátumformátum
  if (validFrom === undefined || validUntil === undefined) {
    return { ok: false, error: "invalidDate" };
  }
  // A kezdő dátum nem lehet a záró után
  if (validFrom && validUntil && validFrom > validUntil) {
    return { ok: false, error: "invalidRange" };
  }
  return { ok: true, value: { code, amountHuf, validFrom, validUntil, active: raw.active !== false, note: text(raw.note, 200) } };
}

// Admin: új kupon létrehozása (a kód egyedi, kis- és nagybetűtől függetlenül)
export function createCoupon(body: unknown): { ok: true; coupon: Coupon } | { ok: false; error: string } {
  const input = readCouponInput(body);
  // Hibás adatok
  if (!input.ok) {
    return input;
  }
  const db = getCustomerDb();
  // Foglalt kód
  if (db.prepare("SELECT 1 FROM coupons WHERE code = ?").get(input.value.code)) {
    return { ok: false, error: "codeExists" };
  }
  const result = db
    .prepare("INSERT INTO coupons (code, amount_huf, valid_from, valid_until, active, note) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.value.code, input.value.amountHuf, input.value.validFrom, input.value.validUntil, input.value.active ? 1 : 0, input.value.note);
  const row = db.prepare("SELECT * FROM coupons WHERE id = ?").get(Number(result.lastInsertRowid)) as CouponRow;
  return { ok: true, coupon: toCoupon(row) };
}

// Admin: kupon módosítása (összeg, érvényesség, aktív, megjegyzés; a kód nem változtatható)
export function updateCoupon(id: number, body: unknown): { ok: true } | { ok: false; error: string } {
  const db = getCustomerDb();
  const existing = db.prepare("SELECT * FROM coupons WHERE id = ?").get(id) as CouponRow | undefined;
  // Ismeretlen kupon
  if (!existing) {
    return { ok: false, error: "notFound" };
  }
  const input = readCouponInput({ ...record(body), code: existing.code });
  // Hibás adatok
  if (!input.ok) {
    return input;
  }
  db.prepare("UPDATE coupons SET amount_huf = ?, valid_from = ?, valid_until = ?, active = ?, note = ? WHERE id = ?").run(
    input.value.amountHuf,
    input.value.validFrom,
    input.value.validUntil,
    input.value.active ? 1 : 0,
    input.value.note,
    id,
  );
  return { ok: true };
}

// Admin: kupon törlése (a már leadott rendeléseken a kód és a levont összeg megmarad)
export function deleteCoupon(id: number): boolean {
  return Number(getCustomerDb().prepare("DELETE FROM coupons WHERE id = ?").run(id).changes) > 0;
}

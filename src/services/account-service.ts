import "server-only";
import {
  createToken,
  hashPassword,
  hashToken,
  revokeAccountSessions,
  verifyAgainstDummy,
  verifyPassword,
} from "@/services/auth-service";
import { getCustomerDb, inTransaction } from "@/services/customer-db";
import { sendPasswordReset } from "@/services/mail-service";
import {
  deleteSubscriberByEmail,
  subscribe,
  subscriptionStatus,
  unsubscribeEmail,
} from "@/services/newsletter-service";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH, isValidEmail, normalizeEmail, password, record, text } from "@/lib/validation";
import type {
  AccountErrorCode,
  AccountOrder,
  AccountOrderItem,
  AccountOverview,
  AccountProfileInput,
} from "@/types/account";
import type { ProductGrade } from "@/types/product";

// Művelet eredménye: siker adattal, vagy mezőnkénti hibakódok
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, AccountErrorCode> };

// Hibás eredmény rövidítése
function fail<T>(errors: Record<string, AccountErrorCode>): Result<T> {
  return { ok: false, errors };
}

// Nyelvkód a kérésből (ismeretlen → alapnyelv)
function langOf(value: unknown): Locale {
  const code = text(value, 5);
  return hasLocale(code) ? code : DEFAULT_LOCALE;
}

// Új jelszó ellenőrzése (hossz és megerősítés egyezése)
function checkNewPassword(next: string, confirm: string, errors: Record<string, AccountErrorCode>): void {
  // Túl rövid jelszó
  if (next.length < MIN_PASSWORD_LENGTH) {
    errors.password = "weakPassword";
  } else if (next !== confirm) {
    errors.passwordConfirm = "passwordMismatch";
  }
}

// Regisztráció vásárlás nélkül: ügyfélsor (ha még nincs) + fiók; opcionális hírlevél-feliratkozás (dupla opt-in)
export function register(body: unknown): Result<number> {
  const raw = record(body);
  const name = text(raw.name);
  const email = normalizeEmail(raw.email);
  const pass = password(raw.password);
  const lang = langOf(raw.lang);
  const errors: Record<string, AccountErrorCode> = {};
  // Kötelező név
  if (!name) {
    errors.name = "required";
  }
  // Kötelező, formailag érvényes e-mail
  if (!email) {
    errors.email = "required";
  } else if (!isValidEmail(email)) {
    errors.email = "invalidEmail";
  }
  checkNewPassword(pass, password(raw.passwordConfirm), errors);
  // Az adatkezelési tájékoztató megismerésének visszaigazolása kötelező
  if (raw.acceptPrivacy !== true) {
    errors.privacy = "consentRequired";
  }
  // Formai hibák esetén nem nyúlunk az adatbázishoz
  if (Object.keys(errors).length > 0) {
    return fail(errors);
  }

  const accountId = inTransaction((db) => {
    const existing = db
      .prepare(
        "SELECT c.id AS id, a.id AS accountId FROM customers c LEFT JOIN accounts a ON a.customer_id = c.id WHERE c.email = ?",
      )
      .get(email) as { id: number; accountId: number | null } | undefined;
    // Már regisztrált e-mail cím
    if (existing?.accountId) {
      return null;
    }
    let customerId = existing?.id;
    // Korábban csak vendégként vásárolt: a meglévő ügyfélsorhoz kötjük a fiókot; egyébként új ügyfélsor
    if (customerId === undefined) {
      const inserted = db
        .prepare("INSERT INTO customers (name, email, phone, postcode, city, address) VALUES (?, ?, '', '', '', '')")
        .run(name, email);
      customerId = Number(inserted.lastInsertRowid);
    }
    const created = db
      .prepare("INSERT INTO accounts (customer_id, password_hash, lang, last_login_at) VALUES (?, ?, ?, datetime('now'))")
      .run(customerId, hashPassword(pass), lang);
    return Number(created.lastInsertRowid);
  });
  // Foglalt e-mail cím
  if (accountId === null) {
    return fail({ email: "emailTaken" });
  }
  // Kért hírlevél: megerősítő levél megy ki
  if (raw.newsletter === true) {
    subscribe({ email, name, lang, source: "account" });
  }
  return { ok: true, value: accountId };
}

// Belépés e-mail + jelszó párossal; hibás adatnál nem áruljuk el, melyik volt rossz
export function login(body: unknown): Result<number> {
  const raw = record(body);
  const email = normalizeEmail(raw.email);
  const pass = password(raw.password);
  const row = getCustomerDb()
    .prepare(
      "SELECT a.id AS id, a.password_hash AS hash FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE c.email = ?",
    )
    .get(email) as { id: number; hash: string } | undefined;
  // Nem létező fióknál is lefut egy hash-ellenőrzés, hogy a válaszidő ne áruljon el semmit
  if (!row) {
    verifyAgainstDummy(pass);
    return fail({ form: "invalidCredentials" });
  }
  // Hibás jelszó
  if (!verifyPassword(pass, row.hash)) {
    return fail({ form: "invalidCredentials" });
  }
  getCustomerDb().prepare("UPDATE accounts SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
  return { ok: true, value: row.id };
}

// A fiók e-mail címe, neve és nyelve
function accountIdentity(accountId: number): { email: string; name: string; lang: Locale; customerId: number } | null {
  const row = getCustomerDb()
    .prepare(
      "SELECT c.id AS customerId, c.email AS email, c.name AS name, a.lang AS lang FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE a.id = ?",
    )
    .get(accountId) as { customerId: number; email: string; name: string; lang: string } | undefined;
  return row ? { ...row, lang: hasLocale(row.lang) ? row.lang : DEFAULT_LOCALE } : null;
}

// A fiók e-mail címe (a pénztárban a rendelés ehhez a címhez kötődik)
export function getAccountEmail(accountId: number): string | null {
  return accountIdentity(accountId)?.email ?? null;
}

// Profil és korábbi rendelések (a „Fiókom” oldalhoz és a pénztár előtöltéséhez)
export function getAccountOverview(accountId: number): AccountOverview | null {
  const db = getCustomerDb();
  const profile = db
    .prepare(
      `SELECT c.id AS customerId, c.name AS name, c.email AS email, c.phone AS phone, c.postcode AS postcode,
         c.city AS city, c.address AS address, a.lang AS lang, a.created_at AS createdAt
       FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE a.id = ?`,
    )
    .get(accountId) as
    | {
        customerId: number;
        name: string;
        email: string;
        phone: string;
        postcode: string;
        city: string;
        address: string;
        lang: string;
        createdAt: string;
      }
    | undefined;
  // Törölt vagy nem létező fiók
  if (!profile) {
    return null;
  }
  const orderRows = db
    .prepare(
      `SELECT id, created_at AS createdAt, status, total_huf AS totalHuf, payment_method AS paymentMethod,
         payment_status AS paymentStatus, shipping_method AS shippingMethod, pickup_point_name AS pickupPointName
       FROM orders WHERE customer_id = ? ORDER BY id DESC`,
    )
    .all(profile.customerId) as Omit<AccountOrder, "items">[];
  const itemStatement = db.prepare(
    "SELECT product_name AS productName, size, grade, qty, unit_price_huf AS unitPriceHuf FROM order_items WHERE order_id = ?",
  );
  const orders: AccountOrder[] = orderRows.map((order) => ({
    ...order,
    items: (itemStatement.all(order.id) as (Omit<AccountOrderItem, "grade"> & { grade: string })[]).map((item) => ({
      ...item,
      grade: item.grade as ProductGrade,
    })),
  }));
  return {
    profile: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      postcode: profile.postcode,
      city: profile.city,
      address: profile.address,
      lang: hasLocale(profile.lang) ? profile.lang : DEFAULT_LOCALE,
      newsletter: subscriptionStatus(profile.email),
      createdAt: profile.createdAt,
    },
    orders,
  };
}

// Profil (szállítási adatok, nyelv) és hírlevél-beállítás frissítése
export function updateProfile(accountId: number, body: unknown): Result<true> {
  const raw = record(body);
  const identity = accountIdentity(accountId);
  // Nem létező fiók
  if (!identity) {
    return fail({ form: "unauthorized" });
  }
  const input: AccountProfileInput = {
    name: text(raw.name),
    phone: text(raw.phone, 40),
    postcode: text(raw.postcode, 10),
    city: text(raw.city),
    address: text(raw.address),
  };
  // A név kötelező, a többi mező kitölthető később is
  if (!input.name) {
    return fail({ name: "required" });
  }
  const lang = raw.lang === undefined ? identity.lang : langOf(raw.lang);
  inTransaction((db) => {
    db.prepare(
      "UPDATE customers SET name = ?, phone = ?, postcode = ?, city = ?, address = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(input.name, input.phone, input.postcode, input.city, input.address, identity.customerId);
    db.prepare("UPDATE accounts SET lang = ? WHERE id = ?").run(lang, accountId);
  });
  // Hírlevél be: megerősítő levél (ha még nem aktív); ki: leiratkozás
  if (raw.newsletter === true) {
    subscribe({ email: identity.email, name: input.name, lang, source: "account" });
  } else if (raw.newsletter === false) {
    unsubscribeEmail(identity.email);
  }
  return { ok: true, value: true };
}

// Jelszócsere a jelenlegi jelszó ellenőrzésével; a többi eszközön lévő munkamenet megszűnik
export function changePassword(accountId: number, body: unknown): Result<true> {
  const raw = record(body);
  const row = getCustomerDb().prepare("SELECT password_hash AS hash FROM accounts WHERE id = ?").get(accountId) as
    | { hash: string }
    | undefined;
  // Nem létező fiók
  if (!row) {
    return fail({ form: "unauthorized" });
  }
  const errors: Record<string, AccountErrorCode> = {};
  // A jelenlegi jelszónak egyeznie kell
  if (!verifyPassword(password(raw.currentPassword), row.hash)) {
    errors.currentPassword = "wrongPassword";
  }
  checkNewPassword(password(raw.password), password(raw.passwordConfirm), errors);
  // Hibák esetén nincs változás
  if (Object.keys(errors).length > 0) {
    return fail(errors);
  }
  getCustomerDb().prepare("UPDATE accounts SET password_hash = ? WHERE id = ?").run(hashPassword(password(raw.password)), accountId);
  revokeAccountSessions(accountId);
  return { ok: true, value: true };
}

// Jelszó-visszaállítás kérése: ha létezik fiók, 1 órás linket küldünk; a válasz mindig ugyanaz (nem árulja el a fiók létét)
export function requestPasswordReset(body: unknown): void {
  const raw = record(body);
  const email = normalizeEmail(raw.email);
  const row = getCustomerDb()
    .prepare(
      "SELECT a.id AS id, c.name AS name FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE c.email = ?",
    )
    .get(email) as { id: number; name: string } | undefined;
  // Nem létező fióknak nem küldünk levelet
  if (!row) {
    return;
  }
  const token = createToken();
  getCustomerDb()
    .prepare("INSERT INTO password_resets (account_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(row.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1000).toISOString());
  sendPasswordReset({ email, name: row.name, lang: langOf(raw.lang), token });
}

// Új jelszó beállítása a levélben kapott tokennel; sikeres csere után minden munkamenet megszűnik
export function resetPassword(body: unknown): Result<true> {
  const raw = record(body);
  const errors: Record<string, AccountErrorCode> = {};
  checkNewPassword(password(raw.password), password(raw.passwordConfirm), errors);
  // Formai hibák esetén a tokent sem használjuk el
  if (Object.keys(errors).length > 0) {
    return fail(errors);
  }
  const db = getCustomerDb();
  const reset = db
    .prepare("SELECT id, account_id AS accountId, expires_at AS expiresAt, used_at AS usedAt FROM password_resets WHERE token_hash = ?")
    .get(hashToken(text(raw.token, 100))) as
    | { id: number; accountId: number; expiresAt: string; usedAt: string | null }
    | undefined;
  // Ismeretlen, lejárt vagy már felhasznált token
  if (!reset || reset.usedAt !== null || new Date(reset.expiresAt).getTime() <= Date.now()) {
    return fail({ form: "invalidToken" });
  }
  inTransaction((tx) => {
    tx.prepare("UPDATE accounts SET password_hash = ? WHERE id = ?").run(hashPassword(password(raw.password)), reset.accountId);
    tx.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE account_id = ? AND used_at IS NULL").run(
      reset.accountId,
    );
  });
  revokeAccountSessions(reset.accountId);
  return { ok: true, value: true };
}

// Fiók törlése jelszó-megerősítéssel: a fiók, a munkamenetek és a hírlevél-feliratkozás törlődik;
// a rendelések (és a hozzájuk tartozó ügyfélsor) a számviteli megőrzési kötelezettség miatt megmaradnak
export function deleteAccount(accountId: number, body: unknown): Result<true> {
  const raw = record(body);
  const identity = accountIdentity(accountId);
  const row = getCustomerDb().prepare("SELECT password_hash AS hash FROM accounts WHERE id = ?").get(accountId) as
    | { hash: string }
    | undefined;
  // Nem létező fiók
  if (!identity || !row) {
    return fail({ form: "unauthorized" });
  }
  // A törlést a jelszóval kell megerősíteni
  if (!verifyPassword(password(raw.password), row.hash)) {
    return fail({ password: "wrongPassword" });
  }
  inTransaction((db) => {
    db.prepare("DELETE FROM accounts WHERE id = ?").run(accountId);
    const orders = db.prepare("SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?").get(identity.customerId) as {
      count: number;
    };
    // Rendelés nélküli ügyfélsor (csak regisztrált, nem vásárolt) teljesen törölhető
    if (Number(orders.count) === 0) {
      db.prepare("DELETE FROM customers WHERE id = ?").run(identity.customerId);
    }
  });
  deleteSubscriberByEmail(identity.email);
  return { ok: true, value: true };
}

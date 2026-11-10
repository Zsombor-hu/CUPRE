import "server-only";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dataDir, dataFile } from "@/services/data-paths";
import type { CatalogVariant } from "@/types/product";
import type { CustomerInput, PaymentMethod, PaymentStatus, PickupPoint, ShippingMethod } from "@/types/order";
import type { Locale } from "@/lib/i18n";

// Az ügyfél-adatbázis fájlneve a környezet adatkönyvtárában (src/data/<környezet>/customers.sqlite)
const DB_FILE = "customers.sqlite";

// Séma: ügyfelek (e-mail szerint egyedi), vásárlói fiókok, munkamenetek, jelszó-visszaállítás,
// hírlevél-feliratkozók, rendelések és rendelési tételek (az ár a rendelés pillanatában rögzítve)
const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    postcode TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id),
    password_hash TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'hu',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('customer', 'admin')),
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'hu',
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'unsubscribed')),
    token_hash TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('form', 'checkout', 'account')),
    consent_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT,
    unsubscribed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    amount_huf INTEGER NOT NULL CHECK (amount_huf > 0),
    valid_from TEXT,
    valid_until TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    note TEXT NOT NULL DEFAULT '',
    used_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    account_id INTEGER,
    status TEXT NOT NULL DEFAULT 'new',
    total_huf INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'hu',
    terms_accepted_at TEXT,
    shipping_fee_huf INTEGER NOT NULL DEFAULT 0,
    ship_name TEXT NOT NULL DEFAULT '',
    ship_phone TEXT NOT NULL DEFAULT '',
    ship_postcode TEXT NOT NULL DEFAULT '',
    ship_city TEXT NOT NULL DEFAULT '',
    ship_address TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT 'none',
    payment_status TEXT NOT NULL DEFAULT 'not_required',
    payment_fee_huf INTEGER NOT NULL DEFAULT 0,
    payment_ref TEXT,
    paid_at TEXT,
    access_token_hash TEXT,
    shipping_method TEXT NOT NULL DEFAULT 'none',
    pickup_point_id TEXT,
    pickup_point_name TEXT,
    pickup_point_address TEXT,
    coupon_code TEXT,
    discount_huf INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    provider TEXT NOT NULL,
    payment_ref TEXT,
    status TEXT NOT NULL,
    raw TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    size TEXT NOT NULL,
    grade TEXT NOT NULL,
    unit_price_huf INTEGER NOT NULL,
    qty INTEGER NOT NULL
  );
`;

// A korábban létrehozott orders táblához utólag felvett oszlopok (név → definíció)
const ORDER_COLUMNS: Record<string, string> = {
  lang: "TEXT NOT NULL DEFAULT 'hu'",
  terms_accepted_at: "TEXT",
  shipping_fee_huf: "INTEGER NOT NULL DEFAULT 0",
  account_id: "INTEGER",
  ship_name: "TEXT NOT NULL DEFAULT ''",
  ship_phone: "TEXT NOT NULL DEFAULT ''",
  ship_postcode: "TEXT NOT NULL DEFAULT ''",
  ship_city: "TEXT NOT NULL DEFAULT ''",
  ship_address: "TEXT NOT NULL DEFAULT ''",
  payment_method: "TEXT NOT NULL DEFAULT 'none'",
  payment_status: "TEXT NOT NULL DEFAULT 'not_required'",
  payment_fee_huf: "INTEGER NOT NULL DEFAULT 0",
  payment_ref: "TEXT",
  paid_at: "TEXT",
  access_token_hash: "TEXT",
  shipping_method: "TEXT NOT NULL DEFAULT 'none'",
  pickup_point_id: "TEXT",
  pickup_point_name: "TEXT",
  pickup_point_address: "TEXT",
  coupon_code: "TEXT",
  discount_huf: "INTEGER NOT NULL DEFAULT 0",
};

// Folyamatonként egy kapcsolat; fejlesztéskor a hot reload ne nyisson újat minden módosításnál
const globalForDb = globalThis as typeof globalThis & { cupreCustomerDb?: DatabaseSync };

// Sémafrissítés a korábban létrehozott adatbázisokhoz (a CREATE TABLE IF NOT EXISTS új oszlopot nem ad hozzá)
function migrate(db: DatabaseSync): void {
  const existing = new Set((db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name));
  // Csak a hiányzó oszlopokat vesszük fel, a meglévő adatok érintetlenek maradnak
  for (const [column, definition] of Object.entries(ORDER_COLUMNS)) {
    // Már létező oszlopot nem lehet újra felvenni
    if (!existing.has(column)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`);
    }
  }
}

// Az aktuális környezet ügyfél-adatbázisa; első megnyitáskor létrehozza a fájlt és a táblákat
export function getCustomerDb(): DatabaseSync {
  // Már megnyitott kapcsolatot újrahasznosítunk
  if (globalForDb.cupreCustomerDb) {
    return globalForDb.cupreCustomerDb;
  }
  fs.mkdirSync(dataDir(), { recursive: true });
  const db = new DatabaseSync(dataFile(DB_FILE));
  db.exec(SCHEMA);
  migrate(db);
  globalForDb.cupreCustomerDb = db;
  return db;
}

// Művelet futtatása tranzakcióban: hiba esetén visszagörget, így nem marad félig mentett adat
export function inTransaction<T>(work: (db: DatabaseSync) => T): T {
  const db = getCustomerDb();
  db.exec("BEGIN");
  // A hibát továbbdobjuk, de előtte visszagörgetünk
  try {
    const result = work(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// A rendelés fizetési adatai létrehozáskor (mód, kezdő állapot, utánvételi díj, eredményoldal-token hash)
export type NewOrderPayment = {
  method: PaymentMethod;
  status: PaymentStatus;
  feeHuf: number;
  accessTokenHash: string;
};

// A rendelés szállítási adatai létrehozáskor (mód, a szerver beállításából vett díj, átvételi pont)
export type NewOrderShipping = {
  method: ShippingMethod;
  feeHuf: number;
  pickupPoint: PickupPoint | null;
};

// A rendeléshez beváltott kupon (kód és a ténylegesen levont összeg)
export type NewOrderDiscount = {
  couponCode: string;
  discountHuf: number;
} | null;

// Rendelési tétel a szerveren feloldott változattal és darabszámmal
export type ResolvedOrderItem = {
  variant: CatalogVariant;
  qty: number;
};

// Rendelés mentése egy tranzakcióban. A szállítási adatok a rendelésen pillanatképként is megmaradnak.
// Ügyfélprofil frissítése: belépett ügyfélnél a saját profilja frissül; vendégrendelésnél csak akkor, ha az e-mailhez
// nem tartozik fiók (így egy idegen nem írhatja felül egy regisztrált ügyfél adatait).
export function createOrder(
  customer: CustomerInput,
  items: ResolvedOrderItem[],
  note: string,
  lang: Locale,
  shipping: NewOrderShipping,
  accountId: number | null,
  payment: NewOrderPayment,
  discount: NewOrderDiscount = null,
): {
  orderId: number;
  totalHuf: number;
  discountHuf: number;
} {
  const itemsTotal = items.reduce((sum, item) => sum + item.variant.priceHuf * item.qty, 0);
  // A kupon csak a termékek árából vonható le, legfeljebb annak összegéig (a szállítási és utánvételi díjat nem érinti)
  const discountHuf = discount ? Math.min(discount.discountHuf, itemsTotal) : 0;
  const totalHuf = itemsTotal - discountHuf + shipping.feeHuf + payment.feeHuf;
  return inTransaction((db) => {
    const existing = db
      .prepare(
        `SELECT c.id AS id, a.id AS accountId FROM customers c LEFT JOIN accounts a ON a.customer_id = c.id
         WHERE c.email = ?`,
      )
      .get(customer.email) as { id: number; accountId: number | null } | undefined;
    let customerId: number;
    // Új e-mail cím: új ügyfélsor
    if (!existing) {
      const inserted = db
        .prepare("INSERT INTO customers (name, email, phone, postcode, city, address) VALUES (?, ?, ?, ?, ?, ?)")
        .run(customer.name, customer.email, customer.phone, customer.postcode, customer.city, customer.address);
      customerId = Number(inserted.lastInsertRowid);
    } else {
      customerId = existing.id;
      // A profilt csak a saját fiókjával belépett ügyfél vagy fiók nélküli vendég frissítheti
      if (existing.accountId === null || existing.accountId === accountId) {
        db.prepare(
          `UPDATE customers SET name = ?, phone = ?, postcode = ?, city = ?, address = ?, updated_at = datetime('now')
           WHERE id = ?`,
        ).run(customer.name, customer.phone, customer.postcode, customer.city, customer.address, customerId);
      }
    }
    const orderResult = db
      .prepare(
        `INSERT INTO orders (customer_id, account_id, total_huf, note, lang, terms_accepted_at, shipping_fee_huf,
           ship_name, ship_phone, ship_postcode, ship_city, ship_address,
           payment_method, payment_status, payment_fee_huf, access_token_hash,
           shipping_method, pickup_point_id, pickup_point_name, pickup_point_address, coupon_code, discount_huf)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        customerId,
        accountId,
        totalHuf,
        note,
        lang,
        shipping.feeHuf,
        customer.name,
        customer.phone,
        customer.postcode,
        customer.city,
        customer.address,
        payment.method,
        payment.status,
        payment.feeHuf,
        payment.accessTokenHash,
        shipping.method,
        shipping.pickupPoint?.id ?? null,
        shipping.pickupPoint?.name ?? null,
        shipping.pickupPoint?.address ?? null,
        discount && discountHuf > 0 ? discount.couponCode : null,
        discountHuf,
      );
    const orderId = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, sku, product_name, size, grade, unit_price_huf, qty)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // Minden tételt a rendelés pillanatában érvényes árral rögzítünk
    for (const item of items) {
      insertItem.run(
        orderId,
        item.variant.sku,
        item.variant.productName,
        item.variant.size,
        item.variant.grade,
        item.variant.priceHuf,
        item.qty,
      );
    }
    // A beváltott kupon felhasználási számlálója
    if (discount && discountHuf > 0) {
      db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?").run(discount.couponCode);
    }
    return { orderId, totalHuf, discountHuf };
  });
}

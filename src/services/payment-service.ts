import "server-only";
import { createToken, hashToken } from "@/services/auth-service";
import { barionConfig, getBarionPaymentState, startBarionPayment } from "@/services/barion-client";
import { getCompanyInfo } from "@/services/company-service";
import { getCustomerDb } from "@/services/customer-db";
import { sendPaymentReceived } from "@/services/mail-service";
import { getAppEnv } from "@/lib/app-env";
import { DEFAULT_LOCALE, hasLocale, localePath, type Locale } from "@/lib/i18n";
import type { CardProvider } from "@/types/company";
import type { PaymentMethod, PaymentOption, PaymentStatus, PaymentSummary } from "@/types/order";

// A webshop nyilvános címe (a Barion visszairányításhoz és a callbackhez abszolút https cím kell)
function siteUrl(): string {
  return (process.env.SITE_URL ?? "").replace(/\/$/, "");
}

// A kártyás fizetés szolgáltatója, ha a mód bekapcsolt ÉS ténylegesen használható (különben null):
// a mock production környezetben tiltott; a Barionhoz kulcs és https SITE_URL kell
export function cardProvider(): CardProvider | null {
  const card = getCompanyInfo().shop.payments.card;
  // Kikapcsolt kártyás fizetés
  if (!card.enabled) {
    return null;
  }
  // A teszt-szolgáltató élesben soha nem használható
  if (card.provider === "mock") {
    return getAppEnv() === "production" ? null : "mock";
  }
  // Barion: hiányzó beállításnál figyelmeztetünk és nem ajánljuk fel
  if (!barionConfig() || !siteUrl().startsWith("https://")) {
    console.warn("A Barion kártyás fizetés be van kapcsolva, de hiányzik a BARION_POS_KEY / BARION_PAYEE vagy a https SITE_URL.");
    return null;
  }
  return "barion";
}

// A pénztárban választható fizetési módok (csak a bekapcsolt és használható módok)
export function paymentOptions(): PaymentOption[] {
  const payments = getCompanyInfo().shop.payments;
  const options: PaymentOption[] = [];
  const provider = cardProvider();
  // Bankkártya (Barion vagy fejlesztéshez a teszt-szolgáltató)
  if (provider) {
    options.push({ method: "card", feeHuf: 0, provider });
  }
  // Banki átutalás
  if (payments.transfer.enabled) {
    options.push({ method: "transfer", feeHuf: 0 });
  }
  // Utánvét (díjjal)
  if (payments.cod.enabled) {
    options.push({ method: "cod", feeHuf: payments.cod.feeHuf });
  }
  return options;
}

// A rendeléskor választott mód ellenőrzése: csak bekapcsolt mód fogadható el; ha egy sincs, „none”
export function resolvePaymentMethod(requested: unknown): { method: PaymentMethod; feeHuf: number } | null {
  const options = paymentOptions();
  // Egy fizetési mód sincs bekapcsolva: a rendelés fizetési mód nélkül rögzül
  if (options.length === 0) {
    return { method: "none", feeHuf: 0 };
  }
  const option = options.find((candidate) => candidate.method === requested);
  return option ? { method: option.method, feeHuf: option.feeHuf } : null;
}

// Kezdő fizetési állapot a mód szerint
export function initialPaymentStatus(method: PaymentMethod): PaymentStatus {
  const statuses: Record<PaymentMethod, PaymentStatus> = {
    card: "pending",
    transfer: "awaiting_transfer",
    cod: "awaiting_cod",
    none: "not_required",
  };
  return statuses[method];
}

// Új titkos token a rendelés fizetési állapotának lekérdezéséhez (a kliens kapja, az adatbázisba a hash-e kerül)
export function newOrderAccessToken(): { token: string; hash: string } {
  const token = createToken();
  return { token, hash: hashToken(token) };
}

// A fizetéshez szükséges rendelésadatok egy sorban
type PaymentOrderRow = {
  id: number;
  lang: string;
  total_huf: number;
  shipping_fee_huf: number;
  shipping_method: string;
  discount_huf: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_fee_huf: number;
  payment_ref: string | null;
  email: string;
  name: string;
};

// Rendelés lekérdezése azonosító és hozzáférési token alapján (rossz token esetén null – nincs rendelésszám-találgatás)
export function findOrderForPayment(orderId: number, token: string): PaymentOrderRow | null {
  // Érvénytelen azonosító vagy hiányzó token
  if (!Number.isInteger(orderId) || !token) {
    return null;
  }
  const row = getCustomerDb()
    .prepare(
      `SELECT o.id, o.lang, o.total_huf, o.shipping_fee_huf, o.shipping_method, o.discount_huf, o.payment_method, o.payment_status, o.payment_fee_huf,
         o.payment_ref, c.email, o.ship_name AS name
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ? AND o.access_token_hash = ?`,
    )
    .get(orderId, hashToken(token)) as PaymentOrderRow | undefined;
  return row ?? null;
}

// Rendelés lekérdezése csak azonosító alapján (szerveroldali callback esetén)
function findOrderById(orderId: number): PaymentOrderRow | null {
  const row = getCustomerDb()
    .prepare(
      `SELECT o.id, o.lang, o.total_huf, o.shipping_fee_huf, o.shipping_method, o.discount_huf, o.payment_method, o.payment_status, o.payment_fee_huf,
         o.payment_ref, c.email, o.ship_name AS name
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    )
    .get(orderId) as PaymentOrderRow | undefined;
  return row ?? null;
}

// A rendelés nyelve (ismeretlen → alapnyelv)
function orderLang(row: PaymentOrderRow): Locale {
  return hasLocale(row.lang) ? row.lang : DEFAULT_LOCALE;
}

// Fizetési esemény naplózása (vitás esetekhez, utólagos ellenőrzéshez)
function logPaymentEvent(orderId: number, provider: string, ref: string | null, status: string, raw: unknown): void {
  getCustomerDb()
    .prepare("INSERT INTO payment_events (order_id, provider, payment_ref, status, raw) VALUES (?, ?, ?, ?, ?)")
    .run(orderId, provider, ref, status, raw === undefined ? "" : JSON.stringify(raw));
}

// Fizetési állapot rögzítése idempotensen: kifizetett rendelés állapota már nem változhat;
// az első „paid” átmenetnél fizetési idő és „fizetés beérkezett” levél
export function applyPaymentStatus(orderId: number, status: PaymentStatus, provider: string, ref: string | null, raw: unknown): void {
  const row = findOrderById(orderId);
  // Ismeretlen rendelés
  if (!row) {
    return;
  }
  logPaymentEvent(orderId, provider, ref, status, raw);
  // Már kifizetett vagy változatlan állapot: nincs teendő
  if (row.payment_status === "paid" || row.payment_status === status) {
    return;
  }
  getCustomerDb()
    .prepare(
      `UPDATE orders SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN datetime('now') ELSE paid_at END
       WHERE id = ?`,
    )
    .run(status, status, orderId);
  // Sikeres fizetésről a vásárló levelet kap
  if (status === "paid") {
    sendPaymentReceived({ orderId, totalHuf: row.total_huf, email: row.email, name: row.name, lang: orderLang(row) });
  }
}

// Kártyás fizetés indítása (első alkalommal vagy újrapróbáláskor); visszaadja a fizetőoldal címét
export async function startCardPayment(orderId: number, token: string): Promise<string> {
  const row = findOrderForPayment(orderId, token);
  // Csak létező, kártyás és még nem kifizetett rendeléshez indítható fizetés
  if (!row || row.payment_method !== "card" || row.payment_status === "paid") {
    throw new Error("A rendeléshez nem indítható kártyás fizetés.");
  }
  const provider = cardProvider();
  const lang = orderLang(row);
  const resultPath = `${localePath(lang, "/fizetes/eredmeny")}?order=${row.id}&token=${encodeURIComponent(token)}`;
  // A kártyás fizetés közben kikapcsolták vagy elérhetetlenné vált
  if (!provider) {
    throw new Error("A kártyás fizetés jelenleg nem érhető el.");
  }
  // Teszt-szolgáltató: a saját „fizetőoldalunkra” irányítunk
  if (provider === "mock") {
    getCustomerDb().prepare("UPDATE orders SET payment_status = 'pending', payment_ref = ? WHERE id = ?").run(`MOCK-${row.id}`, row.id);
    logPaymentEvent(row.id, "mock", `MOCK-${row.id}`, "started", undefined);
    return `${localePath(lang, "/fizetes/teszt")}?order=${row.id}&token=${encodeURIComponent(token)}`;
  }
  const config = barionConfig();
  // A cardProvider már ellenőrizte, ez csak típusbiztonság
  if (!config) {
    throw new Error("Hiányzó Barion beállítás.");
  }
  const items = (
    getCustomerDb()
      .prepare("SELECT sku, product_name, size, grade, unit_price_huf, qty FROM order_items WHERE order_id = ?")
      .all(row.id) as { sku: string; product_name: string; size: string; grade: string; unit_price_huf: number; qty: number }[]
  ).map((item) => ({
    name: item.product_name,
    description: `${item.size} · ${item.grade}`,
    quantity: item.qty,
    unit: "db",
    unitPrice: item.unit_price_huf,
    sku: item.sku,
  }));
  // A szállítási díj külön tételként jelenik meg a Barion fizetőoldalán
  if (row.shipping_fee_huf > 0) {
    const shippingNames: Record<string, string> = {
      home: "Házhozszállítás",
      foxpost: "Foxpost csomagautomata",
      mpl_point: "MPL PostaPont",
    };
    items.push({
      name: shippingNames[row.shipping_method] ?? "Szállítás",
      description: "Szállítási díj",
      quantity: 1,
      unit: "db",
      unitPrice: row.shipping_fee_huf,
      sku: "SHIPPING",
    });
  }
  // Kuponos rendelésnél egyetlen összesítő tétel megy a Barionnak, így a tételek összege biztosan egyezik a végösszeggel
  const barionItems =
    row.discount_huf > 0
      ? [{ name: `CUPRÉ rendelés #${row.id}`, description: "Kedvezménnyel csökkentett végösszeg", quantity: 1, unit: "db", unitPrice: row.total_huf, sku: `ORDER-${row.id}` }]
      : items;
  const started = await startBarionPayment(config, {
    orderId: row.id,
    attempt: Date.now().toString(36),
    totalHuf: row.total_huf,
    items: barionItems,
    payerEmail: row.email,
    lang,
    redirectUrl: `${siteUrl()}${resultPath}`,
    callbackUrl: `${siteUrl()}/api/payments/barion/callback`,
  });
  getCustomerDb()
    .prepare("UPDATE orders SET payment_status = 'pending', payment_ref = ? WHERE id = ?")
    .run(started.paymentId, row.id);
  logPaymentEvent(row.id, "barion", started.paymentId, "started", started.raw);
  return started.gatewayUrl;
}

// Barion callback: a fizetési azonosítóhoz tartozó rendelés állapotát a Barion API-tól kérdezzük le és rögzítjük
export async function handleBarionCallback(paymentId: string): Promise<boolean> {
  const config = barionConfig();
  const order = getCustomerDb().prepare("SELECT id FROM orders WHERE payment_ref = ?").get(paymentId) as
    | { id: number }
    | undefined;
  // Ismeretlen fizetés vagy hiányzó beállítás
  if (!config || !order) {
    return false;
  }
  const state = await getBarionPaymentState(config, paymentId);
  applyPaymentStatus(order.id, state.status, "barion", paymentId, state.raw);
  return true;
}

// Az eredményoldal lekérdezése: függő Barion fizetésnél előbb frissítünk a Barion API-ból
export async function paymentSummaryFor(orderId: number, token: string): Promise<PaymentSummary | null> {
  let row = findOrderForPayment(orderId, token);
  // Rossz token vagy ismeretlen rendelés
  if (!row) {
    return null;
  }
  // Függő Barion fizetés: állapotfrissítés (hiba esetén a meglévő állapotot mutatjuk)
  if (row.payment_method === "card" && row.payment_status === "pending" && row.payment_ref && !row.payment_ref.startsWith("MOCK-")) {
    try {
      await handleBarionCallback(row.payment_ref);
      row = findOrderForPayment(orderId, token) ?? row;
    } catch (error) {
      console.error(`A(z) #${orderId} rendelés Barion állapota nem kérdezhető le:`, error);
    }
  }
  return summarize(row);
}

// Fizetési összefoglaló (átutalásnál a banki adatokkal és a közleménnyel)
function summarize(row: PaymentOrderRow): PaymentSummary {
  const transfer = getCompanyInfo().shop.payments.transfer;
  return {
    orderId: row.id,
    totalHuf: row.total_huf,
    method: row.payment_method,
    status: row.payment_status,
    transfer:
      row.payment_method === "transfer"
        ? {
            accountHolder: transfer.accountHolder,
            bankName: transfer.bankName,
            accountNumber: transfer.accountNumber,
            iban: transfer.iban,
            swift: transfer.swift,
            dueDays: transfer.dueDays,
            reference: `CUPRE-${row.id}`,
          }
        : undefined,
  };
}

// Összefoglaló közvetlenül a rendelés létrehozása után (a visszaigazoláshoz és a levélhez)
export function paymentSummaryById(orderId: number): PaymentSummary | null {
  const row = findOrderById(orderId);
  return row ? summarize(row) : null;
}

// Teszt-szolgáltató: a „fizetőoldalon” választott kimenet rögzítése (production környezetben tiltott)
export function completeMockPayment(orderId: number, token: string, outcome: "paid" | "failed" | "canceled"): boolean {
  const row = findOrderForPayment(orderId, token);
  // Csak fejlesztői környezetben, mock módban, kártyás és függő rendelésnél
  if (getAppEnv() === "production" || cardProvider() !== "mock" || !row || row.payment_method !== "card") {
    return false;
  }
  applyPaymentStatus(row.id, outcome, "mock", row.payment_ref, { outcome });
  return true;
}

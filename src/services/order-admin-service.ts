import { buildXlsx } from "@/lib/xlsx";
import "server-only";
import { getCustomerDb, inTransaction } from "@/services/customer-db";
import { applyPaymentStatus } from "@/services/payment-service";
import { shippingSummaryById } from "@/services/shipping-service";
import { sendOrderShipped } from "@/services/mail-service";
import { DEFAULT_LOCALE, hasLocale } from "@/lib/i18n";
import { text } from "@/lib/validation";
import {
  ORDER_STATUSES,
  type AdminOrderDetail,
  type AdminOrderFilter,
  type AdminOrderListItem,
  type OrderStatus,
} from "@/types/admin-order";
import type { PaymentStatus } from "@/types/order";

// Ismert fizetési állapotok (szűréshez)
const PAYMENT_STATUSES: PaymentStatus[] = [
  "not_required",
  "pending",
  "awaiting_transfer",
  "awaiting_cod",
  "paid",
  "failed",
  "canceled",
  "expired",
];

// Szűrők a query-ből (ismeretlen értékek figyelmen kívül)
export function filterFromUrl(url: URL): AdminOrderFilter {
  const status = url.searchParams.get("status");
  const paymentStatus = url.searchParams.get("paymentStatus");
  return {
    status: isOrderStatus(status) ? status : undefined,
    paymentStatus: PAYMENT_STATUSES.includes(paymentStatus as PaymentStatus) ? (paymentStatus as PaymentStatus) : undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
}

// Lista oszlopai (a lista és a CSV közös lekérdezése)
const LIST_SELECT = `
  SELECT o.id, o.created_at AS createdAt, o.status, o.total_huf AS totalHuf,
    COALESCE(NULLIF(o.ship_name, ''), c.name) AS name, c.email, COALESCE(NULLIF(o.ship_city, ''), c.city) AS city,
    o.payment_method AS paymentMethod, o.payment_status AS paymentStatus, o.shipping_method AS shippingMethod,
    o.coupon_code AS couponCode, o.lang
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

// Ismert rendelésállapot-e
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as string[]).includes(value);
}

// Szűrők → WHERE feltétel és paraméterek (keresés: rendelésszám, név, e-mail)
function whereClause(filter: AdminOrderFilter): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  // Rendelésállapot szerinti szűrés
  if (filter.status) {
    conditions.push("o.status = ?");
    params.push(filter.status);
  }
  // Fizetési állapot szerinti szűrés
  if (filter.paymentStatus) {
    conditions.push("o.payment_status = ?");
    params.push(filter.paymentStatus);
  }
  const q = text(filter.q, 100);
  // Szabad szöveges keresés
  if (q) {
    conditions.push("(CAST(o.id AS TEXT) = ? OR c.email LIKE ? OR o.ship_name LIKE ? OR c.name LIKE ?)");
    const like = `%${q.replace(/[%_]/g, "")}%`;
    params.push(q.replace(/^#/, ""), like, like, like);
  }
  return { sql: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

// Rendelések listája a legújabb elöl (legfeljebb 500)
export function listOrders(filter: AdminOrderFilter): AdminOrderListItem[] {
  const where = whereClause(filter);
  return getCustomerDb()
    .prepare(`${LIST_SELECT} ${where.sql} ORDER BY o.id DESC LIMIT 500`)
    .all(...where.params) as AdminOrderListItem[];
}

// Darabszámok rendelésállapotonként (a fül-szűrőkhöz)
export function orderStatusCounts(): Record<OrderStatus, number> {
  const counts: Record<OrderStatus, number> = { new: 0, processing: 0, shipped: 0, completed: 0, canceled: 0 };
  const rows = getCustomerDb().prepare("SELECT status, COUNT(*) AS count FROM orders GROUP BY status").all() as {
    status: string;
    count: number;
  }[];
  // Csak az ismert állapotokat számoljuk
  for (const row of rows) {
    // Régi vagy ismeretlen állapotérték kimarad
    if (isOrderStatus(row.status)) {
      counts[row.status] = Number(row.count);
    }
  }
  return counts;
}

// Egy rendelés minden adata (tételek, állapotnapló, fizetési események)
export function getOrderDetail(id: number): AdminOrderDetail | null {
  const db = getCustomerDb();
  const base = db
    .prepare(
      `${LIST_SELECT.replace("o.lang", `o.lang, COALESCE(NULLIF(o.ship_phone, ''), c.phone) AS phone,
         COALESCE(NULLIF(o.ship_postcode, ''), c.postcode) AS postcode, COALESCE(NULLIF(o.ship_address, ''), c.address) AS address,
         o.note, o.account_id AS accountId, o.shipping_fee_huf AS shippingFeeHuf, o.payment_fee_huf AS paymentFeeHuf,
         o.discount_huf AS discountHuf, o.pickup_point_id AS pointId, o.pickup_point_name AS pointName,
         o.pickup_point_address AS pointAddress, o.payment_ref AS paymentRef, o.paid_at AS paidAt,
         o.terms_accepted_at AS termsAcceptedAt`)} WHERE o.id = ?`,
    )
    .get(id) as
    | (Omit<AdminOrderDetail, "items" | "history" | "paymentEvents" | "pickupPoint"> & {
        pointId: string | null;
        pointName: string | null;
        pointAddress: string | null;
      })
    | undefined;
  // Ismeretlen rendelés
  if (!base) {
    return null;
  }
  const { pointId, pointName, pointAddress, ...rest } = base;
  return {
    ...rest,
    pickupPoint: pointName ? { id: pointId, name: pointName, address: pointAddress ?? "" } : null,
    items: db
      .prepare(
        "SELECT sku, product_name AS productName, size, grade, qty, unit_price_huf AS unitPriceHuf FROM order_items WHERE order_id = ?",
      )
      .all(id) as AdminOrderDetail["items"],
    history: db
      .prepare("SELECT status, note, created_at AS createdAt FROM order_status_history WHERE order_id = ? ORDER BY id")
      .all(id) as AdminOrderDetail["history"],
    paymentEvents: db
      .prepare("SELECT provider, status, created_at AS createdAt FROM payment_events WHERE order_id = ? ORDER BY id")
      .all(id) as AdminOrderDetail["paymentEvents"],
  };
}

// Rendelésállapot módosítása naplózással; „feladva” állapotba lépéskor értesítő levél megy a vásárlónak
export function updateOrderStatus(id: number, status: OrderStatus, note: string): boolean {
  const order = getCustomerDb()
    .prepare("SELECT o.status, o.lang, c.email, COALESCE(NULLIF(o.ship_name, ''), c.name) AS name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?")
    .get(id) as { status: string; lang: string; email: string; name: string } | undefined;
  // Ismeretlen rendelés
  if (!order) {
    return false;
  }
  // Változatlan állapot: nincs teendő
  if (order.status === status) {
    return true;
  }
  inTransaction((db) => {
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
    db.prepare("INSERT INTO order_status_history (order_id, status, note) VALUES (?, ?, ?)").run(id, status, text(note, 300));
  });
  const shipping = shippingSummaryById(id);
  // A feladásról a vásárló a rendelés nyelvén kap levelet
  if (status === "shipped" && shipping) {
    sendOrderShipped({
      orderId: id,
      email: order.email,
      name: order.name,
      lang: hasLocale(order.lang) ? order.lang : DEFAULT_LOCALE,
      shipping,
      note: text(note, 300),
    });
  }
  return true;
}

// Átutalás vagy utánvét beérkezésének rögzítése (a vásárló „fizetés beérkezett” levelet kap)
export function markPaymentReceived(id: number): boolean {
  const row = getCustomerDb().prepare("SELECT payment_method AS method, payment_status AS status FROM orders WHERE id = ?").get(id) as
    | { method: string; status: PaymentStatus }
    | undefined;
  // Csak függő átutalásos/utánvétes rendelésnél
  if (!row || !["transfer", "cod"].includes(row.method) || !["awaiting_transfer", "awaiting_cod"].includes(row.status)) {
    return false;
  }
  applyPaymentStatus(id, "paid", "manual", null, { by: "admin" });
  return true;
}

// CSV mező idézése (vessző, idézőjel, sortörés és képletként értelmezhető kezdőkarakterek ellen)
function csvField(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Az export táblázata: fejléc + sorok (CSV-hez és Excelhez közös)
export function ordersTable(filter: AdminOrderFilter): { header: string[]; rows: (string | number | null)[][] } {
  const header = ["id", "created_at", "status", "payment_method", "payment_status", "shipping_method", "total_huf", "coupon", "name", "email", "city", "lang"];
  const rows = listOrders(filter).map((o) => [o.id, o.createdAt, o.status, o.paymentMethod, o.paymentStatus, o.shippingMethod, o.totalHuf, o.couponCode, o.name, o.email, o.city, o.lang]);
  return { header, rows };
}

// Rendelések CSV-ben (könyveléshez, futárnak), UTF-8 BOM-mal
export function ordersCsv(filter: AdminOrderFilter): string {
  const { header, rows } = ordersTable(filter);
  const lines = rows.map((row) => row.map(csvField).join(","));
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}

// Rendelések Excel (.xlsx) fájlban
export function ordersXlsx(filter: AdminOrderFilter): Buffer {
  const { header, rows } = ordersTable(filter);
  return buildXlsx("Rendelések", header, rows);
}
